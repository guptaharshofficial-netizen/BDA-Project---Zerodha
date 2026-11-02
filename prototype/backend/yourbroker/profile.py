"""Four-number profile (Activity, Automation, Risk appetite, Capacity), each on a 1-4 band.

Track A (new users): quiz answers map straight onto the 1-4 scale (QUIZ_MAP below).
Track B (existing users): each feature becomes a percentile against the synthetic population;
two-feature dimensions are rank-averaged, then banded by quartile of the composite.
"""
from __future__ import annotations

import numpy as np

DIMS = ["activity", "automation", "risk", "capacity"]

QUIZ_MAP = {
    "check_frequency": {"feeds": "activity", "map": {"daily": 4, "weekly": 3, "monthly": 2, "rarely": 1}},
    "invest_style": {"feeds": "automation", "map": {"set-and-forget (sip)": 4, "mix": 2, "pick it myself": 1}},
    "market_fall_20pct": {"feeds": "risk", "map": {"sell": 1, "wait": 2, "hold": 3, "buy more": 4}},
    "horizon": {"feeds": "risk", "map": {"<1 yr": 1, "1-3 years": 2, "3-5 years": 3, "5+ years": 4}},
    "monthly_surplus": {"feeds": "capacity", "map": {"<5k": 1, "5k-25k": 2, "25k-1l": 3, "1l+": 4}},
}
QUIZ_OPTIONS = {
    "check_frequency": ["Daily", "Weekly", "Monthly", "Rarely"],
    "invest_style": ["Set-and-forget (SIP)", "Mix", "Pick it myself"],
    "market_fall_20pct": ["Sell", "Wait", "Hold", "Buy more"],
    "horizon": ["<1 yr", "1-3 years", "3-5 years", "5+ years"],
    "monthly_surplus": ["<5k", "5k-25k", "25k-1L", "1L+"],
    "already_holds": ["FD", "MFs", "Stocks", "Gold", "PPF/NPS", "None"],
}
HORIZON_YEARS = {"<1 yr": 0.5, "1-3 years": 2, "3-5 years": 4, "5+ years": 7}
SURPLUS_INR = {"<5k": 3000, "5k-25k": 15000, "25k-1l": 60000, "1l+": 150000}
ALREADY_HOLDS_MAP = {"fd": "fd", "mfs": "core_mf_sip", "stocks": "direct_equity", "gold": "gold_etf", "ppf/nps": "nps"}


def norm(s: str) -> str:
    return str(s).strip().lower().replace("–", "-").replace("₹", "")


def half_up(x: float) -> int:
    return int(np.floor(x + 0.5))


def quiz_profile(quiz: dict) -> dict:
    """Map quiz answers to the 1-4 profile. Risk = mean of Q3 (scenario) and Q4 (horizon), rounded half-up."""
    vals = {}
    for q, spec in QUIZ_MAP.items():
        a = norm(quiz.get(q, ""))
        if a not in spec["map"]:
            raise ValueError(f"missing or unknown answer for {q}: {quiz.get(q)!r}")
        vals[q] = spec["map"][a]
    return {
        "activity": vals["check_frequency"],
        "automation": vals["invest_style"],
        "risk": half_up((vals["market_fall_20pct"] + vals["horizon"]) / 2),
        "capacity": vals["monthly_surplus"],
        "_inputs": vals,
    }


def risk_willingness(answer: str) -> int:
    return QUIZ_MAP["market_fall_20pct"]["map"][norm(answer)]


# --- Track B -----------------------------------------------------------------
GRID_Q = np.linspace(0, 100, 201)


def make_grid(values) -> list[float]:
    return np.percentile(np.asarray(values, dtype=float), GRID_Q).tolist()


def pct_from_grid(x: float, grid: list[float]) -> float:
    """Percentile (0-1) of x against a stored quantile grid; ties take the mid-point."""
    g = np.asarray(grid)
    lo = np.searchsorted(g, x, side="left")
    hi = np.searchsorted(g, x, side="right")
    mid = (lo + hi) / 2
    return float(np.clip(mid / len(g), 0, 1))


def raw_dimension_scores(f: dict, grids: dict) -> dict:
    """Composite (pre-banding) score per dimension in [0,1]."""
    p = lambda k, v: pct_from_grid(v, grids[k])
    return {
        "activity": (p("trades_per_month", f["trades_per_month"]) + (1 - p("days_since_last_txn", f["days_since_last_txn"]))) / 2,
        "automation": p("sip_share", f["sip_share"]),
        "risk": p("high_risk_share", f["high_risk_share"]),
        "capacity": (p("aum_inr", f["aum_inr"]) + p("monthly_inflow_inr", f["monthly_inflow_inr"])) / 2,
    }


def band(pct: float) -> int:
    return int(min(4, 1 + np.floor(pct * 4)))


def computed_profile(f: dict, model: dict) -> dict:
    """Track B profile. Returns bands (1-4) and continuous dimension percentiles used for clustering."""
    raw = raw_dimension_scores(f, model["feature_grids"])
    cont = {d: pct_from_grid(raw[d], model["composite_grids"][d]) for d in DIMS}
    return {**{d: band(cont[d]) for d in DIMS}, "_continuous": cont, "_raw_composite": raw}
