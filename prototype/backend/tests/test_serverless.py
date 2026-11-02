"""Serverless hosting: consents survive a different app copy (fresh memory), forged tokens don't, and writes go to /tmp."""
from fastapi.testclient import TestClient

from yourbroker import consent_audit as ca
from yourbroker.api import app

c = TestClient(app)


def test_consent_token_survives_a_fresh_instance():
    r = c.post("/api/session").json()
    sid, tok = r["session"], r["token"]
    for p in ("profile", "portfolio"):
        tok = c.post("/api/consent", json={"session": sid, "permission": p, "granted": True}, headers={"X-Consent-Token": tok}).json()["token"]
    ca.SESSIONS.clear()  # another copy of the app: no memory of this session
    assert c.post("/api/existing", json={"session": sid, "user_id": "U01"}).status_code == 403  # no token, no data
    ca.SESSIONS.clear()
    assert c.post("/api/existing", json={"session": sid, "user_id": "U01"}, headers={"X-Consent-Token": tok}).status_code == 200


def test_forged_or_withdrawn_token_is_refused():
    r = c.post("/api/session").json()
    sid, tok = r["session"], r["token"]
    body, sig = tok.rsplit(".", 1)
    ca.SESSIONS.clear()
    import base64, json
    forged = base64.urlsafe_b64encode(json.dumps({"s": sid, "c": {"profile": True, "portfolio": True}}, sort_keys=True).encode()).decode()
    assert c.post("/api/existing", json={"session": sid, "user_id": "U01"}, headers={"X-Consent-Token": f"{forged}.{sig}"}).status_code == 403


def test_writable_dir_override(monkeypatch, tmp_path):
    from yourbroker import common
    monkeypatch.setenv("YB_WRITABLE_DIR", str(tmp_path))
    assert str(common.path("audit_log")).startswith(str(tmp_path))
    assert str(common.path("cache_dir")).startswith(str(tmp_path))
    assert not str(common.path("artifacts_dir")).startswith(str(tmp_path))
