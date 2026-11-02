"""AI Summary. Default: deterministic template over the structured analysis JSON.
Optional LLM mode (only if ANTHROPIC_API_KEY is set): the model receives ONLY the structured
facts, may only rephrase them, and its output is validated; any number or product name not
present in the facts causes a fallback to the deterministic summary."""
from __future__ import annotations

import json
import os
import re

from .common import catalogue, config, versions

LABEL = "AI-assisted summary of the analysis above"
FOOTER = "Academic prototype. Illustrative and synthetic data. Not investment advice."


def facts(a: dict) -> dict:
    """Minimal structured facts handed to the summariser (no raw personal data beyond need)."""
    rec = a.get("recommendations", {})
    r = a.get("risk") or {}
    an = a.get("analysis") or {}
    f = {
        "track": a.get("track"),
        "persona": a.get("persona", {}).get("name"),
        "profile": a.get("profile"),
        "profile_basis": a.get("profile_basis"),
        "risk_score": r.get("score"), "risk_band": r.get("band_name"),
        "risk_components": [{"name": c["name"], "value": c["value"]} for c in r.get("components", [])],
        "risk_willingness": a.get("willingness"), "risk_capacity": a.get("capacity_suitability"),
        "concentration": (a.get("concentration") or {}).get("level"),
        "most_overweight_sector": (a.get("concentration") or {}).get("most_overweight_sector"),
        "sectors_little_or_no_exposure": (a.get("explore_sectors") or {}).get("little_or_no_exposure", []),
        "over_concentrated_sectors": (a.get("explore_sectors") or {}).get("over_concentrated", []),
        "options_to_explore": [{"label": c["label"], "why": c["headline"], "cluster_stat": c.get("cluster_stat")} for c in rec.get("cards", [])],
        "not_suggested": [{"label": n["label"], "reason": n["reason"]} for n in rec.get("not_suggested", [])][:5],
        "flags": a.get("flags", []) + ([a["friction"]] if a.get("friction") else []) + ([a["consistency_flag"]] if a.get("consistency_flag") else []),
        "unknowns": a.get("unknowns", []) + ["Holdings outside this platform unless declared", "Full transaction history, tax position"],
        "fno_overlay": bool(a.get("fno_overlay")),
        "total_value_inr": round(an.get("total", 0)),
        "data_caveats": ["Population and cluster statistics are synthetic.",
                         "Market data is " + str(a.get("data_modes", {}).get("equity", "synthetic")) + "."],
        "education_only": rec.get("education_only", False),
    }
    return f


def deterministic(f: dict) -> dict:
    s = {}
    prof = f["profile"] or {}
    s["Where you stand"] = (f"Your profile is closest to the '{f['persona']}' group (Activity {prof.get('activity')}, "
                            f"Automation {prof.get('automation')}, Risk {prof.get('risk')}, Capacity {prof.get('capacity')}; basis: {f['profile_basis']}). "
                            + (f"Portfolio risk score {f['risk_score']} ({f['risk_band']}). " if f["risk_score"] is not None else "")
                            + (f"Your stated risk willingness is {f['risk_willingness']} and assessed capacity is {f['risk_capacity']} on a 1–4 scale." if f["risk_willingness"] else ""))
    out = []
    if f["concentration"] and f["concentration"] != "n/a":
        out.append(f"Concentration is {f['concentration']}; the most over-weight sector versus the benchmark is {f['most_overweight_sector']}.")
    out += f["flags"]
    if f["fno_overlay"]:
        out.append("Open F&O positions are shown separately as a risk overlay and are not part of the long-term allocation.")
    s["What stands out"] = " ".join(out) or "Nothing unusual stands out in the data available."
    if f["education_only"]:
        s["What investors like you do"] = "Critical inputs are missing, so only general learning content is shown."
    else:
        s["What investors like you do"] = " ".join(
            f"{o['label']}: {o['cluster_stat'] or o['why']}" for o in f["options_to_explore"]) or "No options passed the guardrails."
    care = [f"{n['label']}: {n['reason']}" for n in f["not_suggested"]]
    s["Things to be careful about"] = " ".join(care) + " Past performance does not guarantee future returns."
    s["What we don't know"] = "; ".join(f["unknowns"]) + ". " + " ".join(f["data_caveats"])
    learn = ["Diversification", "Risk tiers", "Reading 'investors like you'"]
    if f["fno_overlay"]:
        learn[0] = "Why F&O and leverage are not recommended"
    if f["over_concentrated_sectors"]:
        learn[1] = "Sector concentration"
    s["3 things to learn next"] = ", ".join(learn) + "."
    return s


def _numbers(text: str) -> set[str]:
    return {n.replace(",", "") for n in re.findall(r"\d[\d,]*\.?\d*", text)}


def validate(text: str, f: dict) -> tuple[bool, str]:
    blob = json.dumps(f, ensure_ascii=False)
    allowed = _numbers(blob) | {str(i) for i in range(0, 11)} | {"1", "2", "3", "4", "50"}
    for n in _numbers(text):
        n2 = n.rstrip(".")
        if n2 not in allowed and n2.rstrip("0").rstrip(".") not in {a.rstrip("0").rstrip(".") for a in allowed}:
            return False, f"number '{n2}' not in facts"
    allowed_labels = {o["label"].lower() for o in f["options_to_explore"]} | {n["label"].lower() for n in f["not_suggested"]}
    for c in catalogue().values():
        lab = c["label"].lower()
        if lab in text.lower() and lab not in allowed_labels:
            return False, f"product '{c['label']}' not in facts"
    if re.search(r"\byou should (buy|invest|sell)\b|\bguarantee[sd]? (returns|profit)", text, re.I):
        return False, "advice-style or guarantee wording"
    return True, "ok"


def summarise(analysis: dict, use_llm: bool = False) -> dict:
    f = facts(analysis)
    det = deterministic(f)
    meta = {"label": LABEL, "footer": FOOTER, **versions(), "inputs": list(f.keys())}
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not use_llm or not key:
        return {"mode": "deterministic", "sections": det, "llm_available": bool(key), **meta}
    try:
        import httpx
        prompt = ("Rewrite these analysis facts as a short plain-language summary with exactly these headings: "
                  + ", ".join(det.keys()) + ". Use ONLY the facts in the JSON. Do not add any product, price, return figure, "
                  "or number that is not in the JSON. Use neutral wording ('options to explore', 'investors like you'), never "
                  "'you should buy'. End with the line: 'Not investment advice.' Return JSON: {heading: text}.\n\nFACTS:\n"
                  + json.dumps(f, ensure_ascii=False))
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=30,
                       headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                       json={"model": config()["summary"]["llm_model"], "max_tokens": config()["summary"]["llm_max_tokens"],
                             "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        txt = "".join(b.get("text", "") for b in r.json().get("content", []))
        m = re.search(r"\{.*\}", txt, re.S)
        sections = json.loads(m.group(0)) if m else None
        if not isinstance(sections, dict):
            raise ValueError("no JSON in reply")
        ok, why = validate(" ".join(map(str, sections.values())), f)
        if not ok:
            return {"mode": "deterministic (LLM output rejected)", "rejected_reason": why, "sections": det, "llm_available": True, **meta}
        return {"mode": "llm", "sections": sections, "llm_available": True, **meta}
    except Exception as e:  # never block on the network
        return {"mode": "deterministic (LLM unavailable)", "rejected_reason": str(e)[:120], "sections": det, "llm_available": True, **meta}
