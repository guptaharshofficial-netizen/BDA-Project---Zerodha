"""Holdings resolution and portfolio analytics (allocation, sector mix, concentration)."""
from __future__ import annotations

from functools import lru_cache

from .common import SECTORS, catalogue, load_yaml, read_json

SURFACE_OF = {"stock": "Kite", "fund": "Coin", "smallcase": "smallcase", "declared": "off-platform"}
EQUITY_LIKE = {"direct_equity", "core_mf_sip", "index_fund_sip", "thematic_smallcase", "diversified_smallcase", "us_stocks"}


@lru_cache(maxsize=1)
def market() -> dict:
    return read_json("market.json")


def clear_cache() -> None:
    market.cache_clear()
    _stock_index.cache_clear()


@lru_cache(maxsize=1)
def _stock_index() -> dict:
    return {s["symbol"]: s for s in market()["stocks"]}


def stock(symbol: str) -> dict | None:
    return _stock_index().get(symbol)


def fund(code: str) -> dict | None:
    return next((f for f in market()["funds"] if str(f["scheme_code"]) == str(code)), None)


PSU_REAL = ["SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK", "BANKINDIA", "INDIANB"]


def _pick_stock(p: dict, used: set | None = None) -> dict:
    st = sorted(market()["stocks"], key=lambda s: s["symbol"])
    if p.get("psu_bank"):
        c = [s for s in st if s.get("psu_bank")] or [s for s in st if s["symbol"] in PSU_REAL]
    else:
        c = st
        if p.get("sector"):
            c = [s for s in c if s.get("sector") == p["sector"]]
        if p.get("index"):
            aliases = {"NIFTY_MIDCAP_150": ["NIFTY_MIDCAP_100", "NIFTY_MIDCAP_SELECT"],
                       "NIFTY_SMALLCAP_250": ["NIFTY_SMALLCAP_100"]}
            narrowed = []
            for idx_name in [p["index"]] + aliases.get(p["index"], []):
                narrowed = [s for s in c if s.get(f"in_{idx_name}")]
                if narrowed:
                    break
            # fall back to the broad index if this sector has no member of the requested index
            c = narrowed or [s for s in c if s.get("in_NIFTY_500")] or c
    if not c:
        raise LookupError(f"no stock matches {p}")
    used = used or set()
    start = p.get("nth", 0) % len(c)
    order = c[start:] + c[:start]
    fresh = [x for x in order if x["symbol"] not in used]
    if not fresh:  # sector exhausted: widen to the broad index, still avoiding duplicates
        fresh = [x for x in st if x.get("in_NIFTY_500") and x["symbol"] not in used and (not p.get("sector") or x.get("sector") == p["sector"])] \
            or [x for x in st if x["symbol"] not in used]
    return fresh[0]


def _pick_fund(p: dict) -> dict:
    c = sorted([f for f in market()["funds"] if f["assumption_key"] == p["assumption_key"]], key=lambda f: f["scheme_code"])
    if p.get("category_like"):
        narrowed = [f for f in c if p["category_like"].lower() in (f.get("category") or "").lower()
                    and "fof" not in f["name"].lower() and "fund of fund" not in f["name"].lower()]
        c = narrowed or c
    if not c:
        raise LookupError(f"no fund matches {p}")
    return c[p.get("nth", 0) % len(c)]


def make_stock_holding(symbol: str, value: float, label: str | None = None) -> dict:
    s = stock(symbol)
    if s is None:
        raise LookupError(symbol)
    return {"id": f"stk:{symbol}", "type": "stock", "name": label or symbol, "company": s.get("company") or symbol,
            "symbol": symbol, "sector": s["sector"], "industry": s.get("industry"),
            "category": "direct_equity", "tier": "High", "value": float(value), "surface": "Kite",
            "assumption_key": "direct_equity", "last_1y": s.get("chg_365d"), "psu_bank": bool(s.get("psu_bank")),
            "sector_confidence": s.get("confidence")}


def make_fund_holding(code: str, value: float, sip_monthly: float = 0, label: str | None = None, sip_status: str | None = None) -> dict:
    f = fund(code)
    if f is None:
        raise LookupError(code)
    cat = f["catalogue"]
    return {"id": f"mf:{code}", "type": "fund", "name": f["name"], "display_label": label, "scheme_code": str(code),
            "fund_category": f["category_short"], "category": cat, "tier": catalogue()[cat]["tier"],
            "value": float(value), "sip_monthly": float(sip_monthly), "sip_status": sip_status or ("active" if sip_monthly else "none"),
            "surface": "Coin", "assumption_key": f["assumption_key"], "nav": f["nav"]}


def demo_holdings(uid: str) -> dict:
    spec = load_yaml("test_user_holdings.yaml").get(uid)
    if not spec:
        return {"holdings": [], "goals": [], "suitability": {}}
    out, used = [], set()
    for h in spec["holdings"]:
        if h["type"] == "stock":
            s = _pick_stock(h["pick"], used)
            used.add(s["symbol"])
            lab = s["symbol"] + (f" {h['label_suffix']}" if h.get("label_suffix") else "")
            out.append(make_stock_holding(s["symbol"], h["value"], lab))
        elif h["type"] == "fund":
            f = _pick_fund(h["pick"])
            out.append(make_fund_holding(f["scheme_code"], h["value"], h.get("sip_monthly", 0), h.get("label"), h.get("sip_status")))
        elif h["type"] == "smallcase":
            cat = h["category"]
            out.append({"id": f"sc:{h['name']}", "type": "smallcase", "name": h["name"], "category": cat,
                        "tier": catalogue()[cat]["tier"], "value": float(h["value"]), "surface": "smallcase",
                        "assumption_key": "equity_thematic", "lookthrough": h.get("lookthrough", {}), "illustrative": True})
    return {"holdings": out, "goals": spec.get("goals", []), "suitability": spec.get("suitability", {}),
            "fno_overlay": spec.get("fno_overlay"), "idle_cash_inr": spec.get("idle_cash_inr", 0),
            "off_platform_declarable": spec.get("off_platform_declarable")}


def demo_categories(uid: str) -> list[str]:
    d = demo_holdings(uid)
    cats = {h["category"] for h in d["holdings"]}
    if d.get("fno_overlay"):
        cats.add("fno")
    return sorted(cats)


def declared_holding(label: str, category: str, value: float) -> dict:
    return {"id": f"decl:{category}:{label}", "type": "declared", "name": label, "category": category,
            "tier": catalogue()[category]["tier"], "value": float(value), "surface": "off-platform",
            "assumption_key": "debt" if category in ("fd", "debt_fund") else "equity_flexi", "declared": True}


def sector_exposure(h: dict) -> dict[str, float]:
    """Rupee exposure by sector bucket. Funds have no holdings data: equity funds are assumed to
    mirror the benchmark sector mix (illustrative look-through)."""
    v, cat = h["value"], h["category"]
    if h["type"] == "stock":
        return {h["sector"]: v}
    if h.get("lookthrough"):
        return {s: v * w for s, w in h["lookthrough"].items()}
    bench = market()["benchmark_mix"]
    if cat in ("core_mf_sip", "index_fund_sip", "diversified_smallcase"):
        return {s: v * bench[s] / 100 for s in SECTORS}
    if cat == "hybrid_fund":
        return {**{s: 0.65 * v * bench[s] / 100 for s in SECTORS}, "Debt & cash": 0.35 * v}
    if cat in ("gold_etf",):
        return {"Gold & silver": v}
    if cat in ("us_stocks",):
        return {"International": v}
    return {"Debt & cash": v}


def analyse(holdings: list[dict]) -> dict:
    total = sum(h["value"] for h in holdings)
    if total <= 0:
        return {"total": 0, "empty": True}
    by_tier, by_surface, by_cat, money = {}, {}, {}, {}
    for h in holdings:
        by_tier[h["tier"]] = by_tier.get(h["tier"], 0) + h["value"]
        by_surface[h["surface"]] = by_surface.get(h["surface"], 0) + h["value"]
        by_cat[h["category"]] = by_cat.get(h["category"], 0) + h["value"]
        for s, v in sector_exposure(h).items():
            money[s] = money.get(s, 0) + v
    eq = {s: money.get(s, 0) for s in SECTORS}
    eq_total = sum(eq.values())
    mix = {s: (100 * eq[s] / eq_total if eq_total else 0) for s in SECTORS}
    bench = market()["benchmark_mix"]
    hhi_p = sum((m / 100) ** 2 for m in mix.values()) if eq_total else 0
    hhi_b = sum((b / 100) ** 2 for b in bench.values())
    stocks = sorted([h for h in holdings if h["type"] == "stock"], key=lambda h: -h["value"])
    top = stocks[0] if stocks else None
    top_w = top["value"] / total if top else 0.0
    diffs = {s: mix[s] - bench[s] for s in SECTORS}
    little = sorted([s for s in SECTORS if mix[s] < 2.0])
    return {
        "total": total, "by_tier": by_tier, "by_surface": by_surface, "by_category": by_cat,
        "money_by_bucket": money, "equity_total": eq_total,
        "sector_mix": mix, "benchmark_mix": bench, "sector_diff_pts": diffs,
        "little_or_no_exposure": little,
        "hhi_portfolio": hhi_p, "hhi_benchmark": hhi_b,
        "top_stock": {"symbol": top["symbol"], "weight": top_w} if top else None,
        "psu_bank_weight": sum(h["value"] for h in stocks if h.get("psu_bank")) / total,
        "high_risk_share": by_tier.get("High", 0) / total,
        "n_holdings": len(holdings), "n_stocks": len(stocks),
        "lookthrough_note": "Mutual funds and smallcases have no constituent data here; equity funds are assumed to mirror the benchmark sector mix and smallcases use an illustrative look-through.",
    }


def concentration_level(a: dict) -> dict:
    if a.get("empty"):
        return {"level": "n/a"}
    max_over = max(a["sector_diff_pts"].values())
    top_w = a["top_stock"]["weight"] if a["top_stock"] else 0
    if max_over >= 20 or top_w >= 0.25:
        lvl = "High"
    elif max_over >= 10 or top_w >= 0.15:
        lvl = "Moderate"
    else:
        lvl = "Low"
    worst = max(a["sector_diff_pts"], key=a["sector_diff_pts"].get)
    return {"level": lvl, "most_overweight_sector": worst, "overweight_pts": a["sector_diff_pts"][worst],
            "top_stock_weight": top_w,
            "rule": "High if any sector is 20+ pts above benchmark or one stock is 25%+ of the portfolio; Moderate at 10 pts / 15%."}
