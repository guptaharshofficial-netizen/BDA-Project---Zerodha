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
