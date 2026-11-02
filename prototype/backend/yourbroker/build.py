"""`make data`: parse market files, generate the synthetic population, fit clusters, write artifacts."""
from __future__ import annotations

import sys

from . import clustering, data_prep, synthetic
from .common import load_yaml, write_json


def expected_vs_computed(model: dict) -> list[dict]:
    from .profile import DIMS, computed_profile, quiz_profile
    rows = []
    for u in load_yaml("test_users.yaml")["users"]:
        if u["track"] == "new":
            prof = quiz_profile(u["quiz"])
            cl = clustering.assign_from_bands(prof, model)
            basis = "quiz (Track A)"
        else:
            f = {"trades_per_month": u["trades_per_month"], "days_since_last_txn": u["days_since_last_txn"],
                 "sip_share": u["sip_share_of_inflows"], "high_risk_share": u["high_risk_share"],
                 "aum_inr": u["aum_inr"], "monthly_inflow_inr": u["monthly_inflow_inr"]}
            prof = computed_profile(f, model)
            cl = clustering.assign(prof["_continuous"], model)
            basis = "platform data (Track B)"
        exp = u["expected_profile"]
        diffs = {d: prof[d] - exp[d] for d in DIMS}
        rows.append({"id": u["id"], "name": u["name"], "basis": basis, "expected": exp,
                     "computed": {d: prof[d] for d in DIMS}, "diff": diffs,
                     "flagged": [d for d in DIMS if abs(diffs[d]) > 1],
                     "cluster": cl, "cluster_name": model["clusters"][cl]["name"]})
    return rows


def main() -> int:
    print("[1/3] Parsing market files ...")
    r = data_prep.build()
    data_prep.print_report(r["dq"])
    from .portfolio import clear_cache
    clear_cache()
    print("\n[2/3] Generating SYNTHETIC population ...")
    pop = synthetic.generate()
    print(f"  {len(pop)} users ({int(pop['messy'].sum())} 'messy' between personas, plus test users)")
    print("\n[3/3] Clustering ...")
    model = clustering.fit(pop)
    print("\n  k   silhouette   Davies-Bouldin")
    for row in model["k_selection_rows"]:
        mark = "  <- chosen" if row["k"] == model["k"] else ""
        print(f"  {row['k']}   {row['silhouette']:.3f}        {row['davies_bouldin']:.3f}{mark}")
    km = model["k_meta"]
    if km["outside_range_flag"]:
        print(f"  FINDING: unconstrained best k = {km['unconstrained_best_k']} (outside expected {km['expected_range']}); chose best k inside range.")
    print("\n  cluster  size  persona                      RMS distance  centroid (Act/Auto/Risk/Cap)")
    for c in model["clusters"]:
        n = model["adoption"][str(c["cluster"])]["n"]
        cb = " / ".join(f"{v:.1f}" for v in model["centroids_band"][c["cluster"]])
        print(f"  {c['cluster']:<7}  {n:<4}  {c['name']:<28} {c['distance']:.2f}          {cb}")
    st, ev = model["stability"], model["evaluation"]
    print(f"\n  Stability: mean ARI across {st['n_seeds']} seeds = {st['seed_ari_mean']:.3f} (min {st['seed_ari_min']:.3f}); "
          f"synthetic time-window ARI = {st['window_ari']:.3f}")
    p = ev["precision"]
    print(f"  precision@3 (hide-one) = {p['precision_at_3']:.3f} vs global-popularity baseline {p['global_popularity_baseline']:.3f} "
          f"over {p['users_evaluated']} users")
    evc = expected_vs_computed(model)
    write_json("test_user_profiles.json", evc)
    print("\n  Test users: expected vs computed profile (A/Au/R/C)")
    for e in evc:
        ex = "/".join(str(e["expected"][d]) for d in ("activity", "automation", "risk", "capacity"))
        co = "/".join(str(e["computed"][d]) for d in ("activity", "automation", "risk", "capacity"))
        fl = f"  FLAG: {', '.join(e['flagged'])} differ by >1" if e["flagged"] else ""
        print(f"  {e['id']} {e['name']:<22} expected {ex}  computed {co}  -> {e['cluster_name']}{fl}")
    print("\nArtifacts written to prototype/artifacts/. All population data is SYNTHETIC.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
