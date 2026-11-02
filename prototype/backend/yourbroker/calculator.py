"""Return calculator. Strict about what the data supports: scenario ranges from editable
assumptions; trailing 1Y actual for stocks shown separately; optional cached NAV history."""
from __future__ import annotations

import json
import time

from .common import config, load_yaml, path

DISCLAIMER = "Past performance does not guarantee future returns. Projections are estimates from assumptions, not forecasts. No fees or taxes are modelled."


def lumpsum_fv(p: float, r_pct: float, years: float) -> float:
    """FV = P × (1 + r)^t"""
    return p * (1 + r_pct / 100) ** years


def sip_fv(s: float, r_pct: float, years: float) -> float:
    """FV = S × [((1 + i)^n − 1) / i] × (1 + i), with i = (1 + r)^(1/12) − 1 and n = 12 × years."""
    n = int(round(years * 12))
    if n <= 0:
        return 0.0
    i = (1 + r_pct / 100) ** (1 / 12) - 1
    if abs(i) < 1e-12:
        return s * n
    return s * (((1 + i) ** n - 1) / i) * (1 + i)


def assumptions() -> dict:
    return load_yaml("return_assumptions.yaml")["assumptions"]


def project_item(item: dict, years: float) -> dict:
    key = item.get("assumption_key", "equity_flexi")
    a = assumptions().get(key, assumptions()["equity_flexi"])
    lump, sip = float(item.get("amount", 0) or 0), float(item.get("sip", 0) or 0)
    invested = lump + sip * int(round(years * 12))
    scen = {}
    for name, r in zip(("conservative", "base", "optimistic"), a["values"]):
        scen[name] = {"rate_pct": r, "value": lumpsum_fv(lump, r, years) + sip_fv(sip, r, years)}
    out = {"name": item.get("name"), "assumption_key": key, "assumption_note": a["note"], "invested": invested,
           "scenarios": scen, "lumpsum": lump, "sip_monthly": sip}
    if item.get("last_1y") is not None:
        out["last_1y_actual_pct"] = item["last_1y"]
        out["last_1y_label"] = "last 1Y actual (not a forecast)"
    if item.get("history"):
        out["history"] = item["history"]
    # "If past returns repeat": use the past return whose period best matches the horizon.
    past = {}
    if item.get("last_1y") is not None:
        past[1] = float(item["last_1y"])
    for yrs in (1, 3, 5):
        v = (item.get("history") or {}).get(f"cagr_{yrs}y")
        if v is not None:
            past[yrs] = float(v)
    need = min(max(years, 1), 3)          # a period at least as long as the horizon (3 years is enough beyond that)
    usable = sorted([y for y in past if y >= need - 1e-9], reverse=False)
    if usable:
        y = max(usable) if years >= 5 else min(usable)
        r = past[y]
        out["past"] = {"rate_pct": r, "basis_years": y,
                       "basis": f"{y}-year {'CAGR' if y > 1 else 'return'}",
                       "value": lumpsum_fv(lump, r, years) + sip_fv(sip, r, years)}
    elif past:
        y = max(past)
        out["past_note"] = (f"Only a {y}-year past return is available ({past[y]:+.1f}%). One year is too short to "
                            f"project {years:g} years ahead, so only the scenario range is shown.")
    else:
        out["past_note"] = "No past return data available for this holding; only the scenario range is shown."
    return out


def project(items: list[dict], years: float, target_pct: float | None = None) -> dict:
    rows = [project_item(i, years) for i in items]
    tot_inv = sum(r["invested"] for r in rows)
    tot = {k: sum(r["scenarios"][k]["value"] for r in rows) for k in ("conservative", "base", "optimistic")}
    covered = [r for r in rows if r.get("past")]
    past_total = {"value": sum(r["past"]["value"] for r in covered), "invested": sum(r["invested"] for r in covered),
                  "holdings_covered": len(covered), "holdings_total": len(rows)}
    implied = {}
    if tot_inv > 0 and years > 0:
        # money-weighted annualised rate implied by each scenario total (simple: solve lump-sum equivalent)
        for k, v in tot.items():
            implied[k] = ((v / tot_inv) ** (1 / years) - 1) * 100 if v > 0 else -100.0
    target = None
    if target_pct is not None and implied:
        lo, hi = implied["conservative"], implied["optimistic"]
        pos = "inside" if lo <= target_pct <= hi else ("above" if target_pct > hi else "below")
        target = {"target_pct": target_pct, "position": pos,
                  "text": {"inside": "Your target sits inside the scenario range. This does not mean it will be achieved.",
                           "above": "Your target sits above the optimistic scenario. Reaching it would need returns higher than any assumption used here.",
                           "below": "Your target sits below the conservative scenario. Returns can still fall short of it."}[pos]}
    return {"years": years, "rows": rows, "total_invested": tot_inv, "total": tot, "implied_annual_pct": implied,
            "past_total": past_total,
            "target": target, "disclaimer": DISCLAIMER,
            "method": {
                "lumpsum": "FV = P × (1 + r)^t",
                "sip": "FV = S × [((1 + i)^n − 1) / i] × (1 + i),  i = (1 + r)^(1/12) − 1,  n = 12 × years",
                "worked_example": f"₹1,00,000 lump sum at 10% for 5 years: 100000 × 1.10^5 = ₹{lumpsum_fv(100000, 10, 5):,.0f}. "
                                  f"₹5,000/month SIP at 10% for 5 years: ₹{sip_fv(5000, 10, 5):,.0f}.",
                "data": ("'If past returns repeat' uses each holding's own past return: fund CAGR from NAV history "
                         "(1, 3 or 5 years, matched to your horizon) and, for stocks, the 1-year change (used only for "
                         "1-year horizons). The range uses editable assumptions in data/return_assumptions.yaml."),
            }}


def nav_history(scheme_code: str, timeout: float = 4.0) -> dict | None:
    """Optional: fetch NAV history from api.mfapi.in and cache it. Only for REAL AMFI codes.
    Never blocks the app: any failure returns None."""
    from .portfolio import market
    if market().get("nav_mode") != "real" or str(scheme_code).startswith("9"):
        return None
    cache = path("cache_dir")
    cache.mkdir(parents=True, exist_ok=True)
    fp = cache / f"{scheme_code}.json"
    data = None
    if fp.exists() and time.time() - fp.stat().st_mtime < 7 * 86400:
        data = json.loads(fp.read_text(encoding="utf-8"))
    else:
        try:
            import httpx
            r = httpx.get(f"https://api.mfapi.in/mf/{scheme_code}", timeout=timeout)
            r.raise_for_status()
            data = r.json()
            fp.write_text(json.dumps(data), encoding="utf-8")
        except Exception:
            return None
    try:
        from datetime import datetime
        pts = [(datetime.strptime(d["date"], "%d-%m-%Y"), float(d["nav"])) for d in data.get("data", [])]
        pts.sort()
        last_d, last_v = pts[-1]
        out = {}
        for yrs in (1, 3, 5):
            target = last_d.replace(year=last_d.year - yrs)
            past = [p for p in pts if p[0] <= target]
            if past:
                out[f"cagr_{yrs}y"] = ((last_v / past[-1][1]) ** (1 / yrs) - 1) * 100
        return {"source": "api.mfapi.in (cached)", "asof": last_d.strftime("%d-%b-%Y"), **out}
    except Exception:
        return None


def fund_returns(codes: list[str], workers: int = 12) -> dict[str, dict]:
    """Fetch (or read cached) NAV history for many funds at once. Missing/failed ones are omitted."""
    from concurrent.futures import ThreadPoolExecutor
    codes = list(dict.fromkeys(str(c) for c in codes))
    out = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for code, res in zip(codes, ex.map(nav_history, codes)):
            if res:
                out[code] = res
    return out
