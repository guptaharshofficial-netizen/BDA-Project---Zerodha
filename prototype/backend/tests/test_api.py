from fastapi.testclient import TestClient

from yourbroker.api import app

c = TestClient(app)


def test_consent_gate_and_withdrawal():
    sid = c.post("/api/session").json()["session"]
    r = c.post("/api/existing", json={"session": sid, "user_id": "U01"})
    assert r.status_code == 403
    for p in ("profile", "portfolio"):
        c.post("/api/consent", json={"session": sid, "permission": p, "granted": True})
    r = c.post("/api/existing", json={"session": sid, "user_id": "U01"})
    assert r.status_code == 200 and r.json()["recommendations"]["cards"]
    c.post("/api/consent", json={"session": sid, "permission": "portfolio", "granted": False})
    assert c.post("/api/existing", json={"session": sid, "user_id": "U01"}).status_code == 403
    log = c.get(f"/api/consent/{sid}").json()["log"]
    assert any(e["event"] == "consent_withdrawn" for e in log)
    assert all(sid not in str(e) for e in log)  # identifiers are masked


def test_analytics_off_by_default_and_meta():
    sid = c.post("/api/session").json()["session"]
    assert c.get(f"/api/consent/{sid}").json()["consents"]["analytics"] is False
    m = c.get("/api/meta").json()
    assert m["data_asof"] == "2026-10-30" and len(m["test_users"]) == 7


def test_explore_and_calc():
    e = c.get("/api/explore", params={"kind": "stock", "sector": "IT"}).json()
    assert len(e["rows"]) <= 10 and e["label"].startswith("Past performance")
    r = c.post("/api/calc", json={"items": [{"kind": "stock", "id": e["rows"][0]["id"], "amount": 10000}], "years": 3}).json()
    assert r["rows"][0]["last_1y_label"].startswith("last 1Y actual")
