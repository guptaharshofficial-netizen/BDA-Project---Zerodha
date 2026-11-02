"""'Market context' notes per sector. Pluggable: replace StaticContextProvider with a news-API
provider later. No news or events are invented: every note cites a document in the project folder."""
from __future__ import annotations

LETTER = "Founder's letter '16 years of Zerodha: Fresh enthusiasm', 26 Aug 2026"
LABEL = "Illustrative context. Not a forecast."

_GENERAL = [
    {"text": "The Nifty 500 'has gone nowhere in the last two years' while several international markets rose.", "source": LETTER},
    {"text": "The rupee has been under pressure and FIIs have been pulling money out.", "source": LETTER},
]
_SECTOR = {
    "Energy": [{"text": "An energy crisis triggered by war in the Middle East has hit an economy that imports most of its crude and gas.", "source": LETTER}],
    "IT": [{"text": "Global markets have seen a large AI-related rally; the letter notes Indian public markets have had no real AI play (no frontier labs, semiconductors or data-centre plays).", "source": LETTER}],
    "Metals & Mining": [{"text": "The letter notes India imports most of its gold, which adds to rupee pressure.", "source": LETTER}],
    "Financial Services": [{"text": "The letter describes growing margin-funding (MTF) books across brokers as a risk if markets fall sharply.", "source": LETTER}],
}


class StaticContextProvider:
    name = "static: documents in project folder"

    def for_sector(self, sector: str) -> dict:
        notes = _SECTOR.get(sector, [])
        if not notes:
            notes = [{"text": "No sector-specific context in the provided sources.", "source": "—"}]
        return {"sector": sector, "label": LABEL, "notes": notes, "general": _GENERAL, "provider": self.name}


PROVIDER = StaticContextProvider()


def for_sector(sector: str) -> dict:
    return PROVIDER.for_sector(sector)
