from yourbroker import service, summary, synthetic, testcases


def test_all_persona_behaviours():
    failed = [r for r in testcases.run_all() if not r["passed"]]
    assert not failed, failed


def test_deterministic_outputs():
    a1 = service.analyse_existing("U02")
    a2 = service.analyse_existing("U02")
    assert a1["recommendations"]["cards"] == a2["recommendations"]["cards"]
    p1 = synthetic.generate(n=200, seed=5)
    p2 = synthetic.generate(n=200, seed=5)
    assert p1.drop(columns=["holdings"]).equals(p2.drop(columns=["holdings"]))
    assert list(p1["holdings"]) == list(p2["holdings"])


def test_summary_sections_and_validator():
    a = service.analyse_existing("U01")
    s = summary.summarise(a)
    assert s["mode"] == "deterministic"
    assert list(s["sections"]) == ["Where you stand", "What stands out", "What investors like you do",
                                   "Things to be careful about", "What we don't know", "3 things to learn next"]
    f = summary.facts(a)
    assert summary.validate("Your risk score is 987654.", f)[0] is False
    assert summary.validate("Consider US stocks.", f)[0] is False
    assert summary.validate("You should buy this.", f)[0] is False
    assert summary.validate(s["sections"]["Where you stand"], f)[0] is True


def test_presentation_profiles_land_in_their_segments_and_stay_out_of_training():
    """The five presentation profiles cover all four segments; the two added ones are excluded from training."""
    from yourbroker import service, synthetic
    m = service.model()
    seg = {u: service.analyse_existing(u)["persona"]["name"] for u in ("U01", "U02", "U05", "U07")}
    assert seg == {"U01": "Systematic Saver", "U02": "Active Trader", "U05": "Dormant / Just-in-time", "U07": "Income Preserver"}
    ob = service.test_user("U06")["onboarding"]
    quiz = {**{k: v for k, v in ob["answers"].items()}, "horizon": ob["horizon"], "monthly_surplus": "5k-25k"}
    new = service.analyse_new(quiz, {"age": 31}, money={**ob["money"], "outside": ob["outside"]})
    assert new["persona"]["name"] == "Systematic Saver"
    assert new["capacity_suitability"] == 2  # the home-loan EMI pulls capacity down one band
    assert set(synthetic.test_users_frame()["user_id"]) == {"U01", "U02", "U03", "U05"}
    assert m["n_users"] == 3004
