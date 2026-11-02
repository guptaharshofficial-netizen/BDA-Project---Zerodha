"""Generate SYNTHETIC market files in the exact NSE market-watch and AMFI NAVAll.txt formats.

Used only when the real files are not present in BDA_Project/Data_MF_Equity_Indices/.
Every symbol starts with "S" + a sector code (e.g. SFIN014) and every fund house is
"Demo <Greek> Mutual Fund", so nothing can be mistaken for a real security or scheme.
Scheme codes are in the 900000+ range so they can never hit a real AMFI code.
"""
from __future__ import annotations

import csv
import random
from pathlib import Path

import numpy as np

from .common import SECTORS, config, path

# synthetic constituent counts per sector for a 500-stock broad index
SECTOR_COUNTS = {"Financial Services": 105, "IT": 30, "Energy": 25, "FMCG": 35, "Auto": 30,
                 "Capital Goods": 65, "Healthcare": 45, "Metals & Mining": 25, "Telecom": 8,
                 "Utilities": 17, "Others": 115}
CODES = {"Financial Services": "FIN", "IT": "IT", "Energy": "ENR", "FMCG": "FMC", "Auto": "AUT",
         "Capital Goods": "CAP", "Healthcare": "HLT", "Metals & Mining": "MET", "Telecom": "TEL",
         "Utilities": "UTL", "Others": "OTH"}
# synthetic sector drift for 365D / 30D % change (illustrative, not market data)
SECTOR_365 = {"Financial Services": 6, "IT": -12, "Energy": -8, "FMCG": 2, "Auto": 9,
              "Capital Goods": 4, "Healthcare": 11, "Metals & Mining": 7, "Telecom": 14,
              "Utilities": -3, "Others": 1}
SECTOR_30 = {"Financial Services": 1.5, "IT": -2.5, "Energy": -3.0, "FMCG": 0.5, "Auto": 2.0,
             "Capital Goods": 1.0, "Healthcare": 2.5, "Metals & Mining": 1.0, "Telecom": 3.0,
             "Utilities": -1.0, "Others": 0.0}
SIZE_SD = {"large": (11, 4), "next": (14, 5), "mid": (18, 6), "small": (25, 8), "micro": (32, 10)}
SIZE_DRIFT = {"large": 0, "next": 0, "mid": 0, "small": -3, "micro": -4}

HEADERS = ["SYMBOL \n", "OPEN \n", "HIGH \n", "LOW \n", "PREV. CLOSE \n", "LTP \n", "CHNG \n",
           "%CHNG \n", "VOLUME \n(shares)", "VALUE \n(₹ Crores)", "52W H \n", "52W L \n",
           "30 D %CHNG \n", "365 D % CHNG \n 30-Oct-2025"]


def _fmt(x: float, nd: int = 2) -> str:
    return f"{x:,.{nd}f}"


def _universe(rng: np.random.Generator) -> list[dict]:
    stocks = []
    for sec, n in SECTOR_COUNTS.items():
        for i in range(1, n + 1):
            stocks.append({"symbol": f"S{CODES[sec]}{i:03d}", "sector": sec})
    for j, sec in enumerate(SECTORS):  # 250 micro caps spread over sectors
        n = round(250 * SECTOR_COUNTS[sec] / 500)
        for i in range(1, n + 1):
            stocks.append({"symbol": f"S{CODES[sec]}M{i:02d}", "sector": sec, "micro": True})
    stocks = stocks[: 500 + 250] if len(stocks) >= 750 else stocks
    # assign size tiers within the 500 by a random "size" draw, per sector so every sector has large caps
    broad = [s for s in stocks if not s.get("micro")]
    # every sector gets at least 2 large caps, the rest of the 50 are spread by a random draw
    for sec in SECTORS:
        for s in [x for x in broad if x["sector"] == sec][:2]:
            s["size"] = "large"
    rest = [s for s in broad if "size" not in s]
    order = rng.permutation(len(rest))
    n_large_left = 50 - sum(1 for s in broad if s.get("size") == "large")
    sizes = ["large"] * n_large_left + ["next"] * 50 + ["mid"] * 150
    sizes += ["small"] * (len(rest) - len(sizes))
    for rank, idx in enumerate(order):
        rest[idx]["size"] = sizes[rank]
    for s in stocks:
        if s.get("micro"):
            s["size"] = "micro"
    # banks: a subset of large/mid financials; ~40% of them PSU
    fin = [s for s in broad if s["sector"] == "Financial Services" and s["size"] in ("large", "next", "mid")]
    for k, s in enumerate(fin[:12]):
        s["bank"] = True
        s["psu"] = k % 5 in (0, 2)
    return stocks


def _prices(rng: np.random.Generator, s: dict) -> dict:
    sd365, sd30 = SIZE_SD[s["size"]]
    r365 = rng.normal(SECTOR_365[s["sector"]] + SIZE_DRIFT[s["size"]], sd365)
    r365 = max(r365, -70.0)
    r30 = rng.normal(SECTOR_30[s["sector"]], sd30)
    ltp = float(np.exp(rng.normal(6.2, 1.1)))
    ltp = min(max(ltp, 12.0), 25000.0)
    day = rng.normal(0.1, 1.3)
    prev = ltp / (1 + day / 100)
    opn = prev * (1 + rng.normal(0, 0.5) / 100)
    high = max(ltp, opn, prev) * (1 + abs(rng.normal(0, 0.6)) / 100)
    low = min(ltp, opn, prev) * (1 - abs(rng.normal(0, 0.6)) / 100)
    year_ago = ltp / (1 + r365 / 100)
    h52 = max(ltp, year_ago) * (1 + abs(rng.normal(8, 5)) / 100)
    l52 = min(ltp, year_ago) * (1 - abs(rng.normal(8, 5)) / 100)
    vol = int(abs(rng.lognormal(13, 1.2)))
    return dict(open=opn, high=high, low=low, prev=prev, ltp=ltp, chng=ltp - prev, pchng=day,
                volume=vol, value=vol * ltp / 1e7, h52=h52, l52=l52, r30=r30, r365=r365)


def _write_index(fp: Path, name: str, level: float, members: list[dict], rng) -> None:
    eq30 = float(np.mean([m["px"]["r30"] for m in members]))
    eq365 = float(np.mean([m["px"]["r365"] for m in members]))
    day = float(np.mean([m["px"]["pchng"] for m in members]))
    prev = level / (1 + day / 100)
    rows = [[name, _fmt(prev * 1.001), _fmt(level * 1.004), _fmt(prev * 0.996), _fmt(prev),
             _fmt(level), _fmt(level - prev), _fmt(day), _fmt(sum(m["px"]["volume"] for m in members), 0),
             _fmt(sum(m["px"]["value"] for m in members)), _fmt(level * 1.12), _fmt(level * 0.86),
             _fmt(eq30), _fmt(eq365)]]
    for m in members:
        p = m["px"]
        r30 = "-" if rng.random() < 0.015 else _fmt(p["r30"])   # a few missing values, like real files
        rows.append([m["symbol"], _fmt(p["open"]), _fmt(p["high"]), _fmt(p["low"]), _fmt(p["prev"]),
                     _fmt(p["ltp"]), _fmt(p["chng"]), _fmt(p["pchng"]), _fmt(p["volume"], 0),
                     _fmt(p["value"]), _fmt(p["h52"]), _fmt(p["l52"]), r30, _fmt(p["r365"])])
    with open(fp, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(HEADERS)
        w.writerows(rows)


AMCS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa", "Lambda", "Sigma"]
FUND_CATS = [  # (AMFI category header, name stem, share of AMCs offering it)
    ("Open Ended Schemes(Equity Scheme - Large Cap Fund)", "Large Cap Fund", 0.9),
    ("Open Ended Schemes(Equity Scheme - Flexi Cap Fund)", "Flexi Cap Fund", 0.9),
    ("Open Ended Schemes(Equity Scheme - Mid Cap Fund)", "Mid Cap Fund", 0.8),
    ("Open Ended Schemes(Equity Scheme - Small Cap Fund)", "Small Cap Fund", 0.7),
    ("Open Ended Schemes(Equity Scheme - ELSS)", "ELSS Tax Saver Fund", 0.7),
    ("Open Ended Schemes(Equity Scheme - Sectoral/ Thematic)", "Manufacturing Theme Fund", 0.5),
    ("Open Ended Schemes(Hybrid Scheme - Aggressive Hybrid Fund)", "Aggressive Hybrid Fund", 0.7),
    ("Open Ended Schemes(Hybrid Scheme - Balanced Advantage)", "Balanced Advantage Fund", 0.6),
    ("Open Ended Schemes(Debt Scheme - Liquid Fund)", "Liquid Fund", 1.0),
    ("Open Ended Schemes(Debt Scheme - Overnight Fund)", "Overnight Fund", 0.6),
    ("Open Ended Schemes(Debt Scheme - Short Duration Fund)", "Short Duration Fund", 0.6),
    ("Open Ended Schemes(Debt Scheme - Corporate Bond Fund)", "Corporate Bond Fund", 0.6),
    ("Open Ended Schemes(Debt Scheme - Gilt Fund)", "Gilt Fund", 0.4),
    ("Open Ended Schemes(Other Scheme - Index Funds)", "Nifty 50 Index Fund", 0.8),
    ("Open Ended Schemes(Other Scheme - Other  ETFs)", "Nifty 50 ETF", 0.5),
    ("Open Ended Schemes(Other Scheme - Gold ETF)", "Gold ETF", 0.4),
    ("Open Ended Schemes(Other Scheme - FoF Overseas)", "US Equity FoF", 0.3),
    ("Close Ended Schemes(Debt Scheme - Fixed Maturity Plan)", "Fixed Term Plan Series 12", 0.3),
]


def _write_navall(fp: Path, rng: np.random.Generator) -> None:
    pyr = random.Random(int(rng.integers(1_000_000)))
    code = 900001
    lines = ["Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date", ""]
    for cat, stem, share in FUND_CATS:
        lines += [cat, ""]
        for amc in AMCS:
            if pyr.random() > share:
                continue
            lines += [f"Demo {amc} Mutual Fund", ""]
            base = float(np.exp(rng.normal(3.8, 0.8)))
            is_etf = "ETF" in stem
            plans = [("Growth", "Direct Plan")] if is_etf else [
                ("Direct Plan", "Growth"), ("Direct Plan", "IDCW"), ("Regular Plan", "Growth"), ("Regular Plan", "IDCW")]
            for plan in plans:
                if is_etf:
                    name, date = f"Demo {amc} {stem}", "30-Oct-2026"
                else:
                    name = f"Demo {amc} {stem} - {plan[0]} - {plan[1]}"
                    date = "30-Oct-2026"
                    if "FoF Overseas" in cat:
                        date = "29-Oct-2026"
                    if "Fixed Maturity" in cat:
                        date = pyr.choice(["14-Mar-2018", "22-Jun-2022"])
                nav = base * (1.08 if "Direct" in str(plan) else 1.0) * (0.7 if "IDCW" in str(plan) else 1.0)
                isin_g = f"INFZZ{code % 100000:05d}A1"
                isin_r = f"INFZZ{code % 100000:05d}B9" if "IDCW" in str(plan) else "-"
                lines.append(f"{code};{isin_g};{isin_r};{name};{nav:.4f};{date}")
                code += 1
            lines.append("")
    fp.write_text("\n".join(lines) + "\n", encoding="utf-8")


def generate(out_dir: Path | None = None, seed: int | None = None) -> Path:
    out = out_dir or path("synthetic_data_dir")
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed if seed is not None else config()["population"]["seed"])
    stocks = _universe(rng)
    for s in stocks:
        s["px"] = _prices(rng, s)
    broad = [s for s in stocks if not s.get("micro")]
    by = lambda pred: sorted([s for s in stocks if pred(s)], key=lambda s: s["symbol"])
    mid = by(lambda s: s["size"] == "mid")
    files = {
        "MW-NIFTY-50": ("NIFTY 50", 24500.0, by(lambda s: s["size"] == "large")),
        "MW-NIFTY-500": ("NIFTY 500", 22350.0, sorted(broad, key=lambda s: s["symbol"])),
        "MW-NIFTY-BANK": ("NIFTY BANK", 52100.0, by(lambda s: s.get("bank"))),
        "MW-NIFTY-MIDCAP-150": ("NIFTY MIDCAP 150", 20400.0, mid),
        "MW-NIFTY-MIDCAP-SELECT": ("NIFTY MIDCAP SELECT", 12900.0, mid[::6][:25]),
        "MW-NIFTY-SMALLCAP-250": ("NIFTY SMALLCAP 250", 16100.0, by(lambda s: s["size"] == "small")),
        "MW-NIFTY-MICROCAP-250": ("NIFTY MICROCAP 250", 22800.0, by(lambda s: s["size"] == "micro")),
    }
    for stem, (name, lvl, members) in files.items():
        _write_index(out / f"{stem}-30-Oct-2026.csv", name, lvl, members, rng)
    with open(out / "sector_map_synthetic.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["SYMBOL", "SECTOR", "SOURCE", "CONFIDENCE", "SIZE", "PSU_BANK"])
        for s in sorted(stocks, key=lambda s: s["symbol"]):
            w.writerow([s["symbol"], s["sector"], "synthetic generator", "HIGH", s["size"],
                        "Y" if s.get("psu") else ""])
    _write_navall(out / "NAVAll.txt", rng)
    (out / "README.txt").write_text(
        "SYNTHETIC market data generated by yourbroker.synthetic_market for the academic prototype.\n"
        "Formats mirror NSE market-watch CSVs and AMFI NAVAll.txt. Values are not real market data.\n"
        "Place real files in BDA_Project/Data_MF_Equity_Indices/ to replace them.\n", encoding="utf-8")
    return out
