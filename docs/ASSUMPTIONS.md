# Assumptions

Every default taken without asking, and every place the data was too thin.

## Data (where the data was too thin)

| # | Gap | What was done |
|---|---|---|
| A1 | `Data_MF_Equity_Indices/` (the 7 NSE CSVs and NAVAll.txt) was not in the folder, and NSE, AMFI, mfapi and Yahoo are not reachable from the build environment. | `yourbroker/synthetic_market.py` generates **synthetic** files in the exact formats: UTF-8 BOM, quoted strings with thousands separators, `-` for missing values, the index row first, and an AMFI file with category and AMC headers, IDCW and Regular rows, and stale 2018/2022 rows. Symbols are fictional (`SFIN001`…), funds are "Demo <Greek> Mutual Fund", and scheme codes start at 900001 so they can never match a real scheme. **If real files are placed in `BDA_Project/Data_MF_Equity_Indices/`, `make data` uses them automatically**, and every screen shows which mode is live. |
| A2 | No sector column. | `data/sector_map.csv` seeds about 130 well-known NSE symbols from model knowledge, marked "to be verified against NSE". Unmapped real symbols default to "Others" with LOW confidence and are counted in the data-quality report. Synthetic symbols carry their sector from the generator. |
| A3 | No market-cap weights. | The benchmark sector mix is the share of Nifty 500 constituents by count (an equal-weight proxy), labelled as such. The weight source is swappable in `data_prep.build`. |
| A4 | No price or NAV history. | Stocks show only their 365-day change, as a separate marker ("last 1Y actual (not a forecast)"). Fund returns are never computed from the dataset. The calculator uses scenario assumptions in `data/return_assumptions.yaml` (placeholders, commented). The optional NAV-history fetch from api.mfapi.in runs only in real-data mode, is cached, and fails silently. |
| A5 | No fund AUM, expense ratio or riskometer. | These are not shown, and the data-quality report says so. |
| A6 | Test-user holdings are text descriptions ("4 mid-cap stocks"). | `data/test_user_holdings.yaml` turns each into concrete **illustrative** holdings picked by rule from the loaded universe. Amounts match each user's `aum_inr` and `high_risk_share`. Demo goals and suitability answers are illustrative and editable in the UI. |
| A7 | U04's "after ~3 months" profile switch has no data. | A clearly labelled SIMULATED feature set drives the demo toggle. |
| A8 | Market context. | `context_provider.py` uses only notes from the founder's 26 Aug 2026 letter, each with its source. Sectors without a note say so. The provider is pluggable for a news API. |

## Model and rules

| # | Default | Note |
|---|---|---|
| M1 | Synthetic population of 3,000 users plus 4 test users (seed 20261030), with 12% "messy" users between personas. | Feature means and holding probabilities are author assumptions in `data/population_config.yaml`. The noise sd was set once, not tuned to the expected profiles. |
| M2 | Clustering uses continuous dimension percentiles (the pre-banding score). Bands are shown in the UI. | Clustering on integer bands would produce ties and inflate silhouette. |
| M3 | **k rule:** lowest combined rank of silhouette and Davies–Bouldin *within the literature range 4–6*, with ties going to k=5. | Unconstrained, the metrics prefer **k=3**, which is reported as a finding on the Evaluation page. The chosen k=4 names four personas. Hands-on Wealth Builder is not matched; in quartile-banded space it merges into Active Trader. |
| M4 | Persona naming uses RMS distance in band units (Very low=1, Low=1.5, Low-Med=2, Med=2.5, Med-High=3, High=3.5; "Any" ignored), one-to-one Hungarian assignment, and a tolerance of 0.9. Otherwise the cluster is "Unnamed cluster N". | |
| M5 | Quiz mapping: Mix → Automation 2. Risk = mean of Q3 and Q4, rounded half-up. | Documented in `profile.QUIZ_MAP` and shown in "How is this calculated?". |
| M6 | Suitability band = the **lower** of stated willingness (Q3) and assessed capacity. | Conservative by design (BRD FR-04). |
| M7 | Rule-based cards run before cluster-gap cards: dormant-SIP restart, new-user cold start, life-stage (60+ or horizon under 3 years with a revealed-risk mismatch), then either an emergency buffer (no Low-tier liquid holding) or a liquid ETF for idle cash, but not both. | Each card names the rule that fired. |
| M8 | Loan against securities is shown only for existing holders of at least ₹5 lakh in direct equity, as an alternative to selling. It is labelled a credit product and is never phrased as a gap to fill. | Resolves the tension with the "no leverage" principle. |
| M9 | The synthetic time-window stability test compares window A with window A plus re-drawn behavioural noise. | No real time series exists. |
| M10 | Precision@3 uses hide-one with a seed, on non-blocked products, for users holding at least 2 products. The baseline is global popularity. | |

## Stack and running

| # | Default | Note |
|---|---|---|
| S1 | The backend serves the **pre-built** React UI from `frontend/dist`. | Only Python is needed to run the app. Node is needed only to rebuild the UI (`make ui`). |
| S2 | Windows `.bat` equivalents for `make data`, `make dev` and `make test`. | `make` is not standard on Windows. |
| S3 | A surface switcher option "All connected" is added next to Kite, Coin and smallcase. | Risk and diversification are computed on the in-scope holdings. The held-category list for recommendations always uses all connected sources, so nothing already held elsewhere is suggested. |
| S4 | The LLM summary model is set in `config.yaml` (`claude-sonnet-5-5`) and used only if `ANTHROPIC_API_KEY` is set. | The template summary is the default. |
| S5 | Sessions are in memory. Consent and analysis events go to `audit.jsonl` with masked session IDs. | No accounts and no credentials. |

## Brief vs evidence and guardrails: the choices made
- Gender, payment method and app browsing are excluded from the model (BRD 10.1/10.3, Kumar 2018, Thompson 2021).
- "Top 15 performing" is a neutral past-performance screen with an alphabetical toggle, and no row is highlighted.
- Behavioural clustering is opt-in and limited to on-platform transaction features, because it is in tension with Zerodha's published "no profiling or engagement tracking" principle.
- New users are never nudged toward individual stocks. Adding stocks beyond 20% of budget triggers a confirmation with the reason; it is not blocked.

All thresholds (30% adoption, quartile cut-points, the 20% cap, minimum cohort of 50, age cut-offs) must be re-derived on real data.
