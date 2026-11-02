import itertools

from yourbroker import recommender as R
from yourbroker.common import catalogue
from yourbroker.service import model


def ctx(**kw):
    base = dict(track="existing", cluster=0, cluster_name="x", held=set(), age=35, horizon_years=10,
                willingness=4, capacity=4, revealed_risk=3, equity_value=1_000_000)
    base.update(kw)
    return R.Ctx(**base)


def test_fno_mtf_never_recommended_under_any_profile():
    for w, c, tr, hz in itertools.product((1, 2, 3, 4), (1, 2, 3, 4), ("new", "existing"), (0.5, 2, 10)):
        x = ctx(willingness=w, capacity=c, track=tr, horizon_years=hz, has_behaviour=tr == "existing")
        for cat in ("fno", "mtf"):
            assert R.check(cat, x)[0] is False
        for cl in range(model()["k"]):
            x.cluster = cl
            cards = R.recommend(x, model())["cards"]
            assert not {"fno", "mtf"} & {k["category"] for k in cards}


def test_horizon_under_one_year_gives_only_low_tier():
    x = ctx(horizon_years=0.5)
    for cat, meta in catalogue().items():
        ok, _ = R.check(cat, x)
        if ok and meta["tier"] != "Credit":
            assert meta["tier"] == "Low", cat


def test_new_user_no_individual_stocks():
    x = ctx(track="new", has_behaviour=False)
    assert R.check("direct_equity", x)[0] is False
    assert R.check("us_stocks", x)[0] is False
    assert R.check("las", x)[0] is False


def test_senior_age_caps_high_tier():
    assert R.check("direct_equity", ctx(age=65, revealed_risk=2, willingness=4))[0] is False


def test_revealed_risk_mismatch_low_only():
    x = ctx(age=61, revealed_risk=4, willingness=2, capacity=2, horizon_years=2)
    assert R.max_tier(x)[0] == "Low"


def test_held_category_not_recommended_and_overconcentration():
    assert R.check("gold_etf", ctx(held={"gold_etf"}))[0] is False
    assert R.check("thematic_smallcase", ctx(overweight_sectors=["Auto"]))[0] is False


def test_min_cohort_hides_statistic():
    m = model()
    small = {**m, "adoption": {k: {**v, "n": 10} for k, v in m["adoption"].items()}}
    p = R.peers(small, 0, set())
    assert p["enough"] is False and "Not enough data" in p["message"]
