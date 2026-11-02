"""Acceptance checks for the five test personas (prompt §4.4). Used by pytest and the 'Test cases' tab."""
from __future__ import annotations

import re

from . import service

URGENCY = re.compile(r"\b(now|hurry|today only|last chance|don't miss|act fast|limited time)\b|!", re.I)


def _cards(a):
    return a["recommendations"]["cards"]


def _cats(a):
    return [c["category"] for c in _cards(a)]


def run_all() -> list[dict]:
    out = []

    def chk(persona, name, cond, detail=""):
        out.append({"persona": persona, "check": name, "passed": bool(cond), "detail": detail})

    a = service.analyse_existing("U01")
    cats = _cats(a)
    chk("U01 Ananya", "Suggests a liquid fund as an emergency buffer", "liquid_fund" in cats, str(cats))
    chk("U01 Ananya", "Suggests an index fund", "index_fund_sip" in cats, str(cats))
    chk("U01 Ananya", "No tip-style individual stock suggestions", not ({"direct_equity", "us_stocks", "thematic_smallcase"} & set(cats)), str(cats))
    mix = a["analysis"]["sector_mix"]
    chk("U01 Ananya", "Sector ideas only list sectors she barely holds (<2%)",
        all(mix[s] < 2 for s in a["explore_sectors"]["little_or_no_exposure"]), str(a["explore_sectors"]))

    a = service.analyse_existing("U02")
    cats = _cats(a)
    ns = {n["category"]: n["reason"] for n in a["recommendations"]["not_suggested"]}
    chk("U02 Harpreet", "F&O and MTF blocked", "fno" in ns and "mtf" in ns and not ({"fno", "mtf"} & set(cats)), str(ns.get("fno")))
    chk("U02 Harpreet", "Liquid ETF for idle cash", "liquid_etf" in cats, str(cats))
    chk("U02 Harpreet", "Core mutual-fund SIP to diversify", "core_mf_sip" in cats, str(cats))
    chk("U02 Harpreet", "Loan against securities instead of selling", "las" in cats, str(cats))
    chk("U02 Harpreet", "Flags concentration (PSU banks, 100% high-risk)",
        any("PSU" in f for f in a["flags"]) and any("100%" in f for f in a["flags"]), "; ".join(a["flags"]))
    chk("U02 Harpreet", "F&O shown only as a separate overlay", a["fno_overlay"] is not None and all(h["category"] != "fno" for h in a["holdings"]))

    a = service.analyse_existing("U03")
    cats = _cats(a)
    chk("U03 Meenakshi", "Flags revealed-risk vs life-stage mismatch", a["recommendations"]["revealed_mismatch"], "; ".join(a["flags"]))
    chk("U03 Meenakshi", "Only Low-tier options (FDs, debt funds, SWP), no more equity",
        all(c["tier"] == "Low" for c in _cards(a)) and {"fd", "debt_fund", "swp"} <= set(cats), str(cats))
    chk("U03 Meenakshi", "Says off-platform FDs are invisible and prompts declaration", bool(a.get("unknowns")), str(a.get("unknowns")))
    b = service.analyse_existing("U03", declared=[{"label": "Bank FDs", "category": "fd", "value": 2200000}])
    chk("U03 Meenakshi", "Re-run after declaring FDs lowers the risk score and drops FD from options",
        b["risk"]["score"] < a["risk"]["score"] and "fd" not in _cats(b), f"{a['risk']['score']} → {b['risk']['score']}")

    u = service.test_user("U04")
    a = service.analyse_new(u["quiz"], {"age": u["age"]})
    cats = _cats(a)
    chk("U04 Rohan", "Quiz profile matches expected", a["profile"] == u["expected_profile"], f"{a['profile']} vs {u['expected_profile']}")
    chk("U04 Rohan", "Starts with an index-fund SIP (cold start)", cats[:1] == ["index_fund_sip"], str(cats))
    chk("U04 Rohan", "No individual stock suggestions", not ({"direct_equity", "us_stocks"} & set(cats)), str(cats))
    st = next(s for s in service.portfolio.market()["stocks"] if s.get("in_NIFTY_500"))
    b = service.analyse_new(u["quiz"], {"age": u["age"]}, basket=[{"kind": "stock", "id": st["symbol"], "amount": 30000}], budget=100000)
    chk("U04 Rohan", "Friction when stocks exceed 20% of budget", bool(b["friction"]), b["friction"] or "")

    a = service.analyse_existing("U05")
    cards = _cards(a)
    chk("U05 Farah", "First card restarts a SIP (index or flexi-cap)", cards and cards[0]["source"] == "DORMANT_SIP_RESTART", str(_cats(a)))
    chk("U05 Farah", "No new thematic bet", "thematic_smallcase" not in _cats(a), str(_cats(a)))
    chk("U05 Farah", "Acknowledges the 2023 pause without pressure",
        cards and "2023" in cards[0]["headline"] and not URGENCY.search(cards[0]["headline"]), cards[0]["headline"] if cards else "")

    for uid in ("U01", "U02", "U03", "U05"):
        a = service.analyse_existing(uid)
        chk("All", f"{uid}: every card has a complete 'Why this?' drawer",
            all(all(k in c["why"] for k in ("rule_fired", "inputs", "asof", "evidence", "assumptions", "risks", "what_could_change", "unknowns"))
                for c in _cards(a)))
        chk("All", f"{uid}: no urgency wording", not any(URGENCY.search(c["headline"]) for c in _cards(a)))
    return out
