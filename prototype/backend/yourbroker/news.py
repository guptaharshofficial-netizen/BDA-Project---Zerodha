"""Live headlines from Google News (RSS search), top 5 per sector or stock.

- Runs only when the computer running the app is online; any failure returns ok=False plus a link the
  user can open themselves. Nothing is invented and headlines are shown as-is with their publisher.
- Cached for 30 minutes per query so repeated clicks don't hit Google News again.
- Headlines are third-party content: they are not checked or endorsed, and never feed the risk score
  or the recommendation rules.
"""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

from .common import config

_cache: dict[str, tuple[float, dict]] = {}
_lock = threading.Lock()
TTL = 30 * 60

# Plain-language search phrases per sector bucket (Google News works best with common words)
SECTOR_QUERY = {
    "Financial Services": "India banks NBFC financial stocks",
    "IT": "India IT services stocks TCS Infosys",
    "Energy": "India oil gas energy stocks",
    "FMCG": "India FMCG consumer stocks",
    "Auto": "India auto sector stocks",
    "Capital Goods": "India capital goods infrastructure stocks",
    "Healthcare": "India pharma healthcare stocks",
    "Metals & Mining": "India metal mining stocks",
    "Telecom": "India telecom stocks",
    "Utilities": "India power utilities stocks",
    "Others": "Indian stock market",
}


def _cfg() -> dict:
    return (config().get("news") or {})


def build_query(kind: str, name: str, symbol: str | None = None) -> str:
    if kind == "sector":
        base = SECTOR_QUERY.get(name, f"India {name} sector stocks")
    else:
        clean = re.sub(r"\b(Ltd|Limited|Ltd\.)\.?$", "", name or symbol or "").strip(" .")
        base = f'"{clean}" share' if clean else f"{symbol} NSE"
    days = int(_cfg().get("days", 14))
    return f"{base} when:{days}d"


def search_url(q: str) -> str:
    return "https://news.google.com/search?" + urllib.parse.urlencode({"q": q, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"})


def rss_url(q: str) -> str:
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"})


def parse_rss(xml_text: str, limit: int = 5) -> list[dict]:
    root = ET.fromstring(xml_text)
    out = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        src_el = item.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        # Google appends " - Publisher" to titles; drop it when we already have the publisher
        if source and title.endswith(" - " + source):
            title = title[: -len(" - " + source)]
        pub = item.findtext("pubDate")
        iso = None
        if pub:
            try:
                iso = parsedate_to_datetime(pub).isoformat()
            except Exception:
                iso = None
        if title:
            out.append({"title": title, "source": source or "Google News", "link": (item.findtext("link") or "").strip(), "published": iso})
        if len(out) >= limit:
            break
    return out


def headlines(kind: str, name: str, symbol: str | None = None, limit: int = 5) -> dict:
    q = build_query(kind, name, symbol)
    base = {"query": q, "open_url": search_url(q), "provider": "Google News",
            "label": "Headlines from Google News, shown as published. Not checked by us and not a reason to buy or sell."}
    if not _cfg().get("enabled", True):
        return {**base, "ok": False, "items": [], "reason": "Live news is switched off in config.yaml."}
    now = time.time()
    with _lock:
        hit = _cache.get(q)
    if hit and now - hit[0] < TTL:
        return {**hit[1], "cached": True}
    try:
        import httpx
        r = httpx.get(rss_url(q), timeout=float(_cfg().get("timeout_s", 5)), follow_redirects=True,
                      headers={"User-Agent": "Mozilla/5.0 (academic prototype)"})
        r.raise_for_status()
        items = parse_rss(r.text, limit)
        res = {**base, "ok": True, "items": items, "fetched_at": time.strftime("%Y-%m-%d %H:%M")}
        if not items:
            res["reason"] = "No headlines in the last few days for this search."
        with _lock:
            _cache[q] = (now, res)
        return res
    except Exception as e:  # offline, blocked, or Google changed the feed
        return {**base, "ok": False, "items": [], "reason": f"Couldn't reach Google News from this computer ({type(e).__name__}). Use the link to open it yourself."}


if __name__ == "__main__":  # quick manual check: python -m yourbroker.news
    print(json.dumps(headlines("sector", "IT"), indent=2)[:2000])
