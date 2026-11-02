"""'Find the gap' engine plus hard guardrails. All outputs are category-level and deterministic."""
from __future__ import annotations

from dataclasses import dataclass, field

from .common import catalogue, config, versions

TIER_ORDER = {"Low": 1, "Medium": 2, "High": 3, "Credit": 2}
LOW_BUFFER = {"liquid_fund", "debt_fund", "fd", "liquid_etf"}
INDIVIDUAL_STOCK_CATS = {"direct_equity", "us_stocks"}

EVIDENCE = {
    "gap": "Cluster adoption count: a simplified form of the collaborative filtering in Yang (2024), on behavioural clusters following Thompson et al. (2021).",
    "EMERGENCY_BUFFER": "Rule: no low-risk liquid holding detected. Emergency-buffer practice; BRD §5.3 (cash/idle funds) and FR-04 (capacity to absorb loss).",
    "IDLE_CASH": "Rule: idle broker cash above the configured threshold. Persona table (Active Trader: liquid ETF for idle margin).",
    "NEW_USER_COLD_START": "Rule: no behaviour history yet (cold start). Clustering design; Rohan test case.",
    "DORMANT_SIP_RESTART": "Rule: a SIP exists but is stopped. Persona table (Dormant: first SIP / re-engage); Farah test case.",
    "LIFE_STAGE": "Rule: age-stage / short-horizon suitability check. SEBI IA Regulations risk-profiling (age, horizon); BRD §13.2.",
}


@dataclass
class Ctx:
    track: str                     # "new" | "existing"
    cluster: int
    cluster_name: str
    held: set
    age: int | None = None
    horizon_years: float | None = None
    willingness: int | None = None
    capacity: int | None = None    # suitability capacity (not the behavioural Capacity dimension)
    revealed_risk: int | None = None
    has_behaviour: bool = True
    idle_cash: float = 0
    sip_stopped: bool = False
    sip_status_text: str = ""
    equity_value: float = 0
    overweight_sectors: list = field(default_factory=list)
    missing: list = field(default_factory=list)


def suitability_band(ctx: Ctx) -> int:
    """Conservative: the lower of stated willingness and assessed capacity."""
    vals = [v for v in (ctx.willingness, ctx.capacity) if v is not None]
    return min(vals) if vals else 1


def max_tier(ctx: Ctx) -> tuple[str, list[str]]:
    """Highest product tier allowed, with the reasons that capped it."""
    g = config()["guardrails"]
    reasons = []
    sb = suitability_band(ctx)
    cap = {1: "Low", 2: "Medium", 3: "High", 4: "High"}[sb]
    reasons.append(f"Suitability band {sb} (lower of risk willingness {ctx.willingness} and capacity {ctx.capacity}) allows up to {cap} tier.")
    if ctx.horizon_years is not None and ctx.horizon_years < g["min_horizon_any_risk_years"]:
        cap = "Low"
        reasons.append("Horizon under 1 year: nothing above Low tier.")
    elif ctx.horizon_years is not None and ctx.horizon_years < g["short_horizon_years"] and TIER_ORDER[cap] > 2:
        cap = "Medium"
        reasons.append(f"Horizon under {g['short_horizon_years']} years: High tier capped.")
    if ctx.age is not None and ctx.age >= g["senior_age"]:
        if TIER_ORDER[cap] > 2:
            cap = "Medium"
            reasons.append(f"Age {g['senior_age']}+: High tier capped.")
        if revealed_mismatch(ctx):
            cap = "Low"
            reasons.append("Revealed risk (from holdings) is well above stated willingness at this life stage: Low tier only until reviewed.")
    return cap, reasons


def revealed_mismatch(ctx: Ctx) -> bool:
    if ctx.revealed_risk is None:
        return False
    senior = ctx.age is not None and ctx.age >= config()["guardrails"]["senior_age"]
    w = ctx.willingness if ctx.willingness is not None else 4
    return (ctx.revealed_risk - w >= 2) or (senior and ctx.revealed_risk >= 4)


def check(cat: str, ctx: Ctx, from_rule: str | None = None) -> tuple[bool, str]:
    """Hard guardrails. Returns (allowed, reason). Order matters: the first failing rule is reported."""
    c = catalogue()[cat]
    if c.get("blocked") or cat in ("fno", "mtf"):
        return False, "Never recommended: F&O and MTF are excluded under every profile."
    if cat in ctx.held and from_rule != "DORMANT_SIP_RESTART":
        return False, "Already held."
    if cat in INDIVIDUAL_STOCK_CATS and (ctx.track == "new" or not ctx.has_behaviour):
        return False, "No individual-stock suggestions until real investing behaviour exists (new-user rule)."
    if c.get("liquidity_only"):
        if ctx.track == "new" or ctx.equity_value < 500000:
            return False, "Loan against securities is only shown as an alternative to selling for existing holdings of ₹5 lakh or more."
    if cat == "thematic_smallcase" and ctx.sip_stopped:
        return False, "A paused core SIP is addressed before any new thematic bet."
    if cat == "thematic_smallcase" and ctx.overweight_sectors:
        return False, f"Would add to over-concentrated sector(s): {', '.join(ctx.overweight_sectors)}."
    tier = c["tier"]
    cap, _ = max_tier(ctx)
    if tier != "Credit" and TIER_ORDER[tier] > TIER_ORDER[cap]:
        return False, f"{tier} tier is above the allowed {cap} tier for this profile."
    return True, "Passed all guardrails."


def _adoption(model: dict, cluster: int) -> tuple[int, dict]:
    a = model["adoption"][str(cluster)]
    return a["n"], a["adoption"]


def recommend(ctx: Ctx, model: dict) -> dict:
    cfg = config()
    cat = catalogue()
    thr = cfg["recommender"]["adoption_threshold"]
    n, ad = _adoption(model, ctx.cluster)
    enough = n >= cfg["recommender"]["min_cohort"]

    if ctx.missing:
        return {"education_only": True, "missing": ctx.missing, "cards": [], "not_suggested": [],
                "message": "Some critical inputs are missing, so only general learning content is shown. Missing: " + ", ".join(ctx.missing) + "."}

    candidates: list[tuple[str, str]] = []  # (category, source)
    if ctx.sip_stopped:
        candidates.append(("core_mf_sip", "DORMANT_SIP_RESTART"))
    if ctx.track == "new" or not ctx.has_behaviour:
        candidates.append(("index_fund_sip", "NEW_USER_COLD_START"))
    senior_or_short = (ctx.age is not None and ctx.age >= cfg["guardrails"]["senior_age"]) or \
                      (ctx.horizon_years is not None and ctx.horizon_years < cfg["guardrails"]["short_horizon_years"])
    if senior_or_short and revealed_mismatch(ctx):
        for c in ("fd", "debt_fund", "swp"):
            candidates.append((c, "LIFE_STAGE"))
    idle = ctx.idle_cash >= cfg["recommender"]["idle_cash_threshold_inr"]
    if idle:
        candidates.append(("liquid_etf", "IDLE_CASH"))
    elif not (ctx.held & LOW_BUFFER):  # an idle-cash liquid ETF already serves as the buffer
        candidates.append(("liquid_fund", "EMERGENCY_BUFFER"))
    gap = sorted([c for c, r in ad.items() if r >= thr], key=lambda c: -ad[c])
    candidates += [(c, "gap") for c in gap]

    cards, rejected, seen = [], [], set()
    for c, src in candidates:
        if c in seen:
            continue
        ok, why = check(c, ctx, src)
        if not ok:
            if c not in {r["category"] for r in rejected}:
                rejected.append({"category": c, "label": cat[c]["label"], "reason": why, "source": src})
            continue
        seen.add(c)
        cards.append(_card(c, src, ctx, ad.get(c, 0.0), n, enough, model))
        if len(cards) >= cfg["recommender"]["max_suggestions"]:
            break
    for c in ("fno", "mtf"):
        if c not in {r["category"] for r in rejected}:
            rejected.append({"category": c, "label": cat[c]["label"], "reason": check(c, ctx)[1], "source": "policy"})
    cap, cap_reasons = max_tier(ctx)
    return {"education_only": False, "cards": cards, "not_suggested": rejected, "max_tier": cap,
            "max_tier_reasons": cap_reasons, "suitability_band": suitability_band(ctx),
            "revealed_mismatch": revealed_mismatch(ctx), **versions()}


def _card(c: str, src: str, ctx: Ctx, rate: float, n: int, enough: bool, model: dict) -> dict:
    meta = catalogue()[c]
    pct = round(rate * 100)
    if enough and rate > 0:
        stat = f"{pct}% of investors like you ({ctx.cluster_name}, n={n:,}, synthetic population) {HOLD_PHRASE.get(c, 'hold ' + meta['label'])}."
    else:
        stat = "Not enough data: fewer than 50 investors in this group." if not enough else None
    reason = {
        "gap": f"{pct}% of investors like you {HOLD_PHRASE.get(c, 'hold ' + meta['label'])}. You don't yet.",
        "EMERGENCY_BUFFER": "We did not find a low-risk, easy-to-access holding that could act as an emergency buffer.",
        "IDLE_CASH": "A large cash balance is sitting idle in the trading account.",
        "NEW_USER_COLD_START": "Without investing history, a broad index SIP and the basics come before individual picks.",
        "DORMANT_SIP_RESTART": f"Your SIP has been {ctx.sip_status_text or 'paused'}. Restarting a SIP in an index or flexi-cap fund is one option to explore before any new thematic bet.",
        "LIFE_STAGE": "At this life stage and horizon, lower-volatility, income-oriented categories are options to explore.",
    }[src]
    if c == "las":  # never phrased as a gap to fill
        reason = ("If you need cash, borrowing against your holdings is one alternative to selling them. "
                  "It is a credit product, not an investment, and is never shown as a way to invest more.")
    risks = {
        "Low": "Lower volatility, but returns can trail inflation; debt funds carry credit and interest-rate risk.",
        "Medium": "Market-linked: value can fall, especially over short periods.",
        "High": "Can lose a large share of value; concentration and timing risk.",
        "Credit": "Borrowing: interest cost, and a fall in the pledged holdings can trigger a margin call.",
    }[meta["tier"]]
    return {
        "category": c, "label": meta["label"], "tier": meta["tier"], "surface": meta["surface"],
        "source": src, "headline": reason, "cluster_stat": stat,
        "why": {
            "rule_fired": FRIENDLY_RULE.get(src, src),
            "inputs": ["four-number profile", "categories you hold", "goal horizon", "risk willingness and capacity"] +
                      (["idle cash"] if src == "IDLE_CASH" else []) + (["age (guardrail only)"] if src == "LIFE_STAGE" else []),
            "asof": versions()["data_asof"],
            "evidence": EVIDENCE.get(src, EVIDENCE["gap"]),
            "assumptions": "Cluster statistics come from a SYNTHETIC population of about 3,000 users; thresholds must be re-derived on real data.",
            "risks": risks,
            "what_could_change": "A different goal horizon, risk answers, capacity, or holdings would change this list.",
            "unknowns": "Holdings outside this platform, full transaction history, tax position, and liabilities you have not declared.",
            "versions": versions(),
        },
        "learn": LEARN_LINK.get(c, "diversification"),
        "action_label": "Go to " + (meta["surface"] if meta["surface"] in ("Kite", "Coin", "smallcase") else "learn more"),
    }


FRIENDLY_RULE = {
    "gap": "Common among investors like you (30% or more of them), you don't have it, and it passed every safety check.",
    "EMERGENCY_BUFFER": "No easy-to-access, low-risk money found for emergencies.",
    "IDLE_CASH": "A large amount of cash is sitting unused in your trading account.",
    "NEW_USER_COLD_START": "You're new, so we start with the basics before individual stocks.",
    "DORMANT_SIP_RESTART": "You have a SIP that has been paused.",
    "LIFE_STAGE": "Your stage of life and goal timeline call for lower-risk options.",
}

HOLD_PHRASE = {"index_fund_sip": "run a Nifty 50 index fund SIP", "core_mf_sip": "run a diversified mutual-fund SIP",
               "sip_step_up": "use a SIP step-up", "liquid_fund": "hold a liquid fund", "debt_fund": "hold a debt fund",
               "liquid_etf": "hold a liquid ETF", "fd": "hold an FD", "swp": "use a systematic withdrawal plan",
               "hybrid_fund": "hold a hybrid fund", "gold_etf": "hold a gold or silver ETF",
               "diversified_smallcase": "hold a diversified smallcase", "nps": "invest in NPS",
               "direct_equity": "hold individual stocks", "thematic_smallcase": "hold a thematic smallcase",
               "us_stocks": "hold US stocks", "las": "use a loan against securities"}

LEARN_LINK = {"liquid_fund": "emergency-fund", "debt_fund": "risk-tiers", "fd": "emergency-fund", "swp": "risk-tiers",
              "index_fund_sip": "sip", "core_mf_sip": "sip", "sip_step_up": "sip", "hybrid_fund": "risk-tiers",
              "gold_etf": "diversification", "diversified_smallcase": "diversification", "nps": "risk-tiers",
              "direct_equity": "concentration", "thematic_smallcase": "concentration", "us_stocks": "diversification",
              "liquid_etf": "emergency-fund", "las": "fno-leverage"}


# Major investment groups (what people recognise) and the product types under each (what the model counts)
PEER_GROUPS = [
    ("safety", "Safety & ready cash", "Money you can reach quickly, with small ups and downs.", ["liquid_fund", "liquid_etf", "debt_fund", "fd", "swp"]),
    ("funds", "Mutual funds & SIPs", "A fund manager spreads your money across many companies; SIPs invest a fixed amount every month.",
     ["index_fund_sip", "core_mf_sip", "hybrid_fund", "sip_step_up"]),
    ("diversifiers", "Gold & retirement", "Things that move differently from shares, or lock money away for the long run.", ["gold_etf", "nps"]),
    ("stocks", "Shares & stock baskets", "You choose the companies. Bigger ups and downs.", ["direct_equity", "diversified_smallcase", "thematic_smallcase", "us_stocks"]),
    ("credit", "Borrowing", "A loan, not an investment.", ["las"]),
    ("trading", "Trading (never suggested here)", "Shown for context only: most people who trade futures and options lose money.", ["fno", "mtf"]),
]
# Typical scheme types inside a product type, so a "type" is never confused with a single fund
SUBTYPE_KINDS = {
    "core_mf_sip": ["Flexi cap", "Large cap", "Large & mid cap", "Multi cap"],
    "index_fund_sip": ["Nifty 50 index fund", "Nifty 50 ETF"],
    "hybrid_fund": ["Aggressive hybrid", "Balanced advantage"],
    "debt_fund": ["Short duration", "Corporate bond"],
    "liquid_fund": ["Liquid", "Overnight"],
    "gold_etf": ["Gold ETF", "Gold fund"],
    "diversified_smallcase": ["Multi-sector baskets"],
    "thematic_smallcase": ["One theme, e.g. EV or defence"],
}
FUND_GROUP_FOR = {"core_mf_sip": "flexicap", "index_fund_sip": "index", "hybrid_fund": "hybrid", "debt_fund": "debt",
                  "liquid_fund": "liquid", "liquid_etf": "liquid", "gold_etf": "gold"}


def peers(model: dict, cluster: int, held: set) -> dict:
    cfg = config()
    n, ad = _adoption(model, cluster)
    if n < cfg["recommender"]["min_cohort"]:
        return {"enough": False, "n": n, "message": "Not enough data: fewer than 50 investors in this group."}
    cat = catalogue()
    rows = sorted([{"category": c, "label": cat[c]["label"], "adoption": ad[c], "you_hold": c in held,
                    "tier": cat[c]["tier"], "blocked": bool(cat[c].get("blocked"))} for c in ad],
                  key=lambda r: -r["adoption"])
    by = {r["category"]: r for r in rows}
    thr = cfg["recommender"]["adoption_threshold"]
    groups = []
    for key, label, blurb, cats in PEER_GROUPS:
        subs = [{**by[c], "kinds": SUBTYPE_KINDS.get(c, []), "fund_group": FUND_GROUP_FOR.get(c),
                 "common": by[c]["adoption"] >= thr and by[c]["tier"] != "Credit"} for c in cats if c in by]
        if not subs:
            continue
        subs.sort(key=lambda r: -r["adoption"])
        groups.append({"key": key, "label": label, "blurb": blurb, "subtypes": subs,
                       "top_share": max(x["adoption"] for x in subs), "you_hold": sum(1 for x in subs if x["you_hold"]),
                       "blocked": all(x["blocked"] for x in subs)})
    gaps = [r for r in rows if r["adoption"] >= thr and not r["you_hold"] and not r["blocked"] and r["tier"] != "Credit"]
    return {"enough": True, "n": n, "rows": rows, "groups": groups, "threshold": thr,
            "gaps": [{**g, "group": next((lbl for _, lbl, _, cs in PEER_GROUPS if g["category"] in cs), ""),
                      "fund_group": FUND_GROUP_FOR.get(g["category"])} for g in gaps],
            "note": "Shares of a SYNTHETIC population. Blocked products (F&O, MTF) are shown for context only and are never suggested."}


def explore_sectors(analysis: dict) -> dict:
    """Sectors with little/no exposure (alphabetical, no ranking) and over-concentrated ones to avoid adding to."""
    pts = config()["guardrails"]["overconcentrated_sector_pts"]
    over = sorted([s for s, d in analysis.get("sector_diff_pts", {}).items() if d >= pts])
    little = sorted([s for s in analysis.get("little_or_no_exposure", []) if s not in over])
    bench = analysis.get("benchmark_mix") or {}
    mix = analysis.get("sector_mix") or {}
    nxt = sorted([s for s in little if s != "Others"], key=lambda s: -bench.get(s, 0))
    next_steps = [{"sector": s, "market_share": bench.get(s, 0), "your_share": mix.get(s, 0),
                   "why": f"{s} is about {bench.get(s, 0):.0f}% of the market; you have {mix.get(s, 0):.0f}%."} for s in nxt]
    return {"little_or_no_exposure": little, "over_concentrated": over, "next_sectors": next_steps,
            "next_rule": "Sectors you barely hold, biggest share of the market first. Spreading across sectors that move differently lowers the chance that one bad sector hurts the whole portfolio."}
