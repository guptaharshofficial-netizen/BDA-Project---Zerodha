"""Separate-adviser setup: consent IDs, recorded user events, the Kite-link gate and 'prefer not to say'."""
from fastapi.testclient import TestClient

from yourbroker.api import app

c = TestClient(app)
QUIZ = {"market_fall_20pct": "Hold", "check_frequency": "Weekly", "invest_style": "Mix", "horizon": "5+ years",
        "monthly_surplus": "5k-25k"}


def _sid(*perms):
    sid = c.post("/api/session").json()["session"]
    for p in perms:
        c.post("/api/consent", json={"session": sid, "permission": p, "granted": True})
    return sid


def test_meta_names_the_adviser_and_promise():
    m = c.get("/api/meta").json()
    assert m["ria"]["status"].startswith("SEBI") and m["ria"]["terms_version"]
    assert "F&O" in m["notice"]["promise"]
    assert "Zerodha" in m["notice"]["recipients"]


def test_consent_ids_are_stable_and_logged():
    sid = _sid("profile")
    ids = c.get(f"/api/consent/{sid}").json()["consent_ids"]
    assert ids["profile"].startswith("TC-") and "portfolio" not in ids
    r = c.post("/api/consent", json={"session": sid, "permission": "profile", "granted": True}).json()
    assert r["consent_ids"]["profile"] == ids["profile"]
    a = c.post("/api/new", json={"session": sid, "quiz": QUIZ}).json()
    assert a["consent_ids"]["profile"] == ids["profile"]


def test_events_whitelisted_and_free_text_dropped():
    sid = _sid("profile")
    assert c.post("/api/event", json={"session": sid, "event": "made_up"}).status_code == 400
    r = c.post("/api/event", json={"session": sid, "event": "grievance_raised",
                                   "detail": {"about": "data", "free_text": "my phone is 98..."}}).json()
    assert r["ref"].startswith("TUL-")
    log = c.get(f"/api/consent/{sid}").json()["log"]
    rec = [x for x in log if x["event"] == "grievance_raised"][-1]
    assert "free_text" not in rec and rec["about"] == "data"


def test_closing_account_withdraws_every_consent():
    sid = _sid("profile", "portfolio", "analytics")
    r = c.post("/api/event", json={"session": sid, "event": "account_closed"}).json()
    assert not any(r["consents"].values())


def test_activity_profile_switch_needs_kite_link_consent():
    sid = _sid("profile")
    assert c.post("/api/new", json={"session": sid, "quiz": QUIZ, "simulate_history": True}).status_code == 403


def test_prefer_not_to_say_uses_middle_capacity_band():
    sid = _sid("profile")
    money = {"monthly_income": 0, "monthly_spending": 0, "undisclosed": 1, "invest_monthly": 5000}
    a = c.post("/api/new", json={"session": sid, "quiz": QUIZ, "money": money}).json()
    assert a["capacity_default"] is True
    assert a["quiz"]["monthly_surplus"] == "5k-25k"
