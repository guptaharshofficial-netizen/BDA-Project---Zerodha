import pytest

from yourbroker import calculator as C, risk
from yourbroker.profile import band, pct_from_grid, quiz_profile


def test_quiz_mapping_rohan():
    p = quiz_profile({"check_frequency": "daily", "invest_style": "pick it myself", "market_fall_20pct": "buy more",
                      "horizon": "5+ years", "monthly_surplus": "5k-25k"})
    assert {k: p[k] for k in ("activity", "automation", "risk", "capacity")} == {"activity": 4, "automation": 1, "risk": 4, "capacity": 2}


def test_quiz_missing_answer_raises():
    with pytest.raises(ValueError):
        quiz_profile({"check_frequency": "daily"})


def test_quartile_banding():
    assert [band(x) for x in (0.0, 0.24, 0.25, 0.5, 0.74, 0.75, 1.0)] == [1, 1, 2, 3, 3, 4, 4]
    grid = [0.0] * 50 + [1.0] * 51  # heavy ties at zero
    assert band(pct_from_grid(0.0, grid)) == 1


def test_lumpsum_and_sip_maths():
    assert C.lumpsum_fv(100000, 10, 5) == pytest.approx(161051.0, rel=1e-6)
    i = 1.10 ** (1 / 12) - 1
    manual = 5000 * (((1 + i) ** 60 - 1) / i) * (1 + i)
    assert C.sip_fv(5000, 10, 5) == pytest.approx(manual)
    assert C.sip_fv(1000, 0, 1) == pytest.approx(12000)


def test_projection_range_and_target():
    p = C.project([{"name": "x", "assumption_key": "equity_large", "amount": 100000}], 5, target_pct=50)
    t = p["total"]
    assert t["conservative"] < t["base"] < t["optimistic"]
    assert p["target"]["position"] == "above"
    assert "Past performance" in p["disclaimer"]


def test_trailing_figure_is_not_the_expected_return():
    r = C.project_item({"name": "s", "assumption_key": "direct_equity", "amount": 1000, "last_1y": 80.0}, 1)
    assert r["last_1y_label"].startswith("last 1Y actual")
    assert all(v["rate_pct"] != 80.0 for v in r["scenarios"].values())


def test_risk_bands_and_components():
    assert [risk.score_to_band(x) for x in (0, 24.9, 25, 50, 74.9, 75, 100)] == [1, 1, 2, 3, 3, 4, 4]
    low = {"by_tier": {"Low": 100}, "hhi_portfolio": 0, "hhi_benchmark": 0.1, "equity_total": 0, "top_stock": None}
    assert risk.compute(low, 7, 4)["score"] == 0
    hi = {"by_tier": {"High": 100}, "hhi_portfolio": 1.0, "hhi_benchmark": 0.1, "equity_total": 100,
          "top_stock": {"symbol": "A", "weight": 1.0}}
    r = risk.compute(hi, 0.5, 1)
    assert r["score"] == 96.2 and r["band_name"] == "High"  # 0.45*100 + 0.25*100 + 0.15*100 + 0.15*(100-25)
    assert risk.compute(hi, 7, 4)["score"] < r["score"]  # horizon and capacity mismatch add risk
