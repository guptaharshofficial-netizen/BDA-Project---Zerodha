"""Transparent 0-100 portfolio risk score (see docs/RISK_METHOD.md).

score = 0.45 x product-tier risk + 0.25 x concentration + 0.15 x horizon mismatch + 0.15 x capacity mismatch
"""
from __future__ import annotations

from .common import config

BAND_NAMES = {1: "Low", 2: "Medium-low", 3: "Medium-high", 4: "High"}


def horizon_bucket(years: float) -> str:
    if years < 1:
        return "<1"
    if years < 3:
        return "1-3"
    if years < 5:
        return "3-5"
    return "5+"


def score_to_band(score: float) -> int:
    b = config()["risk_score"]["bands"]
    return 1 + sum(score >= x for x in b)


def tier_component(analysis: dict) -> float:
    """Value-weighted product-tier risk, 0-100 (Low=0, Medium=50, High=100). Credit products excluded."""
    pts = config()["risk_score"]["tier_points"]
    by = {k: v for k, v in analysis.get("by_tier", {}).items() if k in pts}
    tot = sum(by.values())
    return sum(pts[t] * v for t, v in by.items()) / tot if tot else 0.0


def concentration_component(analysis: dict) -> dict:
    rs = config()["risk_score"]
    hp, hb = analysis.get("hhi_portfolio", 0), analysis.get("hhi_benchmark", 0)
    sector = max(0.0, min(1.0, (hp - hb) / (1 - hb))) * 100 if analysis.get("equity_total") else 0.0
    tw = analysis["top_stock"]["weight"] if analysis.get("top_stock") else 0.0
    single = max(0.0, min(1.0, (tw - rs["single_stock_floor"]) / (rs["single_stock_cap"] - rs["single_stock_floor"]))) * 100
    return {"sector_hhi_excess": sector, "single_stock": single, "value": (sector + single) / 2}


def compute(analysis: dict, horizon_years: float | None, capacity_band: int | None) -> dict:
    rs = config()["risk_score"]
    w = rs["weights"]
    tier = tier_component(analysis)
    conc = concentration_component(analysis)
    hb = horizon_bucket(horizon_years) if horizon_years is not None else None
    allow_h = rs["horizon_allowance"][hb] if hb else 100
    horizon_mis = max(0.0, tier - allow_h)
    allow_c = {1: 25, 2: 50, 3: 75, 4: 100}.get(capacity_band or 4, 100)
    cap_mis = max(0.0, tier - allow_c)
    score = w["tier"] * tier + w["concentration"] * conc["value"] + w["horizon"] * horizon_mis + w["capacity"] * cap_mis
    band = score_to_band(score)
    return {
        "score": round(score, 1), "band": band, "band_name": BAND_NAMES[band],
        "components": [
            {"name": "Product-tier risk", "weight": w["tier"], "value": round(tier, 1),
             "how": "Value-weighted tier points: Low 0, Medium 50, High 100. Credit products (loans) excluded."},
            {"name": "Concentration", "weight": w["concentration"], "value": round(conc["value"], 1),
             "how": f"Average of sector HHI excess over benchmark ({conc['sector_hhi_excess']:.0f}) and single-stock weight score ({conc['single_stock']:.0f}; 10% scores 0, 40%+ scores 100)."},
            {"name": "Horizon mismatch", "weight": w["horizon"], "value": round(horizon_mis, 1),
             "how": f"Tier risk above what the horizon allows ({hb or 'not given'} yrs allows {allow_h})."},
            {"name": "Capacity mismatch", "weight": w["capacity"], "value": round(cap_mis, 1),
             "how": f"Tier risk above what capacity band {capacity_band or 'n/a'} allows ({allow_c})."},
        ],
        "arithmetic": f"{w['tier']}×{tier:.1f} + {w['concentration']}×{conc['value']:.1f} + {w['horizon']}×{horizon_mis:.1f} + {w['capacity']}×{cap_mis:.1f} = {score:.1f}",
        "horizon_bucket": hb,
    }


def gaps(score_band: int, willingness: int | None, capacity: int | None) -> dict:
    def g(x):
        if x is None:
            return None
        d = score_band - x
        return {"value": d, "text": "in line" if d == 0 else (f"{d} band{'s' if abs(d) > 1 else ''} above" if d > 0 else f"{-d} band{'s' if abs(d) > 1 else ''} below")}
    return {"vs_willingness": g(willingness), "vs_capacity": g(capacity)}
