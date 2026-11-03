"""k-means on the four standardised dimension scores; k selection, persona naming, evaluation."""
from __future__ import annotations

import numpy as np
import pandas as pd

# scikit-learn and SciPy are needed only to TRAIN the model (make_data / build.py). The running app only places a user
# in a cluster with plain numpy (assign below), so these are imported lazily. This keeps the server start fast and lets it
# run on machines where a security policy blocks SciPy's compiled files (e.g. Windows Smart App Control).
def _ml():
    from scipy.optimize import linear_sum_assignment
    from sklearn.cluster import KMeans
    from sklearn.metrics import adjusted_rand_score, davies_bouldin_score, silhouette_score
    from sklearn.preprocessing import StandardScaler
    return linear_sum_assignment, KMeans, adjusted_rand_score, davies_bouldin_score, silhouette_score, StandardScaler

from .common import catalogue, config, versions, write_json
from .profile import DIMS, band, make_grid, pct_from_grid, raw_dimension_scores

# Hypothesised personas from the clustering design, translated to band units (1-4).
# Very low=1.0 Low=1.5 Low-Med=2.0 Med=2.5 Med-High=3.0 High=3.5 ; Any=None (ignored)
LEVEL = {"very low": 1.0, "low": 1.5, "low-med": 2.0, "low–med": 2.0, "med": 2.5, "med-high": 3.0, "med–high": 3.0, "high": 3.5, "any": None}
PERSONAS = {
    "Active Trader": ("High", "Low", "High", "Med-High"),
    "Systematic Saver": ("Low", "High", "Med", "Low-Med"),
    "Hands-on Wealth Builder": ("Low-Med", "Low", "Med-High", "High"),
    "Dormant / Just-in-time": ("Very low", "Low", "Any", "Any"),
    "Income Preserver": ("Low", "Med", "Low", "Med-High"),
}
PERSONA_TEXT = {
    "Active Trader": "Trades often and picks investments directly; little automated investing.",
    "Systematic Saver": "Invests mostly through regular SIPs and rarely trades.",
    "Hands-on Wealth Builder": "Larger portfolio managed by hand, with moderate trading.",
    "Dormant / Just-in-time": "Has an account but has not transacted for a long time.",
    "Income Preserver": "Larger, lower-risk portfolio with little trading.",
}


def persona_vectors() -> dict[str, list]:
    return {p: [LEVEL[v.lower()] for v in vals] for p, vals in PERSONAS.items()}


def to_band_units(cont: np.ndarray) -> np.ndarray:
    """Continuous percentile (0-1) -> band scale where band k is centred on k."""
    return 0.5 + 4 * np.asarray(cont)


def dimension_table(pop: pd.DataFrame) -> tuple[pd.DataFrame, dict, dict]:
    feats = ["trades_per_month", "days_since_last_txn", "sip_share", "high_risk_share", "aum_inr", "monthly_inflow_inr"]
    fgrids = {f: make_grid(pop[f]) for f in feats}
    raw = pd.DataFrame([raw_dimension_scores(r, fgrids) for r in pop[feats].to_dict("records")])
    cgrids = {d: make_grid(raw[d]) for d in DIMS}
    cont = pd.DataFrame({d: [pct_from_grid(v, cgrids[d]) for v in raw[d]] for d in DIMS})
    return cont, fgrids, cgrids


def select_k(X: np.ndarray, cfg: dict) -> tuple[int, list[dict]]:
    _, KMeans, _, davies_bouldin_score, silhouette_score, _ = _ml()
    lo, hi = cfg["clustering"]["k_range"]
    table = []
    for k in range(lo, hi + 1):
        km = KMeans(n_clusters=k, n_init=cfg["clustering"]["n_init"], random_state=0).fit(X)
        table.append({"k": k, "silhouette": float(silhouette_score(X, km.labels_)),
                      "davies_bouldin": float(davies_bouldin_score(X, km.labels_)), "inertia": float(km.inertia_)})
    df = pd.DataFrame(table)
    df["rank"] = df["silhouette"].rank(ascending=False) + df["davies_bouldin"].rank(ascending=True)
    pref = cfg["clustering"]["preferred_k"]
    lo_e, hi_e = cfg["clustering"]["expected_k_range"]

    def best_of(sub):
        m = sub["rank"].min()
        cands = sub[sub["rank"] == m]["k"].tolist()
        return pref if pref in cands else min(cands)

    unconstrained = best_of(df)
    inside = df[(df.k >= lo_e) & (df.k <= hi_e)]
    # Rule (set before fitting): pick the best combined rank inside the literature range 4-6;
    # if the unconstrained optimum lies outside it, report that as a finding.
    chosen = best_of(inside)
    for r in table:
        r["combined_rank"] = float(df.loc[df.k == r["k"], "rank"].iloc[0])
    table.append({"_meta": True, "unconstrained_best_k": int(unconstrained), "expected_range": [lo_e, hi_e],
                  "outside_range_flag": bool(unconstrained != chosen)})
    return chosen, table


def name_clusters(centroids_band: np.ndarray, tol: float) -> list[dict]:
    linear_sum_assignment = _ml()[0]
    pv = persona_vectors()
    names = list(pv.keys())
    cost = np.zeros((len(centroids_band), len(names)))
    for i, c in enumerate(centroids_band):
        for j, n in enumerate(names):
            v = pv[n]
            diffs = [(c[d] - v[d]) for d in range(4) if v[d] is not None]
            cost[i, j] = float(np.sqrt(np.mean(np.square(diffs))))
    rows, cols = linear_sum_assignment(cost)
    assign = {r: c for r, c in zip(rows, cols)}
    out = []
    for i in range(len(centroids_band)):
        dist_row = {names[j]: round(float(cost[i, j]), 3) for j in range(len(names))}
        j = assign.get(i)
        if j is not None and cost[i, j] <= tol:
            out.append({"cluster": i, "name": names[j], "distance": float(cost[i, j]), "matched": True,
                        "distances": dist_row, "description": PERSONA_TEXT[names[j]]})
        else:
            out.append({"cluster": i, "name": f"Unnamed cluster {i + 1}", "distance": float(cost[i, j]) if j is not None else None,
                        "matched": False, "distances": dist_row,
                        "description": "Did not match any hypothesised persona within tolerance."})
    return out


def adoption_by_cluster(pop: pd.DataFrame, labels: np.ndarray, k: int) -> dict:
    cats = list(catalogue().keys())
    out = {}
    for c in range(k):
        members = pop[labels == c]
        n = len(members)
        out[str(c)] = {"n": int(n), "adoption": {cat: float(members["holdings"].map(lambda h: cat in h).mean()) if n else 0.0 for cat in cats}}
    return out


def precision_at_3(pop: pd.DataFrame, labels: np.ndarray, adoption: dict, seed: int = 7) -> dict:
    """Hide one held (recommendable) product per user; check whether the top-3 cluster gap list recovers it."""
    rng = np.random.default_rng(seed)
    cat = catalogue()
    blocked = {c for c, v in cat.items() if v.get("blocked")}
    glob = {c: float(pop["holdings"].map(lambda h: c in h).mean()) for c in cat}
    hits = base_hits = n = 0
    per_cluster: dict[str, list] = {}
    for lab, held in zip(labels, pop["holdings"]):
        cand = [h for h in held if h not in blocked]
        if len(cand) < 2:
            continue
        hidden = cand[rng.integers(len(cand))]
        visible = set(held) - {hidden}
        ad = adoption[str(lab)]["adoption"]
        ranked = sorted([c for c in ad if c not in visible and c not in blocked], key=lambda c: -ad[c])[:3]
        pop_rank = sorted([c for c in glob if c not in visible and c not in blocked], key=lambda c: -glob[c])[:3]
        hit = hidden in ranked
        hits += hit
        base_hits += hidden in pop_rank
        n += 1
        per_cluster.setdefault(str(lab), []).append(hit)
    return {"precision_at_3": hits / n if n else None, "global_popularity_baseline": base_hits / n if n else None,
            "users_evaluated": n, "per_cluster": {k: float(np.mean(v)) for k, v in per_cluster.items()},
            "protocol": "hide one held, non-blocked product per user (seeded); hit if it is in the top 3 cluster-adoption list among products not held"}


def fit(pop: pd.DataFrame) -> dict:
    _, KMeans, adjusted_rand_score, _, _, StandardScaler = _ml()
    cfg = config()
    cont, fgrids, cgrids = dimension_table(pop)
    Xb = to_band_units(cont[DIMS].values)
    scaler = StandardScaler().fit(Xb)
    X = scaler.transform(Xb)
    k, ktable = select_k(X, cfg)
    km = KMeans(n_clusters=k, n_init=cfg["clustering"]["n_init"], random_state=0).fit(X)
    labels = km.labels_
    cent_band = scaler.inverse_transform(km.cluster_centers_)
    names = name_clusters(cent_band, cfg["clustering"]["persona_match_tolerance"])

    # stability across seeds
    aris = []
    for s in cfg["clustering"]["seeds"][1:]:
        alt = KMeans(n_clusters=k, n_init=cfg["clustering"]["n_init"], random_state=s).fit(X).labels_
        aris.append(adjusted_rand_score(labels, alt))
    # stability across two synthetic 'time windows' (window B = window A with re-drawn behavioural noise)
    rng = np.random.default_rng(99)
    popB = pop.copy()
    popB["trades_per_month"] = (pop["trades_per_month"] * np.exp(rng.normal(0, 0.25, len(pop)))).round(1)
    popB["days_since_last_txn"] = (pop["days_since_last_txn"] * np.exp(rng.normal(0, 0.25, len(pop)))).round()
    popB["monthly_inflow_inr"] = pop["monthly_inflow_inr"] * np.exp(rng.normal(0, 0.2, len(pop)))
    contB, _, _ = dimension_table(popB)
    XB = scaler.transform(to_band_units(contB[DIMS].values))
    kmB = KMeans(n_clusters=k, n_init=cfg["clustering"]["n_init"], random_state=0).fit(XB)
    ari_window = adjusted_rand_score(labels, kmB.labels_)

    adoption = adoption_by_cluster(pop, labels, k)
    p3 = precision_at_3(pop, labels, adoption)
    bands = pd.DataFrame({d: [band(v) for v in cont[d]] for d in DIMS})

    business = []
    for nm in names:
        c = str(nm["cluster"])
        ad = adoption[c]["adoption"]
        n = adoption[c]["n"]
        gaps = sorted([(cat, ad[cat]) for cat in ad if not catalogue()[cat].get("blocked")], key=lambda x: -x[1])
        top = []
        for cat, rate in gaps[:4]:
            top.append({"category": cat, "label": catalogue()[cat]["label"], "adoption": rate,
                        "members_without": int(round(n * (1 - rate)))})
        business.append({"cluster": nm["cluster"], "name": nm["name"], "size": n, "top_categories": top})

    model = {
        **versions(), "synthetic_population": True, "n_users": int(len(pop)), "k": int(k),
        "k_selection": ktable, "k_rule": "lowest combined rank of silhouette (higher better) and Davies-Bouldin (lower better) within the literature range 4-6; ties -> preferred k=5",
        "k_meta": ktable[-1], "k_selection_rows": [r for r in ktable if not r.get("_meta")],
        "scaler_mean": scaler.mean_.tolist(), "scaler_scale": scaler.scale_.tolist(),
        "centroids_std": km.cluster_centers_.tolist(), "centroids_band": cent_band.tolist(),
        "clusters": names, "feature_grids": fgrids, "composite_grids": cgrids,
        "adoption": adoption,
        "stability": {"seed_ari_mean": float(np.mean(aris)), "seed_ari_min": float(np.min(aris)), "n_seeds": len(aris) + 1,
                      "window_ari": float(ari_window),
                      "window_note": "Window B is SYNTHETIC: window A with re-drawn behavioural noise (no real time series exists)."},
        "evaluation": {"precision": p3, "silhouette": next(r["silhouette"] for r in ktable if r.get("k") == k),
                       "davies_bouldin": next(r["davies_bouldin"] for r in ktable if r.get("k") == k)},
        "business_view": business,
        "persona_vectors": persona_vectors(),
        "scatter_sample": [
            {"activity": float(a), "automation": float(b), "risk": float(c), "capacity": float(d), "cluster": int(l)}
            for a, b, c, d, l in zip(*[to_band_units(cont[x].values) for x in DIMS], labels)
        ][::6],
        "band_distribution": {d: bands[d].value_counts().sort_index().to_dict() for d in DIMS},
    }
    write_json("model.json", model)
    pop_out = pop.assign(cluster=labels, **{f"band_{d}": bands[d] for d in DIMS})
    pop_out.to_json(_pop_path(), orient="records")
    return model


def _pop_path():
    from .common import artifacts
    return artifacts() / "population.json"


def assign(cont: dict, model: dict) -> int:
    xb = to_band_units(np.array([[cont[d] for d in DIMS]]))
    x = (xb - np.array(model["scaler_mean"])) / np.array(model["scaler_scale"])
    d = np.linalg.norm(np.array(model["centroids_std"]) - x, axis=1)
    return int(np.argmin(d))


def assign_from_bands(bands: dict, model: dict) -> int:
    """Quiz-based (Track A) profile: place the band centre (k -> percentile (k-0.5)/4)."""
    return assign({d: (bands[d] - 0.5) / 4 for d in DIMS}, model)
