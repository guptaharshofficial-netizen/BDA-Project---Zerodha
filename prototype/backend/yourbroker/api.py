"""FastAPI app. Serves the JSON API under /api and the built UI from frontend/dist."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import calculator, consent_audit as ca, learn, news, portfolio, service, summary, testcases
from .common import PROTO, SECTORS, catalogue, config, load_yaml, read_json, versions
from .profile import QUIZ_OPTIONS

app = FastAPI(title="Tulana Portfolio Navigator (academic prototype)")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


def _need(sid: str, perm: str) -> None:
    if not ca.get(sid)["consents"].get(perm):
        raise HTTPException(403, f"Permission '{perm}' not granted. Nothing personal is read before consent.")


@app.get("/api/meta")
def meta() -> dict:
    users = [{"id": u["id"], "name": u["name"], "track": u["track"], "age": u["age"], "platforms": u.get("platforms", []),
              "quiz": u.get("quiz")}
             for u in load_yaml("test_users.yaml")["users"]]
    dq = read_json("data_quality.json")
    return {**versions(), "notice_version": config()["versions"]["notice_version"], "permissions": ca.PERMISSIONS,
            "notice": ca.NOTICE, "test_users": users, "quiz_options": QUIZ_OPTIONS, "catalogue": catalogue(),
            "sectors": SECTORS, "data_quality": dq, "thresholds": config()["recommender"] | config()["guardrails"],
            "llm_available": bool(__import__("os").environ.get("ANTHROPIC_API_KEY")),
            "app_links": config().get("app_links") or {}, "indices": _ticker(), "ria": ca.RIA}


def _ticker() -> list[dict]:
    idx = portfolio.market()["indices"]
    return [{"name": k, "ltp": idx[k]["ltp"], "chg_30d": idx[k]["chg_30d"], "chg_365d": idx[k]["chg_365d"]}
            for k in ("NIFTY 50", "NIFTY BANK", "NIFTY 500", "NIFTY MIDCAP 100") if k in idx]


@app.middleware("http")
async def _restore_consent(request: Request, call_next):
    # serverless: this copy of the app may not have seen the session yet (see consent_audit.token)
    ca.restore(request.headers.get("x-consent-token"))
    return await call_next(request)


@app.post("/api/session")
def session() -> dict:
    sid = ca.new_session()
    return {"session": sid, "token": ca.token(sid)}


class ConsentIn(BaseModel):
    session: str
    permission: str
    granted: bool


@app.post("/api/consent")
def consent(c: ConsentIn) -> dict:
    if c.permission not in ca.PERMISSIONS:
        raise HTTPException(400, "unknown permission")
    return {"consents": ca.set_consent(c.session, c.permission, c.granted), "consent_ids": ca.consent_ids(c.session),
            "token": ca.token(c.session)}


@app.get("/api/consent/{sid}")
def consent_state(sid: str) -> dict:
    return {"consents": ca.get(sid)["consents"], "consent_ids": ca.consent_ids(sid), "log": ca.read_log(sid)}


# User actions that must be on the record (DPDP / SEBI IA record keeping). Free text is never stored.
EVENTS = {"kite_link_allowed", "kite_link_declined", "kite_link_disconnected", "signup_completed", "service_choice",
          "profile_accepted", "terms_accepted", "suggestion_dismissed", "suggestion_feedback", "suggestions_off",
          "suggestions_on", "handoff", "grievance_raised", "data_request", "account_closed"}
SAFE_KEYS = {"category", "value", "app", "target", "kind", "request", "about", "version", "profile_version", "band"}


class EventIn(BaseModel):
    session: str
    event: str
    detail: dict[str, Any] | None = None


@app.post("/api/event")
def event(e: EventIn) -> dict:
    if e.event not in EVENTS:
        raise HTTPException(400, "unknown event")
    d = {k: str(v)[:60] for k, v in (e.detail or {}).items() if k in SAFE_KEYS}
    ref = None
    if e.event == "grievance_raised":
        ref = "TUL-" + __import__("hashlib").sha256(f"{e.session}{len(ca.read_log(e.session))}".encode()).hexdigest()[:6].upper()
        d["ticket"] = ref
    if e.event == "account_closed":
        for p in ("profile", "portfolio", "analytics", "tracking"):
            ca.set_consent(e.session, p, False)
    ca.log(e.session, e.event, {**d, "consent_ids": ca.consent_ids(e.session)})
    return {"ok": True, "ref": ref, "consents": ca.get(e.session)["consents"], "token": ca.token(e.session)}


class ExistingIn(BaseModel):
    session: str
    user_id: str
    surface: str = "All"
    goals: list[dict] | None = None
    suitability: dict | None = None
    declared: list[dict] | None = None


@app.post("/api/existing")
def existing(x: ExistingIn) -> dict:
    _need(x.session, "profile")
    _need(x.session, "portfolio")
    a = service.analyse_existing(x.user_id, x.surface, x.goals, x.suitability, x.declared)
    ca.log(x.session, "analysis_existing", {"user": f"YB••••{x.user_id[-2:]}", "surface": x.surface,
                                            "cards": [c["category"] for c in a["recommendations"]["cards"]],
                                            "consent_ids": ca.consent_ids(x.session)})
    a["consent_ids"] = ca.consent_ids(x.session)
    return a


class NewIn(BaseModel):
    session: str
    quiz: dict
    suitability: dict | None = None
    basket: list[dict] | None = None
    budget: float | None = None
    simulate_history: bool = False
    money: dict | None = None


@app.post("/api/new")
def new_user(x: NewIn) -> dict:
    _need(x.session, "profile")
    if x.simulate_history:  # the switch to an activity-based profile adds a new data source: needs the Kite link consent
        _need(x.session, "portfolio")
    try:
        a = service.analyse_new(x.quiz, x.suitability, x.basket, x.budget, x.simulate_history, x.money)
    except ValueError as e:
        raise HTTPException(400, str(e))
    ca.log(x.session, "analysis_new", {"profile": a["profile"], "cards": [c["category"] for c in a["recommendations"]["cards"]],
                                       "consent_ids": ca.consent_ids(x.session)})
    a["consent_ids"] = ca.consent_ids(x.session)
    return a


@app.get("/api/search")
def search(q: str = "", kind: str = "all") -> list[dict]:
    q = q.strip().lower()
    if len(q) < 2:
        return []
    mk = portfolio.market()
    out = []
    if kind in ("all", "stock"):
        for s in mk["stocks"]:
            if not s.get("in_NIFTY_500"):
                continue
            nm = (s.get("company") or s["symbol"])
            if q in s["symbol"].lower() or q in nm.lower():
                out.append({"kind": "stock", "id": s["symbol"], "name": nm, "sub": f"{s['symbol']} · {s['sector']}", "ret_1y": s.get("chg_365d")})
    if kind in ("all", "fund"):
        for f in mk["funds"]:
            if q in f["name"].lower():
                out.append({"kind": "fund", "id": f["scheme_code"], "name": f["name"].replace(" - Direct Plan - Growth", ""),
                            "sub": f.get("category_short", ""), "ret_1y": None})
    out.sort(key=lambda r: (not r["name"].lower().startswith(q), r["kind"] != "stock", r["name"]))
    return out[:20]


@app.get("/api/fund_groups")
def fund_groups() -> list[dict]:
    return service.fund_groups()


@app.get("/api/sectors")
def sectors() -> dict:
    return service.sector_view()


@app.get("/api/explore")
def explore(kind: str = "stock", sector: str | None = None, category: str | None = None, sort: str = "return", limit: int = 10) -> dict:
    return service.explore(kind, sector, category, sort, max(1, min(limit, 50)))


@app.get("/api/news")
def get_news(kind: str = "sector", name: str = "", symbol: str | None = None) -> dict:
    if kind not in ("sector", "stock") or not (name or symbol):
        raise HTTPException(400, "kind must be sector or stock, with a name")
    return news.headlines(kind, name, symbol)


class CalcIn(BaseModel):
    items: list[dict]
    years: float
    target_pct: float | None = None


@app.post("/api/calc")
def calc(c: CalcIn) -> dict:
    items = []
    for it in c.items[:20]:
        if it["kind"] == "stock":
            s = portfolio.stock(it["id"])
            if not s:
                continue
            items.append({"name": s.get("company") or s["symbol"], "assumption_key": "direct_equity",
                          "amount": it.get("amount", 0), "sip": it.get("sip", 0), "last_1y": s.get("chg_365d")})
        else:
            f = portfolio.fund(it["id"])
            if not f:
                continue
            items.append({"name": f["name"], "assumption_key": f["assumption_key"], "amount": it.get("amount", 0),
                          "sip": it.get("sip", 0), "history": calculator.nav_history(f["scheme_code"])})
    return calculator.project(items, c.years, c.target_pct)


class WhatIfIn(BaseModel):
    session: str
    user_id: str | None = None
    current: list[dict] = []
    add: dict | list[dict]
    years: float = 5
    horizon: float | None = None
    capacity: int | None = None


@app.post("/api/whatif")
def whatif(w: WhatIfIn) -> dict:
    cur = w.current
    if w.user_id:
        _need(w.session, "portfolio")
        cur = portfolio.demo_holdings(w.user_id)["holdings"]
    try:
        return service.whatif(w.user_id, cur, w.add, w.years, w.horizon, w.capacity)
    except (ValueError, KeyError, LookupError) as e:
        raise HTTPException(400, f"Couldn't run the what-if: {e}")


class SummaryIn(BaseModel):
    session: str
    analysis: dict[str, Any]
    use_llm: bool = False


@app.post("/api/summary")
def summarise(s: SummaryIn) -> dict:
    out = summary.summarise(s.analysis, s.use_llm)
    ca.log(s.session, "ai_summary", {"mode": out["mode"], "inputs": out["inputs"]})
    return out


@app.get("/api/learn")
def lessons() -> list[dict]:
    return learn.lessons()


@app.get("/api/evaluation")
def evaluation() -> dict:
    m = read_json("model.json")
    keep = ["k", "k_selection_rows", "k_meta", "k_rule", "clusters", "centroids_band", "stability", "evaluation",
            "business_view", "persona_vectors", "scatter_sample", "n_users", "band_distribution",
            "model_version", "rules_version", "data_asof"]
    return {**{k: m[k] for k in keep}, "test_users": read_json("test_user_profiles.json"),
            "future_work": ["Fuzzy clustering (Yang 2024) for users between personas", "Self-organising maps (Kovács et al. 2021)"],
            "synthetic_note": "The population is SYNTHETIC. Thresholds (30% adoption) and quartile cut-points must be re-derived on real data."}


@app.get("/api/testcases")
def tcs() -> list[dict]:
    return testcases.run_all()


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, **versions()}


DIST = PROTO / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        f = DIST / full_path
        if full_path and f.is_file():
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
