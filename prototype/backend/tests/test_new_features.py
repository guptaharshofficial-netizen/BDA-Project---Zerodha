"""Multi-instrument what-if, top-10 lists, peer groups, tracking consent and the news parser."""
from fastapi.testclient import TestClient

from yourbroker import news
from yourbroker.api import app

c = TestClient(app)


def _sid(*perms):
    sid = c.post("/api/session").json()["session"]
    for p in perms:
        c.post("/api/consent", json={"session": sid, "permission": p, "granted": True})
    return sid


def test_tracking_is_off_by_default_and_separate():
    sid = _sid()
    cons = c.get(f"/api/consent/{sid}").json()["consents"]
    assert cons["tracking"] is False
    assert "tracking" in c.get("/api/meta").json()["notice"]


def test_top_ten_by_default():
    e = c.get("/api/explore", params={"kind": "stock", "sector": "Financial Services"}).json()
    assert len(e["rows"]) == 10 and e["total"] > 10


def test_multi_whatif_across_sectors():
    sid = _sid("profile", "portfolio")
    picks = []
    for sec in ("IT", "Healthcare", "FMCG"):
        picks.append({"kind": "stock", "id": c.get("/api/explore", params={"kind": "stock", "sector": sec}).json()["rows"][0]["id"], "amount": 20000})
    fund = c.get("/api/explore", params={"kind": "fund", "category": "index"}).json()["rows"][0]
    picks.append({"kind": "fund", "id": fund["id"], "amount": 30000})
    r = c.post("/api/whatif", json={"session": sid, "user_id": "U01", "add": picks, "years": 3})
    assert r.status_code == 200, r.text
    j = r.json()
    assert len(j["added_list"]) == 4 and j["added_total"] == 90000
    assert {"IT", "Healthcare", "FMCG"} <= set(j["added_by_sector"])
    assert j["before"]["risk"] and j["after"]["risk"]
    assert len(j["projection"]["rows"]) == 4
    # spreading a PSU-bank-heavy portfolio across new sectors should not make it more concentrated
    order = {"Low": 0, "Moderate": 1, "High": 2}
    assert order[j["after"]["concentration"]["level"]] <= order[j["before"]["concentration"]["level"]]


def test_single_whatif_still_works_and_bad_id_is_400():
    sid = _sid("profile", "portfolio")
    sym = c.get("/api/explore", params={"kind": "stock", "sector": "IT"}).json()["rows"][0]["id"]
    assert c.post("/api/whatif", json={"session": sid, "user_id": "U01", "add": {"kind": "stock", "id": sym, "amount": 5000}}).status_code == 200
    assert c.post("/api/whatif", json={"session": sid, "user_id": "U01", "add": [{"kind": "stock", "id": "NOPE", "amount": 5000}]}).status_code == 400


def test_peer_groups_separate_groups_from_types():
    sid = _sid("profile", "portfolio")
    p = c.post("/api/existing", json={"session": sid, "user_id": "U01"}).json()["peers"]
    keys = [g["key"] for g in p["groups"]]
    assert "funds" in keys and "trading" in keys
    funds = next(g for g in p["groups"] if g["key"] == "funds")
    core = next(s for s in funds["subtypes"] if s["category"] == "core_mf_sip")
    assert "Flexi cap" in core["kinds"] and core["fund_group"] == "flexicap"
    assert all(not g["blocked"] for g in p["gaps"])  # F&O / MTF never appear as improvement areas


SAMPLE = """<?xml version="1.0"?><rss><channel>
<item><title>IT stocks rally on deal wins - Economic Times</title><link>https://example.org/a</link>
<pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate><source url="https://economictimes.com">Economic Times</source></item>
<item><title>Second headline - Mint</title><link>https://example.org/b</link><source url="x">Mint</source></item>
</channel></rss>"""


def test_news_parser_and_query():
    items = news.parse_rss(SAMPLE)
    assert items[0]["title"] == "IT stocks rally on deal wins" and items[0]["source"] == "Economic Times"
    assert items[0]["published"].startswith("2026-11-02")
    assert "when:" in news.build_query("sector", "IT")
    assert news.build_query("stock", "Infosys Ltd.", "INFY").startswith('"Infosys" share')


def test_news_endpoint_fails_gracefully_offline():
    r = c.get("/api/news", params={"kind": "sector", "name": "IT"}).json()
    assert "open_url" in r and r["open_url"].startswith("https://news.google.com/")
    assert isinstance(r["items"], list)
