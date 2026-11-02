# Reading notes

These notes cover what was read before building, the facts the prototype relies on, and where the sources disagree.

**Read in full:** the build prompt (16 pp.), the BRD draft v0.1 (30 Oct 2026), and the Clustering Design (7 pp. folder copy).
**Read to verify cited claims:** the five cluster papers.
**Read via OCR (scanned):** Zerodha philosophy page, "User disengagement" (Kailash Nadh, 2022), "Scaling with common sense", and the founder's 16-year letter (26 Aug 2026).
**Skimmed for headline findings:** the SEBI F&O trading-behaviour study (FY25–FY26) and the SEBI anchor-investor exit study.
**Used as references only:** the DPDP Rules, the SEBI IA Regulations and the other regulation PDFs. Commencement dates are taken from the BRD.

## Facts relied on

| Fact | Source |
|---|---|
| The four clustering dimensions are Activity, Automation, Risk appetite and Capacity, each on a 1–4 quartile band. Products held are *not* a clustering input, because that would make the logic circular. | Clustering Design |
| Self-assessed risk tolerance did not separate behavioural clusters, and demographic KYC data did not explain behaviour. k was chosen by silhouette and Davies–Bouldin, landing on k=5. | Thompson et al. 2021 (JRFM 14:50), verified in text |
| Age had no significant link to the investor segments. There were 5 segments. | Kumar, Goyal & Basu 2018 (IJBM) |
| 29% of respondents chose "low risk" together with "high yield". Savings/surplus works as a capacity measure. | Kovács et al. 2021 (J Big Data 8:141), verified in text |
| Products can be put into risk tiers. Precision@k is a usable metric. Fuzzy k-means is an extension. | Yang 2024 (IJCIS 17:310) |
| Start simple, choose metrics up front, and check stability. | Mehta et al. 2025 (JPM 52(2)) |
| No tracking or profiling of customer behaviour, no engagement spam, no unnecessary cross-selling, no gate-keeping of education. | Zerodha philosophy page |
| Utility over engagement; "Don't do unto others what you don't want done unto you." | User disengagement blog; founder letter |
| Nifty 500 has gone nowhere in two years. India has had no AI play. The Middle East energy crisis has hit an import-heavy economy. The rupee is under pressure and FIIs have been selling. MTF "isn't a good product for most customers". "F&O trading is bad for almost 99% of retail traders." | Founder letter, 26 Aug 2026 |
| 93% of individual equity-derivative traders were "only options buyers" in FY26. About 90% of options buyers made losses. More experience did not improve outcomes. | SEBI trading-behaviour study FY25–FY26 |
| DPDP Rule 4 commences 13 Nov 2026; Rules 3 and 5–16 commence 13 May 2027. Rule 3 requires a standalone, itemised notice and withdrawal as easy as consent. Rule 6 covers security safeguards. | BRD §13.3 |
| Kite Connect's MF orders endpoint covers only the last 7 days, and a holdings snapshot cannot support lifetime-return or tax-lot analysis. | BRD §10.2 |

## Contradictions found, and how each was resolved

1. **Brief vs clustering design on age and income.** The brief's Layer 2 asks for age, income and liabilities. The design drops them. *Resolved:* they are collected only in the optional suitability layer and are never clustering features. Age is used only in the horizon and life-stage guardrails.
2. **Design-doc card copy "Start with ₹1,000?".** This is a nudge and conflicts with neutral wording and no engagement mechanics. *Resolved:* no amount prompt. Cards read "Investors like you… You don't yet." and offer "options to explore".
3. **"Cross-sell" language vs Zerodha's "no unnecessary cross-selling".** *Resolved:* outputs are category-level only, pass guardrails, appear only when the user opens the tool, and never name a scheme or stock.
4. **Activity uses trade frequency vs BRD §10.3 ("do not infer risk appetite from order frequency").** *Resolved:* frequency feeds only the Activity dimension. Risk appetite comes from product tiers held, and stated willingness comes from the quiz. Where revealed and stated risk disagree, both are shown and the mismatch is flagged rather than overwritten (BRD §7.2 step 4).
5. **Behavioural clustering vs Zerodha's "no direct or indirect tracking or profiling".** *Resolved:* clustering is opt-in under the portfolio permission and uses on-platform transaction features only. The analytics permission is off by default and unused by the model. This tension is listed as a finding, not hidden.
6. **Loans against securities (LAS) suggested for U02 vs "do not present leverage as a way to invest more".** *Resolved:* LAS is shown only as an alternative to selling when cash is needed. It is labelled "credit product, not an investment", carries a friction note, and is never shown alongside a "do more" prompt.
7. **"Top 15 performing" vs no ranking or suggestion.** *Resolved:* this is a past-performance screen with an alphabetical toggle. No row is highlighted, and every list is labelled "Past-performance screen. Not a recommendation."
8. **FD placement.** The brief says "FD (off-platform, shown for education)". The founder letter says Zerodha started offering FDs in 2026. *Resolved:* the brief is followed, and the catalogue note records the discrepancy.
9. **Group AMC conflict.** The founder letter shows the group AMC runs liquid, gold and silver ETFs, and the recommender may surface those *categories*. This is listed as a compliance question for counsel.
10. **Missing inputs.** The prompt references `Data_MF_Equity_Indices/`, `Prototype_Reference/` and "Clustering Design 2" (11 pp.), none of which are in the folder. Market and NAV sites are not reachable from the build workspace. *Resolved:* synthetic files are generated in the exact NSE and AMFI formats (see ASSUMPTIONS.md A1–A4). The pipeline automatically uses real files if they are placed in `BDA_Project/Data_MF_Equity_Indices/`.
11. **AMFI column list.** The prompt lists 8 columns (with Plan and Option). The public AMFI NAVAll.txt has 6, with plan and option inside the scheme name. *Resolved:* the parser accepts both layouts.
