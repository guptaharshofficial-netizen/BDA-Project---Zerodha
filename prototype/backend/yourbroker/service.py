"""Builds the full analysis JSON for the existing-user and new-user journeys."""
from __future__ import annotations

from functools import lru_cache

from . import clustering, context_provider, portfolio, recommender, risk
from .calculator import project
from .common import SECTORS, catalogue, config, load_yaml, read_json, versions
from .profile import (ALREADY_HOLDS_MAP, DIMS, HORIZON_YEARS, QUIZ_MAP, SURPLUS_INR, computed_profile,
                      norm, quiz_profile, risk_willingness)

SOURCE_STATUS = {
    "Kite": {"what": "Equity holdings, positions (F&O shown as overlay)", "refreshed": "30 Oct 2026, 15:30 IST", "quality": "Snapshot"},
    "Coin": {"what": "Mutual-fund holdings and SIPs", "refreshed": "30 Oct 2026, 15:30 IST", "quality": "Snapshot; MF orders limited to last 7 days"},
    "smallcase": {"what": "Basket holdings", "refreshed": "30 Oct 2026, 15:30 IST", "quality": "Illustrative look-through"},
}
ANALYSIS_BASIS = ("Holdings snapshot as of 30 Oct 2026. A snapshot supports allocation and concentration analysis, "
                  "not lifetime returns, holding periods or tax-lot analysis.")


@lru_cache(maxsize=1)
def model() -> dict:
    return read_json("model.json")


def reload() -> None:
    model.cache_clear()
    portfolio.clear_cache()


def test_user(uid: str) -> dict:
    return next(u for u in load_yaml("test_users.yaml")["users"] if u["id"] == uid)


def suitability_capacity(suit: dict, horizon_years: float | None) -> tuple[int | None, list[str]]:
    """Risk capacity from surplus, EMIs, emergency buffer and horizon (FR-04). Kept separate from willingness."""
    notes = []
    s = norm(suit.get("monthly_surplus", "")) if suit else ""
    if s not in QUIZ_MAP["monthly_surplus"]["map"]:
        return None, ["monthly surplus not given"]
    cap = QUIZ_MAP["monthly_surplus"]["map"][s]
    notes.append(f"Monthly surplus band {suit['monthly_surplus']} → {cap}")
    emi = float(suit.get("emi_inr") or 0)
    if emi > 0.5 * SURPLUS_INR[s]:
        cap -= 1
        notes.append(f"EMIs ₹{emi:,.0f} exceed half the surplus band midpoint → −1")
    em = suit.get("emergency_months")
    if em is not None and float(em) < 1:
        cap -= 1
        notes.append("Emergency buffer under one month → −1")
    if horizon_years is not None and horizon_years < 3:
        cap -= 1
        notes.append("Goal horizon under 3 years → −1")
    return max(1, min(4, cap)), notes


def grid_positions(bands: dict) -> dict:
    return {"grid1": {"x": bands["activity"], "y": bands["automation"], "x_label": "Activity", "y_label": "Automation"},
            "grid2": {"x": bands["risk"], "y": bands["capacity"], "x_label": "Risk appetite", "y_label": "Capacity"}}


def persona_info(cl: int) -> dict:
    m = model()
    c = m["clusters"][cl]
    return {"cluster": cl, "name": c["name"], "matched": c["matched"], "description": c["description"],
            "size": m["adoption"][str(cl)]["n"], "centroid_band": m["centroids_band"][cl],
            "distance": c["distance"], "persona_vectors": m["persona_vectors"]}


def sector_view() -> list[dict]:
    mk = portfolio.market()
    b = mk["indices"]["NIFTY 500"]
    rows = []
    for s in mk["sector_stats"]:
        if not s.get("n"):
            continue
        rows.append({**s, "context": context_provider.for_sector(s["sector"])})
    rows.sort(key=lambda r: -(r.get("median_365d") or -999))
    return {"rows": rows, "benchmark": {"name": "NIFTY 500", "chg_30d": b["chg_30d"], "chg_365d": b["chg_365d"]},
            "label": "A past-performance screen, not a recommendation.",
            "method": "Median and equal-weighted mean of constituent 30-day and 365-day % change, from the index CSVs. Sectors under 8 constituents carry a small-sample caveat.",
            "mode": mk["equity_mode"], "asof": mk["asof"]}


def _goal_fit(goals: list[dict]) -> list[dict]:
    out = []
    for g in goals:
        yrs = float(g.get("years") or 0)
        key = "debt" if yrs < 3 else "equity_flexi"
        pr = project([{"name": g["name"], "assumption_key": key, "amount": 0, "sip": g.get("monthly", 0)}], yrs) if yrs > 0 else None
        if pr and pr["total_invested"] > 0:
            lo, hi = pr["total"]["conservative"], pr["total"]["optimistic"]
            tgt = float(g.get("target") or 0)
            pos = "inside" if lo <= tgt <= hi else ("below" if tgt < lo else "above")
            out.append({**g, "assumption_key": key, "range": [lo, pr["total"]["base"], hi], "position": pos,
                        "text": {"inside": "Target sits inside the illustrative range of planned contributions.",
                                 "below": "Target sits below the illustrative range.",
                                 "above": "Target sits above the illustrative range: planned contributions may fall short under these assumptions."}[pos]})
        else:
            out.append({**g, "range": None, "position": "n/a", "text": "No planned monthly contribution to project."})
    return out


def analyse_existing(uid: str, surface: str = "All", goals: list | None = None, suitability: dict | None = None,
                     declared: list | None = None) -> dict:
    u = test_user(uid)
    demo = portfolio.demo_holdings(uid)
    goals = goals if goals is not None else demo["goals"]
    suit = suitability if suitability is not None else demo["suitability"]
    holdings = list(demo["holdings"])
    for d in declared or []:
        holdings.append(portfolio.declared_holding(d["label"], d["category"], d["value"]))
    scope = holdings if surface == "All" else [h for h in holdings if h["surface"] == surface]

    feats = {"trades_per_month": u["trades_per_month"], "days_since_last_txn": u["days_since_last_txn"],
             "sip_share": u["sip_share_of_inflows"], "high_risk_share": u["high_risk_share"],
             "aum_inr": u["aum_inr"], "monthly_inflow_inr": u["monthly_inflow_inr"]}
    prof = computed_profile(feats, model())
    cl = clustering.assign(prof["_continuous"], model())
    bands = {d: prof[d] for d in DIMS}

    prio = sorted(goals, key=lambda g: g.get("priority", 9))
    horizon = float(prio[0]["years"]) if prio else None
    willingness = risk_willingness(suit["market_fall_20pct"]) if suit.get("market_fall_20pct") else None
    capacity, cap_notes = suitability_capacity(suit, horizon)
    missing = [m for m, v in (("goal horizon", horizon), ("monthly surplus", capacity)) if v is None]

    held = {h["category"] for h in holdings}
    if demo.get("fno_overlay"):
        held.add("fno")
    an = portfolio.analyse(scope)
    an_all = portfolio.analyse(holdings)
    conc = portfolio.concentration_level(an) if not an.get("empty") else {"level": "n/a"}
    ex = recommender.explore_sectors(an_all)
    ctx = recommender.Ctx(track="existing", cluster=cl, cluster_name=model()["clusters"][cl]["name"], held=held,
                          age=u.get("age"), horizon_years=horizon, willingness=willingness, capacity=capacity,
                          revealed_risk=bands["risk"], has_behaviour=True, idle_cash=demo.get("idle_cash_inr", 0),
                          sip_stopped=any(h.get("sip_status", "").startswith("stopped") for h in holdings),
                          sip_status_text=next((h["sip_status"].replace("stopped", "paused since") for h in holdings
                                                if h.get("sip_status", "").startswith("stopped")), ""),
                          equity_value=sum(h["value"] for h in holdings if h["category"] == "direct_equity"),
                          overweight_sectors=ex["over_concentrated"], missing=missing)
    recs = recommender.recommend(ctx, model())
    rs = risk.compute(an, horizon, capacity) if not an.get("empty") else None
    gaps = risk.gaps(rs["band"], willingness, capacity) if rs else None
    held_sectors = [s for s in SECTORS if an.get("sector_mix", {}).get(s, 0) >= 2]
    sv = sector_view()
    trends = [r for r in sv["rows"] if r["sector"] in held_sectors]
    flags = []
    if an_all.get("psu_bank_weight", 0) >= 0.3:
        flags.append(f"{an_all['psu_bank_weight'] * 100:.0f}% of the portfolio is in PSU bank stocks.")
    if an_all.get("high_risk_share", 0) >= 0.95:
        flags.append("100% of the portfolio is in High-tier products.")
    if recs.get("revealed_mismatch"):
        flags.append(f"Revealed risk from holdings (band {bands['risk']}) is well above your stated willingness ({willingness}) at this life stage.")
    sources = {p: {**SOURCE_STATUS[p], "connected": p in u["platforms"]} for p in SOURCE_STATUS}
    out = {
        "track": "existing", "user": {"id": uid, "name": u["name"], "age": u["age"], "city": u["city"],
                                      "occupation": u["occupation"], "platforms": u["platforms"], "masked_id": f"YB••••{uid[-2:]}"},
        "surface": surface, "profile": bands, "profile_basis": "platform data (Track B)",
        "profile_continuous": prof["_continuous"], "expected_profile": u["expected_profile"],
        "features": feats, "persona": persona_info(cl), "grids": grid_positions(bands),
        "goals": goals, "goal_fit": _goal_fit(goals), "suitability": suit,
        "willingness": willingness, "capacity_suitability": capacity, "capacity_notes": cap_notes,
        "holdings": scope, "all_holdings_count": len(holdings), "analysis": an, "concentration": conc,
        "risk": rs, "risk_gaps": gaps, "explore_sectors": ex, "recommendations": recs,
        "peers": recommender.peers(model(), cl, held), "held_categories": sorted(held),
        "fno_overlay": demo.get("fno_overlay"), "idle_cash_inr": demo.get("idle_cash_inr", 0),
        "off_platform_declarable": demo.get("off_platform_declarable"), "declared": declared or [],
        "sector_trends": trends, "flags": flags, "sources": sources, "analysis_basis": ANALYSIS_BASIS,
        "data_modes": {"equity": portfolio.market()["equity_mode"], "funds": portfolio.market()["nav_mode"],
                       "population": "synthetic", "holdings": "illustrative"},
        **versions(),
    }
    if uid == "U03" and not declared:
        out["unknowns"] = ["Bank FDs of about ₹22 lakh are held outside this platform and are not visible. Declare them to re-run the analysis."]
    return out


OUTSIDE_TYPES = {"fd": ("Fixed deposits", "fd"), "mf": ("Mutual funds", "core_mf_sip"), "stocks": ("Stocks", "direct_equity"),
                 "gold": ("Gold", "gold_etf"), "ppf_nps": ("PPF / NPS / EPF", "nps"), "real_estate": ("Property", None),
                 "other": ("Other", None)}


def surplus_band(amount: float) -> str:
    return "<5k" if amount < 5000 else "5k-25k" if amount < 25000 else "25k-1L" if amount < 100000 else "1L+"


def money_summary(money: dict) -> dict:
    inc = float(money.get("monthly_income") or 0)
    spend = float(money.get("monthly_spending") or 0)
    emi = float(money.get("emi") or 0)
    left = max(0.0, inc - spend - emi)
    savings = float(money.get("bank_savings") or 0)
    outside = {k: float(v or 0) for k, v in (money.get("outside") or {}).items() if float(v or 0) > 0}
    return {"monthly_income": inc, "monthly_spending": spend, "emi": emi, "left_each_month": left,
            "bank_savings": savings, "emergency_months": (savings / spend) if spend else None,
            "outside": [{"key": k, "label": OUTSIDE_TYPES.get(k, (k, None))[0], "amount": v} for k, v in outside.items()],
            "outside_total": sum(outside.values()),
            "invest_lumpsum": float(money.get("invest_lumpsum") or 0), "invest_monthly": float(money.get("invest_monthly") or 0),
            "monthly_invest_share_of_left": (float(money.get("invest_monthly") or 0) / left) if left else None}


def analyse_new(quiz: dict, suitability: dict | None = None, basket: list | None = None,
                budget: float | None = None, simulate_history: bool = False, money: dict | None = None) -> dict:
    suitability = dict(suitability or {})
    ms = None
    if money:
        ms = money_summary(money)
        quiz = {**quiz, "monthly_surplus": surplus_band(ms["left_each_month"])}
        suitability.setdefault("emi_inr", ms["emi"])
        if ms["emergency_months"] is not None:
            suitability.setdefault("emergency_months", ms["emergency_months"])
        quiz["already_holds"] = [OUTSIDE_TYPES[o["key"]][0] for o in ms["outside"] if o["key"] in OUTSIDE_TYPES] or ["None"]
        budget = budget or ms["invest_lumpsum"] or None
    prof = quiz_profile(quiz)
    bands = {d: prof[d] for d in DIMS}
    basis = "quiz (Track A)"
    simulated = None
    if simulate_history:
        sim = load_yaml("test_user_holdings.yaml").get("U04_simulated", {})
        if sim:
            cp = computed_profile(sim, model())
            simulated = {"features": sim, "profile": {d: cp[d] for d in DIMS}}
            bands = simulated["profile"]
            basis = "platform data after ~3 months (Track B, SIMULATED)"
    cl = clustering.assign_from_bands(bands, model())
    horizon = HORIZON_YEARS.get(quiz.get("horizon")) or {norm(k): v for k, v in HORIZON_YEARS.items()}.get(norm(quiz.get("horizon", "")))
    willingness = prof["_inputs"]["market_fall_20pct"]
    suit = {"monthly_surplus": quiz.get("monthly_surplus"), **suitability}
    capacity, cap_notes = suitability_capacity(suit, horizon)
    holds = quiz.get("already_holds") or []
    if isinstance(holds, str):
        holds = [holds]
    held = {ALREADY_HOLDS_MAP[norm(h)] for h in holds if norm(h) in ALREADY_HOLDS_MAP}
    if ms:
        held |= {OUTSIDE_TYPES[o["key"]][1] for o in ms["outside"] if OUTSIDE_TYPES.get(o["key"], (0, None))[1]}
        if ms["bank_savings"] and ms["emergency_months"] and ms["emergency_months"] >= 3:
            held.add("fd")  # 3+ months of expenses in the bank already acts as an emergency buffer

    items = []
    for b in basket or []:
        if b["kind"] == "stock":
            items.append(portfolio.make_stock_holding(b["id"], b["amount"]))
        else:
            items.append(portfolio.make_fund_holding(b["id"], b["amount"], b.get("sip", 0)))
    an = portfolio.analyse(items) if items else {"empty": True, "total": 0}
    rs = risk.compute(an, horizon, capacity) if items else None
    ex = recommender.explore_sectors(an) if items else {"little_or_no_exposure": sorted(SECTORS), "over_concentrated": []}
    ctx = recommender.Ctx(track="new", cluster=cl, cluster_name=model()["clusters"][cl]["name"],
                          held=held | {h["category"] for h in items}, age=suitability.get("age"),
                          horizon_years=horizon, willingness=willingness, capacity=capacity, revealed_risk=None,
                          has_behaviour=False, overweight_sectors=ex["over_concentrated"],
                          missing=[m for m, v in (("horizon", horizon), ("monthly surplus", capacity)) if v is None])
    recs = recommender.recommend(ctx, model())
    cap_share = config()["guardrails"]["new_user_direct_equity_cap"]
    de = sum(h["value"] for h in items if h["category"] == "direct_equity")
    bud = budget or suitability.get("lumpsum_budget") or (an.get("total") or 0)
    friction = None
    if bud and de / bud > cap_share:
        friction = (f"Individual stocks are {de / bud * 100:.0f}% of your stated budget, above the {cap_share * 100:.0f}% "
                    "limit set for new investors. With no investing history yet, a large share in single stocks adds "
                    "concentration and timing risk. You can still continue; this is a pause to check, not a block.")
    mismatch = None
    if willingness - (capacity or willingness) >= 2:
        mismatch = (f"Your answer to the market-fall question suggests high willingness ({willingness}), "
                    f"but your capacity to absorb loss is {capacity}. The tool uses the lower of the two. Would you like to review your answers?")
    return {
        "track": "new", "quiz": quiz, "money": ms, "profile": bands, "quiz_profile": {d: prof[d] for d in DIMS},
        "quiz_inputs": prof["_inputs"], "profile_basis": basis, "simulated_history": simulated,
        "persona": persona_info(cl), "grids": grid_positions(bands),
        "willingness": willingness, "capacity_suitability": capacity, "capacity_notes": cap_notes,
        "consistency_flag": mismatch, "horizon_years": horizon, "suitability": suitability,
        "basket": items, "analysis": an, "risk": rs,
        "risk_gaps": risk.gaps(rs["band"], willingness, capacity) if rs else None,
        "concentration": portfolio.concentration_level(an) if items else None,
        "explore_sectors": ex, "recommendations": recs, "peers": recommender.peers(model(), cl, ctx.held),
        "budget": bud, "direct_equity_share_of_budget": (de / bud) if bud else 0, "friction": friction,
        "sector_view": sector_view(), "held_categories": sorted(ctx.held),
        "data_modes": {"equity": portfolio.market()["equity_mode"], "funds": portfolio.market()["nav_mode"], "population": "synthetic"},
        **versions(),
    }


FUND_GROUPS = [  # (key, label, matcher on AMFI category / name, return-assumption key)
    ("index", "Index funds (Nifty 50)", lambda c, n: "index" in c and "nifty 50" in n and "next" not in n, "equity_large"),
    ("largecap", "Large cap funds", lambda c, n: "large cap" in c and "mid" not in c, "equity_large"),
    ("flexicap", "Flexi cap funds", lambda c, n: "flexi cap" in c, "equity_flexi"),
    ("midcap", "Mid cap funds", lambda c, n: "mid cap fund" in c, "equity_mid"),
    ("smallcap", "Small cap funds", lambda c, n: "small cap" in c, "equity_small"),
    ("elss", "Tax saver (ELSS)", lambda c, n: "elss" in c, "equity_flexi"),
    ("hybrid", "Hybrid funds", lambda c, n: "aggressive hybrid" in c or "balanced advantage" in c, "hybrid"),
    ("debt", "Short-term debt funds", lambda c, n: "short duration" in c or "corporate bond" in c, "debt"),
    ("liquid", "Liquid funds", lambda c, n: "liquid fund" in c or "overnight" in c, "liquid"),
    ("gold", "Gold funds / ETFs", lambda c, n: "gold" in c or "gold" in n, "gold"),
]


def fund_groups() -> list[dict]:
    return [{"key": k, "label": l} for k, l, _, _ in FUND_GROUPS]


def _stock_row(s: dict) -> dict:
    return {"id": s["symbol"], "name": s.get("company") or s["symbol"], "symbol": s["symbol"], "sector": s["sector"],
            "industry": s.get("industry"), "ltp": s["ltp"], "chg_30d": s["chg_30d"], "chg_365d": s["chg_365d"],
            "sector_confidence": s.get("confidence")}


def explore(kind: str, sector: str | None = None, category: str | None = None, sort: str = "return", limit: int = 10) -> dict:
    mk = portfolio.market()
    if kind == "stock":
        rows = [_stock_row(s) for s in mk["stocks"] if s.get("in_NIFTY_500") and (sector is None or s["sector"] == sector)]
        if sort == "return":
            rows.sort(key=lambda r: -(r["chg_365d"] if r["chg_365d"] is not None else -1e9))
        else:
            rows.sort(key=lambda r: r["name"])
        return {"rows": rows[:limit], "total": len(rows), "sort": sort, "label": "Past performance, not a recommendation.",
                "note": None, "mode": mk["equity_mode"], "asof": mk["asof"]}
    grp = next((g for g in FUND_GROUPS if g[0] == category), None)
    if grp:
        rows = [f for f in mk["funds"] if grp[2]((f.get("category") or "").lower(), f["name"].lower())]
        # ETFs and index funds of the same index: keep plain funds first, drop FoFs
        rows = [f for f in rows if "fund of fund" not in f["name"].lower() and " fof" not in f["name"].lower()]
    else:
        rows = [f for f in mk["funds"] if category is None or f["catalogue"] == category or f["assumption_key"] == category]
    rows = [{"id": f["scheme_code"], "name": f["name"].replace(" - Direct Plan - Growth", "").replace("-Direct Plan-Growth", ""),
             "full_name": f["name"], "amc": f.get("amc"), "category": f["category_short"], "nav": f["nav"],
             "assumption_key": grp[3] if grp else f["assumption_key"], "catalogue": f["catalogue"]} for f in rows]
    note = None
    hist = {}
    if mk.get("nav_mode") == "real" and rows:
        from .calculator import fund_returns
        hist = fund_returns([r["id"] for r in rows[:80]])
    for r in rows:
        h = hist.get(str(r["id"])) or {}
        r["ret_1y"], r["ret_3y"], r["ret_5y"] = h.get("cagr_1y"), h.get("cagr_3y"), h.get("cagr_5y")
    if any(r["ret_1y"] is not None for r in rows) and sort == "return":
        rows.sort(key=lambda r: -(r["ret_1y"] if r["ret_1y"] is not None else -1e9))
        sort_used = "return"
        note = "Returns from AMFI NAV history (via api.mfapi.in, cached). 3- and 5-year figures are yearly averages (CAGR)."
    else:
        rows.sort(key=lambda r: r["name"])
        sort_used = "alpha"
        note = ("Fund returns need NAV history, which could not be fetched right now (offline or synthetic data). "
                "Sorted A–Z.")
    return {"rows": rows[:limit], "total": len(rows), "sort": sort_used, "label": "Past performance, not a recommendation.",
            "note": note, "mode": mk["nav_mode"], "asof": mk["asof"]}


def whatif(uid: str | None, current: list[dict], add, years: float, horizon: float | None, capacity: int | None) -> dict:
    """What if I add one or more stocks / funds (any sectors)? Before-vs-after risk, sector mix and value range."""
    from .calculator import nav_history
    adds = add if isinstance(add, list) else [add]
    adds = [a for a in adds if a and float(a.get("amount") or 0) > 0][:20]
    if not adds:
        raise ValueError("Add at least one stock or fund with an amount.")
    hs, items = [], []
    for a in adds:
        if a["kind"] == "stock":
            h = portfolio.make_stock_holding(a["id"], a["amount"])
        else:
            h = portfolio.make_fund_holding(a["id"], a["amount"], a.get("sip", 0))
        hs.append(h)
        hist = nav_history(h["scheme_code"]) if h["type"] == "fund" else None
        items.append({"name": h.get("display_label") or h["name"], "assumption_key": h["assumption_key"], "amount": a["amount"],
                      "sip": a.get("sip", 0), "last_1y": h.get("last_1y"), "history": hist})
    before_an = portfolio.analyse(current) if current else None
    after_an = portfolio.analyse(current + hs)
    before = risk.compute(before_an, horizon, capacity) if before_an and not before_an.get("empty") else None
    after = risk.compute(after_an, horizon, capacity)
    proj = project(items, years)
    added_by_sector: dict[str, float] = {}
    for h in hs:
        key = h.get("sector") if h["type"] == "stock" else "Mutual funds (spread across sectors)"
        added_by_sector[key or "Others"] = added_by_sector.get(key or "Others", 0) + float(h.get("value") or 0)
    return {"added": hs[0] if len(hs) == 1 else None, "added_list": hs, "added_by_sector": added_by_sector,
            "added_total": sum(float(a["amount"]) for a in adds), "projection": proj,
            "before": {"risk": before, "sector_mix": before_an["sector_mix"] if before_an else None,
                       "concentration": portfolio.concentration_level(before_an) if before_an else None},
            "after": {"risk": after, "sector_mix": after_an["sector_mix"], "concentration": portfolio.concentration_level(after_an)},
            "benchmark_mix": portfolio.market()["benchmark_mix"]}
