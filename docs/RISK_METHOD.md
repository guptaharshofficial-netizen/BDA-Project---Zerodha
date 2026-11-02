# Risk score method

This is a transparent 0–100 portfolio risk score, mapped to four bands: 0–25 Low, 25–50 Medium-low, 50–75 Medium-high, 75–100 High. The code is in `prototype/backend/yourbroker/risk.py` and the weights and cut-offs are in `prototype/config.yaml`.

```
score = 0.45 × product-tier risk + 0.25 × concentration + 0.15 × horizon mismatch + 0.15 × capacity mismatch
```

| Component | Sub-formula (each 0–100) | Why this choice |
|---|---|---|
| Product-tier risk | Value-weighted tier points: Low = 0, Medium = 50, High = 100. Credit products (loan against securities) are excluded. | Uses the three tiers from the clustering design (Yang 2024). This is the simplest defensible measure of "how risky are the things you hold". |
| Concentration | Average of two parts. **Sector:** HHI excess over the benchmark, `(HHI_p − HHI_b) / (1 − HHI_b)`, clipped to 0–1. **Single stock:** the top stock's weight scaled linearly, where 10% scores 0 and 40% or more scores 100. | Compares the portfolio with the benchmark rather than with zero, so a broad index fund scores about 0. The single-stock part catches one large holding that sector HHI can hide. |
| Horizon mismatch | `max(0, tier risk − allowance)`. The allowance is <1 yr: 0, 1–3 yrs: 35, 3–5 yrs: 65, 5+ yrs: 100. The horizon comes from the nearest priority-1 goal. | High-tier holdings against a short goal horizon are the main suitability risk named in the BRD (FR-04, FR-11). |
| Capacity mismatch | `max(0, tier risk − allowance)`. The allowance is 25 / 50 / 75 / 100 for capacity bands 1–4. | Separates risk *capacity* from risk *willingness* (BRD FR-04, SEBI IA risk profiling). |

**Inputs and caveats**
- Equity mutual funds have no constituent data, so they are assumed to mirror the benchmark sector mix. Smallcases use an illustrative look-through.
- The benchmark mix is the Nifty 500 counted by number of constituents, an equal-weight proxy, because no market-cap data is available.
- F&O positions are not part of the score. They are shown as a separate overlay.

**Risk capacity**, which is separate from the behavioural Capacity dimension, is assessed as follows:
1. Start from the monthly-surplus band (1–4).
2. Subtract 1 if EMIs exceed half the surplus-band midpoint.
3. Subtract 1 if the emergency buffer is under one month.
4. Subtract 1 if the goal horizon is under three years.
5. Clip the result to 1–4.

**Gap reporting.** The UI reports the score band minus stated willingness, and the score band minus assessed capacity (for example "1 band above"), not just the level.

**Worked example (U02, synthetic data):**
`0.45×100 + 0.25×24.5 + 0.15×65 + 0.15×25 = 64.6` → Medium-high.

**Tests:** `backend/tests/test_profile_calc_risk.py::test_risk_bands_and_components`.
