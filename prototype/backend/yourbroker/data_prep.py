"""Parse NSE market-watch CSVs and AMFI NAVAll.txt; build sector statistics and the fund universe.

Real files in BDA_Project/Data_MF_Equity_Indices/ always win. If any are missing, the
synthetic files in prototype/data/synthetic_market/ are used and the run is labelled synthetic.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .common import DATA, SECTORS, config, path, write_json

COLMAP = [  # (regex on normalised header, canonical name)
    (r"^SYMBOL$", "symbol"), (r"^OPEN$", "open"), (r"^HIGH$", "high"), (r"^LOW$", "low"),
    (r"^PREV\.? ?CLOSE$", "prev_close"), (r"^LTP$", "ltp"), (r"^(CHNG|CHANGE)$", "change"),
    (r"^% ?(CHNG|CHANGE)$", "pct_change"), (r"^VOLUME", "volume"), (r"^VALUE", "value"),
    (r"^52W ?H", "high_52w"), (r"^52W ?L", "low_52w"), (r"^30 ?D ?% ?CHNG", "chg_30d"),
    (r"^365 ?D ?% ?CHNG", "chg_365d"),
]


def normalise_header(h: str) -> str:
    h = h.replace("﻿", "").replace("\n", " ").strip().upper()
    h = re.sub(r"\s+", " ", h)
    for rx, name in COLMAP:
        if re.search(rx, h):
            return name
    return h


def to_num(v) -> float:
    """'1,164.90' -> 1164.9 ; '-' / '' -> NaN."""
    if v is None:
        return np.nan
    s = str(v).strip().replace(",", "")
    if s in ("", "-", "--", "NA", "N/A"):
        return np.nan
    try:
        return float(s)
    except ValueError:
        return np.nan


def parse_index_csv(fp: Path | str) -> tuple[dict, pd.DataFrame]:
    """Returns (index_row, constituents). The first data row is the index itself."""
    raw = Path(fp).read_bytes().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw)))
    rows = [r for r in rows if any(c.strip() for c in r)]
    header = [normalise_header(h) for h in rows[0]]
    df = pd.DataFrame(rows[1:], columns=header)
    for c in df.columns:
        if c != "symbol":
            df[c] = df[c].map(to_num)
    df["symbol"] = df["symbol"].str.strip()
    index_row = df.iloc[0].to_dict()
    return index_row, df.iloc[1:].reset_index(drop=True)


CAT_RX = re.compile(r"^(Open|Close|Interval) Ended Schemes", re.I)


def fund_asset_class(category: str) -> tuple[str, str]:
    """AMFI category header -> (catalogue category, return-assumption key)."""
    c = category.lower()
    if "liquid" in c or "overnight" in c or "money market" in c:
        return "liquid_fund", "liquid"
    if "debt scheme" in c or "gilt" in c or "fixed maturity" in c:
        return "debt_fund", "debt"
    if "hybrid" in c or "balanced" in c:
        return "hybrid_fund", "hybrid"
    if "gold" in c or "silver" in c:
        return "gold_etf", "gold"
    if "index" in c:
        return "index_fund_sip", "equity_large"
    if "etf" in c:
        return "index_fund_sip", "index_etf"
    if "fof overseas" in c or "international" in c:
        return "us_stocks", "international"
    if "thematic" in c or "sectoral" in c:
        return "core_mf_sip", "equity_thematic"
    if "small cap" in c:
        return "core_mf_sip", "equity_small"
    if "mid cap" in c:
        return "core_mf_sip", "equity_mid"
    if "large cap" in c:
        return "core_mf_sip", "equity_large"
    if "equity" in c or "elss" in c:
        return "core_mf_sip", "equity_flexi"
    return "core_mf_sip", "equity_flexi"


def _short_category(cat: str) -> str:
    """'Open Ended Schemes(Equity Scheme - Flexi Cap Fund)' -> 'Equity Scheme - Flexi Cap Fund' (handles nested brackets)."""
    i = cat.find("(")
    return cat[i + 1:-1].strip() if i >= 0 and cat.endswith(")") else cat


def parse_navall(fp: Path | str, keep_date: str) -> tuple[pd.DataFrame, dict]:
    """Parse AMFI NAVAll.txt (6- or 8-column layout). Keep Direct Plan Growth rows dated keep_date."""
    text = Path(fp).read_text(encoding="utf-8-sig", errors="replace")
    lines = text.splitlines()
    header = [h.strip() for h in lines[0].split(";")]
    ncol = len(header)
    category = amc = None
    recs, report = [], {"total_rows": 0, "dropped_stale_date": 0, "dropped_not_direct_growth": 0,
                        "dropped_bad_nav": 0, "kept": 0, "layout_columns": ncol}
    for ln in lines[1:]:
        s = ln.strip()
        if not s:
            continue
        if ";" not in s:
            if CAT_RX.match(s):
                category = s
            else:
                amc = s
            continue
        parts = [p.strip() for p in s.split(";")]
        if len(parts) < 6 or not parts[0].isdigit():
            continue
        report["total_rows"] += 1
        if ncol >= 8 and len(parts) >= 8:
            code, isin_g, isin_r, name, plan, option, nav, date = parts[:8]
        else:
            code, isin_g, isin_r, name, nav, date = parts[:6]
            plan = "Direct" if re.search(r"direct", name, re.I) else ("Regular" if re.search(r"regular", name, re.I) else "")
            option = "Growth" if re.search(r"growth", name, re.I) else ("IDCW" if re.search(r"idcw|dividend", name, re.I) else "")
        is_etf = category and "ETF" in category
        direct_growth = (re.search(r"direct", plan, re.I) and re.search(r"growth", option, re.I)) or (is_etf and not re.search(r"regular|idcw", name, re.I))
        if date != keep_date:
            report["dropped_stale_date"] += 1
            continue
        if not direct_growth:
            report["dropped_not_direct_growth"] += 1
            continue
        navf = to_num(nav)
        if np.isnan(navf) or navf <= 0:
            report["dropped_bad_nav"] += 1
            continue
        cat_key, ret_key = fund_asset_class(category or "")
        recs.append({"scheme_code": code, "name": name, "amc": amc, "category": category,
                     "category_short": _short_category(category or ""),
                     "catalogue": cat_key, "assumption_key": ret_key, "nav": navf, "date": date})
    df = pd.DataFrame(recs)
    report["kept"] = len(df)
    return df, report


def locate_inputs(regenerate: bool = False) -> dict:
    """Prefer real files; fall back to synthetic ones. Returns file paths and the mode."""
    cfg = config()
    real, syn = path("real_data_dir"), path("synthetic_data_dir")
    stems = list(cfg["data"]["index_files"].keys())

    def find(d: Path, stem: str):
        if not d.exists():
            return None
        hits = sorted(d.glob(f"{stem}-*.csv")) or sorted(d.glob(f"{stem}*.csv"))
        hits = [h for h in hits if re.fullmatch(re.escape(stem) + r"(-\d{2}-[A-Za-z]{3}-\d{4})?", h.stem)]
        return hits[0] if hits else None

    real_idx = {s: find(real, s) for s in stems}
    real_nav = real / "NAVAll.txt" if (real / "NAVAll.txt").exists() else None
    # Real mode needs only the broad index (NIFTY 500); other index files are optional extras.
    real_ok = real_idx.get("MW-NIFTY-500") is not None
    if real_ok:
        idx = {s: f for s, f in real_idx.items() if f is not None}
        missing = [s for s, f in real_idx.items() if f is None]
        mode_eq = "real"
    else:
        if regenerate or not (syn / "NAVAll.txt").exists():
            from .synthetic_market import generate
            generate(syn)
        idx = {s: find(syn, s) for s in stems}
        idx = {s: f for s, f in idx.items() if f is not None}
        missing = []
        mode_eq = "synthetic"
    if real_nav is None and not (syn / "NAVAll.txt").exists():
        from .synthetic_market import generate
        generate(syn)
    nav = real_nav or syn / "NAVAll.txt"
    return {"index_files": idx, "nav_file": nav, "equity_mode": mode_eq, "missing_index_files": missing,
            "nav_mode": "real" if real_nav else "synthetic"}


# NSE "Industry" (from niftyindices.com constituent lists) -> the 11 prototype buckets
NSE_INDUSTRY = {
    "financial services": "Financial Services", "information technology": "IT",
    "oil gas & consumable fuels": "Energy", "oil, gas & consumable fuels": "Energy",
    "fast moving consumer goods": "FMCG", "automobile and auto components": "Auto",
    "capital goods": "Capital Goods", "healthcare": "Healthcare", "metals & mining": "Metals & Mining",
    "telecommunication": "Telecom", "power": "Utilities",
}


def official_sector_lists() -> pd.DataFrame | None:
    """Optional: NSE constituent lists (e.g. ind_nifty500list.csv) with an 'Industry' column."""
    real = path("real_data_dir")
    if not real.exists():
        return None
    rows = []
    for fp in sorted(real.glob("ind_*list*.csv")):
        try:
            df = pd.read_csv(fp, encoding="utf-8-sig")
        except Exception:
            continue
        cols = {c.strip().lower(): c for c in df.columns}
        if "symbol" not in cols or "industry" not in cols:
            continue
        names = df[cols["company name"]] if "company name" in cols else [None] * len(df)
        for sym, ind, nm in zip(df[cols["symbol"]], df[cols["industry"]], names):
            ind_s = str(ind).strip()
            rows.append({"SYMBOL": str(sym).strip(), "SECTOR": NSE_INDUSTRY.get(ind_s.lower(), "Others"),
                         "SOURCE": f"NSE constituent list ({fp.name}): {ind_s}", "CONFIDENCE": "HIGH",
                         "COMPANY": str(nm).strip() if nm else None, "INDUSTRY": ind_s})
    return pd.DataFrame(rows) if rows else None


def load_sector_map(symbols: list[str]) -> pd.DataFrame:
    frames = [pd.read_csv(DATA / "sector_map.csv")]
    synp = path("synthetic_data_dir") / "sector_map_synthetic.csv"
    if synp.exists():
        frames.append(pd.read_csv(synp, keep_default_na=False))
    off = official_sector_lists()
    if off is not None:
        frames.append(off)  # official NSE industry wins over model knowledge
    m = pd.concat(frames, ignore_index=True).drop_duplicates("SYMBOL", keep="last").set_index("SYMBOL")
    psu_real = {"SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK", "BANKINDIA", "INDIANB", "CENTRALBK",
                "IOB", "UCOBANK", "MAHABANK", "PSB"}  # public-sector banks (model knowledge)
    out = []
    for s in symbols:
        if s in m.index:
            r = m.loc[s]
            clean = lambda v: "" if v is None or (isinstance(v, float) and np.isnan(v)) else str(v)
            out.append({"symbol": s, "sector": r["SECTOR"], "source": r["SOURCE"], "confidence": r["CONFIDENCE"],
                        "size": clean(r.get("SIZE")), "psu_bank": clean(r.get("PSU_BANK")) == "Y" or s in psu_real,
                        "company": clean(r.get("COMPANY")) or None, "industry": clean(r.get("INDUSTRY")) or r["SECTOR"]})
        else:
            out.append({"symbol": s, "sector": "Financial Services" if s in psu_real else "Others",
                        "source": "unmapped - defaulted", "confidence": "LOW", "size": "", "psu_bank": s in psu_real,
                        "company": None, "industry": "Not classified"})
    return pd.DataFrame(out)


def sector_stats(cons: pd.DataFrame, bench_row: dict, small_n: int) -> list[dict]:
    rows = []
    for sec in SECTORS:
        g = cons[cons["sector"] == sec]
        n = len(g)
        if n == 0:
            rows.append({"sector": sec, "n": 0})
            continue
        r365, r30 = g["chg_365d"].dropna(), g["chg_30d"].dropna()
        rows.append({
            "sector": sec, "n": n,
            "median_30d": float(r30.median()) if len(r30) else None, "mean_30d": float(r30.mean()) if len(r30) else None,
            "median_365d": float(r365.median()) if len(r365) else None, "mean_365d": float(r365.mean()) if len(r365) else None,
            "share_positive_365d": float((r365 > 0).mean()) if len(r365) else None,
            "small_sample": n < small_n,
            "vs_bench_365d_pts": (float(r365.median()) - bench_row["chg_365d"]) if len(r365) else None,
        })
    return rows


def build(regenerate_synthetic: bool = True) -> dict:
    cfg = config()
    inp = locate_inputs(regenerate_synthetic)
    names = cfg["data"]["index_files"]
    indices, members = {}, {}
    for stem, fp in inp["index_files"].items():
        row, cons = parse_index_csv(fp)
        indices[names[stem]] = {"file": Path(fp).name, "ltp": row.get("ltp"), "chg_30d": row.get("chg_30d"),
                                "chg_365d": row.get("chg_365d"), "n_constituents": len(cons)}
        members[names[stem]] = cons
    universe = pd.concat(members.values()).drop_duplicates("symbol").reset_index(drop=True)
    smap = load_sector_map(universe["symbol"].tolist())
    universe = universe.merge(smap, on="symbol", how="left")
    for name, cons in members.items():
        universe[f"in_{re.sub(r'[^A-Z0-9]+', '_', name)}"] = universe["symbol"].isin(cons["symbol"])
    n500 = universe[universe["in_NIFTY_500"]]
    bench = indices["NIFTY 500"]
    bench_mix = (n500["sector"].value_counts(normalize=True) * 100).reindex(SECTORS).fillna(0).round(2).to_dict()
    stats = sector_stats(n500, bench, cfg["data"]["small_sector_n"])

    funds, nav_report = parse_navall(inp["nav_file"], cfg["data"]["nav_keep_date"])

    # data-quality report
    missing_30 = int(universe["chg_30d"].isna().sum())
    missing_365 = int(universe["chg_365d"].isna().sum())
    unmapped = smap[smap["confidence"] == "LOW"]["symbol"].tolist()
    dq = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "equity_mode": inp["equity_mode"], "nav_mode": inp["nav_mode"],
        "files": {k: Path(v).name for k, v in inp["index_files"].items()} | {"NAVAll": Path(inp["nav_file"]).name},
        "universe_size": len(universe), "nifty500_size": len(n500),
        "missing_30d_values": missing_30, "missing_365d_values": missing_365,
        "low_confidence_sector_rows": len(unmapped), "low_confidence_examples": unmapped[:15],
        "nav": nav_report,
        "notes": [
            "Benchmark sector mix = share of Nifty 500 constituents by count (equal-weight proxy), not market-cap weights.",
            "Only 30D and 365D % changes exist for stocks; no multi-year price history.",
            "Only one day's NAV exists for funds; no fund return can be computed from the dataset.",
            "Fund AUM, expense ratio and riskometer are not in the dataset and are never shown.",
        ],
    }
    if inp.get("missing_index_files"):
        dq["notes"].append("Optional index files not supplied: " + ", ".join(inp["missing_index_files"]) + ". Membership falls back to available indices.")
    if inp["equity_mode"] != "real":
        dq["notes"].insert(0, "SYNTHETIC equity data: real NSE files were not found in Data_MF_Equity_Indices/.")
    if inp["nav_mode"] != "real":
        dq["notes"].insert(0, "SYNTHETIC fund data: real AMFI NAVAll.txt was not found in Data_MF_Equity_Indices/.")

    market = {
        "asof": cfg["versions"]["data_asof"], "equity_mode": inp["equity_mode"], "nav_mode": inp["nav_mode"],
        "indices": indices, "benchmark": "NIFTY 500", "benchmark_mix": bench_mix,
        "benchmark_mix_method": "equal-weight proxy: share of Nifty 500 constituents by count",
        "sector_stats": stats,
        "stocks": universe.replace({np.nan: None}).to_dict(orient="records"),
        "funds": funds.to_dict(orient="records"),
    }
    write_json("market.json", market)
    write_json("data_quality.json", dq)
    return {"market": market, "dq": dq}


def print_report(dq: dict) -> None:
    print("\n=== Data-quality report ===")
    print(f"Equity data: {dq['equity_mode'].upper()}   Fund data: {dq['nav_mode'].upper()}")
    print(f"Universe: {dq['universe_size']} stocks (Nifty 500: {dq['nifty500_size']})")
    print(f"Missing 30D values: {dq['missing_30d_values']}  Missing 365D values: {dq['missing_365d_values']}")
    print(f"Low-confidence sector rows: {dq['low_confidence_sector_rows']}")
    n = dq["nav"]
    print(f"NAV rows: {n['total_rows']} total, kept {n['kept']} (Direct Growth, dated today); dropped "
          f"{n['dropped_stale_date']} stale-date, {n['dropped_not_direct_growth']} non-Direct-Growth, {n['dropped_bad_nav']} bad NAV")
    for note in dq["notes"]:
        print(" -", note)
