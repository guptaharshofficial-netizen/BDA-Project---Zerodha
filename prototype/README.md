# Tulana · AI Portfolio Analysis & Recommendation Tool (academic prototype)

This is a working prototype of an optional intelligence layer across Kite, Coin and smallcase, shown under the name "Tulana". It does five things:
- places a user in a behavioural cluster
- shows sector diversification and a transparent risk score
- lets the user try what-if investments
- shows what "investors like you" hold that the user does not
- explains the logic behind every suggestion

**It is an academic project, not a Zerodha product. Market data, the user population and holdings are synthetic or illustrative unless the screen says otherwise. It is not investment advice.**

## Run it

You need **Python 3.11+**. Node 18+ is needed only to rebuild the UI; a built copy is already in `frontend/dist`.

| | macOS / Linux | Windows (double-click or run in `cmd`) |
|---|---|---|
| Install packages (once) | `pip install -r requirements.txt` | `setup.bat` |
| Build data and model | `make data` | `make_data.bat` |
| Start the app | `make dev` → open http://localhost:8000 | `make_dev.bat` (opens the browser) |
| Run all tests | `make test` | `make_test.bat` |

Everything runs offline. The optional network calls are the NAV-history fetch (real-data mode only), live Google News headlines for "What's happening?" (switch off under `news:` in `config.yaml`), and the language-model summary (only if `ANTHROPIC_API_KEY` is set). Without a connection each one falls back gracefully.

**Using real market files.** Put the 7 NSE market-watch CSVs (`MW-NIFTY-50-30-Oct-2026.csv` …) and AMFI `NAVAll.txt` into `BDA_Project/Data_MF_Equity_Indices/`, then run `make data` again. The demo bar then shows "Equity data: real".

## 3-minute demo script

Open http://localhost:8000. Everything is reachable from the **Welcome** screen or the round **menu** button (top right).

1. **New investor (60 s).** Choose **Ask App Not to Track** on the first prompt. Click **Build my first portfolio** and allow "Your answers".
   - Fill in income, spending, EMIs and bank savings. The app shows what's left each month and your emergency cushion.
   - Add investments held elsewhere, then the amount to invest and when you'll need it, then three risk questions.
   - **My plan** shows your money, the risk that fits you, your "investors like you" group, and simple places to start.
   - Open the top-ranked sector, click **Top 10**, and add two stocks (each row also has **Go to Kite / Coin** and **News**). The basket shows the risk meter, how spread out it is, and **"look at next"** sectors. A third stock beyond 20% of the plan triggers a quick check.
   - **See what this could grow to** opens the calculator with the basket loaded. Funds use real 1/3/5-year CAGR from NAV history when online.
   - Click **✦ AI summary**.
2. **Harpreet (40 s).** Menu → Harpreet Singh Gill.
   - Overview: his risk is High, but only up to Moderate fits his 2-year goal.
   - He's concentrated in PSU banks, and options positions are shown separately.
   - The options to explore are a liquid ETF, a core MF SIP and a loan against securities.
   - In **Spread my risk**, open **Top 10** in IT, Healthcare and FMCG and tap **+ What-if** on one stock in each. The what-if basket collects them; **See how my risk changes** shows risk before and after, sector mix now vs after, and a value range.
   - **What's happening?** on any sector shows the top 5 Google News headlines (live when online).
   - **Investors like you** shows *Areas to improve* first, then what the group holds, by major group → product type → scheme types.
3. **Meenakshi (30 s).** Only low-risk options appear. Under "What we can't see", **Add and re-check** her ₹22 lakh of FDs, and her risk drops.
4. **Farah (20 s).** "Your SIP has been paused since 2023…" comes first, with no pressure and no new thematic bet.
5. **Reviewers (10 s).** Menu → **For reviewers** shows model evaluation and the live persona tests.

## Architecture

```
 NSE CSVs + AMFI NAVAll.txt ──► data_prep ──► artifacts/market.json, data_quality.json
 (real if present, else synthetic_market)
 population_config.yaml ──► synthetic (3,000 users) ──► profile (quartile bands) ──► clustering (k-means)
                                                                                   └► artifacts/model.json
 FastAPI (api.py) ── service ──┬─ portfolio (allocation, sector mix, HHI)    ─┐
                               ├─ risk (0–100 score)                          │ deterministic,
                               ├─ recommender (gap engine + guardrails)       │ versioned
                               ├─ calculator (lump sum, SIP, scenarios)       │
                               ├─ peers · context_provider · learn            ─┘
                               ├─ summary (template; optional LLM, validated)
                               └─ consent_audit (permissions, audit.jsonl)
 React + Vite + Tailwind + Recharts (frontend/) ──► built to frontend/dist, served at /
```

## Data provenance and limits
- **Equity and funds:** synthetic files in the NSE and AMFI formats (`data/synthetic_market/`), unless real files are supplied. Only 30-day and 365-day changes exist for stocks, and only one day's NAV for funds. So there is no 3- or 5-year CAGR and no fund return from the dataset.
- **Sectors:** from the generator (synthetic), or `data/sector_map.csv` for real symbols (model knowledge, to be verified).
- **Benchmark mix:** Nifty 500 by constituent count, an illustrative proxy.
- **Population:** synthetic, 3,000 users. Cluster statistics, the 30% threshold and the quartile cut-points must be re-derived on real data.
- **Holdings, goals and suitability answers for test users:** illustrative.
- **Return assumptions:** editable placeholders, not forecasts.
- **Market context:** founder's letter of 26 Aug 2026 as background notes, plus live Google News headlines shown as published (third-party, never used by the risk score or rules). No invented news.
- **Go to Kite / Coin:** opens the app's site in a new tab and copies the symbol or fund name; nothing is bought from here. Links are set under `app_links:` in `config.yaml`.

See `../docs/READING_NOTES.md`, `../docs/ASSUMPTIONS.md` and `../docs/RISK_METHOD.md`.

## Regulatory note
Personalised investment advice is a regulated activity, and a broker giving it has a conflict of roles. The proposal is a separate group entity registered with SEBI as an Investment Adviser, with arm's-length and client-segregation controls. The prototype stays category-level, never places orders, and labels everything "Not investment advice". Open questions for counsel:
- the entity structure and RIA registration path
- whether category-level and "investors like you" cards count as advice
- DPDP consent wording
- conflicts where a group fund house offers products in a suggested category

## Roadmap (beyond the prototype)
1. Real data and recalibration of thresholds.
2. A pilot behind a feature flag with a control group, measuring suitability and comprehension alongside retention (BRD §4.1).
3. Fuzzy clustering for users between personas.
4. A licensed news API in place of the Google News RSS search.
5. A compliance-approved product universe before any product-level output.
