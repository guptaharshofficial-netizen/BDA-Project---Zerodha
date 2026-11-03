"""Granular, withdrawable consent (DPDP Rule 3) and an append-only audit log (FR-01, FR-17, FR-18)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
from datetime import datetime, timezone

from .common import config, path

PERMISSIONS = {
    "profile": {"label": "Profile information", "purpose": "Build your four-number profile and check suitability.",
                "stops": "Quiz, profile and suitability analysis stop. Learning content stays available."},
    "portfolio": {"label": "Linked Kite and Coin data",
                  "purpose": "Analyse the holdings, positions and SIPs you allowed Zerodha to share, compute your behavioural profile, place you in a peer group.",
                  "stops": "Portfolio analysis, clustering and peer comparisons stop; your holdings are dropped from this session."},
    "tracking": {"label": "Activity in other apps and websites (background tracking)",
                 "purpose": "Would let the app use what you do in other apps and websites, for example for ads. You choose: 'Ask app not to track' (default) or 'Allow'. Even if allowed, this prototype collects nothing and the model never uses it.",
                 "stops": "Nothing changes: tracking is off and your analysis is the same either way."},
    "analytics": {"label": "Product-usage analytics (optional)",
                  "purpose": "Improve the product. Off by default and NOT used by the model.",
                  "stops": "Nothing changes in your analysis; it is never used by the model."},
}
NOTICE = {
    "data_categories": ["Profile answers (activity, investing style, scenario response, horizon, monthly surplus)",
                        "Optional suitability details (age, income range, spending band, EMIs, assets held elsewhere)",
                        "Holdings, SIPs and transaction summaries from Kite, Coin and smallcase (existing users)"],
    "purposes": ["Profile and cluster placement", "Suitability checks and guardrails", "Portfolio analysis and learning content"],
    "ai_use": "Numbers, scores and suggestions come from deterministic, versioned rules. An optional AI summary only rephrases those results and may not add products, prices or returns.",
    "recipients": "No one. Nothing is sent back to Zerodha, and no third party receives your data.",
    "promise": "We never suggest F&O or margin trading (MTF), and nothing above Low risk when your goal is under one year away.",
    "retention": "While your account is open, then deleted, except records SEBI requires an adviser to keep (risk profile, suggestions shown, consents) for 5 years. This prototype keeps data in memory for the session only.",
    "withdraw": "Turn any permission off on the 'Consent and data' page. Withdrawing is as easy as giving consent.",
    "not_used": "Gender, payment method and app-browsing / clickstream are never used for clustering, suitability or ranking.",
    "tracking": ("Background tracking is a separate, optional choice, never bundled with the service (DPDP Act 2023, s.6: consent must be free, "
                 "specific, informed, unconditional and unambiguous, with a clear affirmative action, and as easy to withdraw as to give; s.6(4)). "
                 "Saying no never limits the app. The choice mirrors the phone-level 'Ask App Not to Track' prompt."),
    "commencement": "DPDP Rules 2025: Rule 4 commences 13 Nov 2026; Rules 3 and 5–16 on 13 May 2027 (per BRD §13.3).",
}

# The adviser behind Tulana (placeholders where a real registration would go)
RIA = {
    "name": "Tulana Advisory Pvt Ltd",
    "status": "SEBI Registered Investment Adviser",
    "reg_no": "INA000XXXXXX",
    "principal_officer": "[Principal Officer name]",
    "grievance_officer": "[Grievance officer name, email]",
    "dpo": "[Data protection contact email]",
    "terms_version": "T-2026-11-v1",
    "disclaimer": ("Registration granted by SEBI and certification from NISM in no way guarantee performance of the "
                   "intermediary or provide any assurance of returns to investors. Investments in securities market "
                   "are subject to market risks. Read all the related documents carefully before investing."),
    "funding": ("Tulana is free. Its running costs are met under an arm's-length agreement with the Zerodha group, "
                "approved by both boards. Tulana earns nothing from your trades, SIPs or the platform you choose."),
}

_lock = threading.Lock()
SESSIONS: dict[str, dict] = {}


def new_session() -> str:
    sid = secrets.token_hex(8)
    SESSIONS[sid] = {"consents": {k: False for k in PERMISSIONS}, "data": {}}
    log(sid, "session_start", {})
    return sid


def get(sid: str) -> dict:
    if sid not in SESSIONS:
        SESSIONS[sid] = {"consents": {k: False for k in PERMISSIONS}, "data": {}}
    return SESSIONS[sid]


def mask(sid: str) -> str:
    return sid[:2] + "••••" + sid[-2:]


def consent_id(sid: str, perm: str) -> str:
    """Stable ID for this session's consent to one permission under the current notice (works across server copies)."""
    v = config()["versions"]["notice_version"]
    return "TC-" + hashlib.sha256(f"{sid}|{perm}|{v}".encode()).hexdigest()[:8]


def consent_ids(sid: str) -> dict:
    return {k: consent_id(sid, k) for k, on in get(sid)["consents"].items() if on}


def set_consent(sid: str, perm: str, granted: bool) -> dict:
    s = get(sid)
    s["consents"][perm] = granted
    if not granted:
        if perm in ("portfolio", "profile"):
            s["data"].pop("existing", None)
        if perm == "profile":
            s["data"].pop("new", None)
    log(sid, "consent_granted" if granted else "consent_withdrawn",
        {"permission": perm, "consent_id": consent_id(sid, perm), "purpose": PERMISSIONS[perm]["purpose"],
         "notice_version": config()["versions"]["notice_version"]})
    return s["consents"]


def log(sid: str, event: str, detail: dict) -> None:
    rec = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "session": mask(sid), "event": event,
           **detail, "model_version": config()["versions"]["model_version"], "rules_version": config()["versions"]["rules_version"]}
    with _lock:
        with open(path("audit_log"), "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def read_log(sid: str, limit: int = 50) -> list[dict]:
    p = path("audit_log")
    if not p.exists():
        return []
    m = mask(sid)
    out = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
    return [r for r in out if r.get("session") == m][-limit:]


# --- Stateless consent token -------------------------------------------------------------------
# Serverless hosts run several copies of the app that don't share memory. After every consent change the
# browser gets a signed token (session id + its consents); it sends it back on each call so any copy can
# restore the same permissions. The signature stops a browser from granting itself permissions it never gave.
def _secret() -> bytes:
    return (os.environ.get("CONSENT_SECRET") or "yourbroker-demo-only-secret").encode()


def token(sid: str) -> str:
    body = base64.urlsafe_b64encode(json.dumps({"s": sid, "c": get(sid)["consents"]}, sort_keys=True).encode()).decode()
    sig = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{sig}"


def restore(tok: str | None) -> None:
    """Re-create a session's consents from a valid token if this copy of the app hasn't seen it."""
    if not tok or "." not in tok:
        return
    body, sig = tok.rsplit(".", 1)
    if not hmac.compare_digest(sig, hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()[:32]):
        return
    try:
        d = json.loads(base64.urlsafe_b64decode(body.encode()))
    except Exception:
        return
    sid, cons = d.get("s"), d.get("c") or {}
    if not sid:
        return
    s = get(sid)
    for k in PERMISSIONS:
        s["consents"][k] = bool(cons.get(k, False))
