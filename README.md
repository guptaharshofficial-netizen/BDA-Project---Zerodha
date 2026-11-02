# YourBroker · AI Portfolio Analysis & Recommendation Tool

An **academic prototype** of a portfolio-insights layer for the Zerodha ecosystem (Kite, Coin, smallcase), shown under the neutral name "YourBroker".

- **New investors** answer a short money-first setup.
- They then pick sectors ranked by past performance, add stocks or funds to a planning basket, and see how to spread their risk.
- **Existing investors** get a health check against their goals, sectors to diversify into, what-if calculations, and "investors like you" comparisons.
- An **AI summary** pulls it together.

> Not investment advice. Not an official Zerodha product. Stock and fund data are NSE / AMFI snapshots dated 30 Oct 2026. The "investors like you" population is simulated.

## Live demo
After you deploy (below), the app runs at a URL like `https://yourbroker-ai-portfolio.onrender.com`.

## Deploy it (free, about 10 minutes)
1. **Create a GitHub repository.** On github.com: **New repository** → name it (e.g. `yourbroker-ai-portfolio`) → Public → **Create**.
2. **Upload these files.** On the new repo page: **uploading an existing file** → drag in *everything inside this folder* (`Dockerfile`, `render.yaml`, `README.md`, `.gitignore`, `.dockerignore`, and the folders `prototype`, `docs`, `Data_MF_Equity_Indices`) → **Commit changes**.
   GitHub's web uploader takes up to 100 files at a time; if it complains, upload the folders in two batches.
3. **Host it on Render.** Sign up at render.com with your GitHub account → **New** → **Blueprint** → choose your repo → **Apply**. Render reads `render.yaml`, builds the Docker image and gives you a live URL. The first build takes about 5–8 minutes.
4. Share the URL.

**Free-plan note:** the app sleeps after about 15 minutes without visitors, and the next visit takes about a minute to wake it. Open the link a minute before a presentation.

**Updating:** change files on GitHub and Render redeploys automatically.

## Run it on your own computer
Python 3.11+:
```
cd prototype
pip install -r requirements.txt
cd backend
python -m yourbroker.build
python -m uvicorn yourbroker.api:app --port 8000
```
Then open http://localhost:8000. On Windows you can use `prototype\setup.bat`, `make_data.bat` and `make_dev.bat` instead.

## What's inside
| Folder | Contents |
|---|---|
| `prototype/backend` | Python (FastAPI) engine: data parsing, synthetic population, k-means clustering, recommender with guardrails, risk score, calculators, consent log, tests |
| `prototype/frontend` | React + Tailwind UI. `dist/` is pre-built, so no Node is needed to deploy |
| `prototype/data` | Config: test personas, product catalogue, return assumptions, sector map |
| `Data_MF_Equity_Indices` | NSE market-watch CSVs, the Nifty 500 industry list and AMFI NAVAll.txt (30 Oct 2026) |
| `docs` | Reading notes, assumptions, risk-score method |

See `prototype/README.md` for the full walkthrough, demo script, architecture and data limits.

## Data and licensing note
The market files are public downloads from NSE, niftyindices.com and AMFI, included for academic demonstration only. Check their terms of use before any wider or commercial use. If you'd rather not publish them, delete `Data_MF_Equity_Indices/`; the app then runs on clearly labelled synthetic market data.


## Deploy on Vercel (from GitHub)

1. Push this folder to a GitHub repo.
2. vercel.com → Add New → Project → import the repo (framework: FastAPI, auto-detected; `app.py` at the root is the entrypoint).
3. Environment variables: `CONSENT_SECRET` (any long random string; signs the consent token) and optionally `ANTHROPIC_API_KEY`.
4. Deploy. Every push to `main` redeploys.

Notes: Vercel runs serverless copies that don't share memory, so consent is carried in a signed token the browser sends back (`X-Consent-Token`). The audit log and NAV cache go to `/tmp` and reset on cold starts. The prebuilt data in `prototype/artifacts` is committed so no build step is needed; to refresh it, run `make data` locally and commit the result.
