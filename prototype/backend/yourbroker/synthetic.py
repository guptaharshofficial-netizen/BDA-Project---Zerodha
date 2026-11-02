"""SYNTHETIC existing-user population (about 3,000 users, fixed seed).

Five overlapping Gaussian mixtures around the persona profiles (in a transformed feature
space), plus ~12% 'messy' users sampled between two personas. Product holdings are drawn
from cluster-conditional probabilities in data/population_config.yaml. The five test users
are appended to the population.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .common import config, load_yaml

FEATURES = ["trades_per_month", "days_since_last_txn", "sip_share", "high_risk_share", "aum_inr", "monthly_inflow_inr"]


def _fwd(f: str, x):
    x = np.asarray(x, dtype=float)
    if f in ("sip_share", "high_risk_share"):
        x = np.clip(x, 0.01, 0.99)
        return np.log(x / (1 - x))
    if f in ("aum_inr",):
        return np.log(np.maximum(x, 1000))
    return np.log1p(np.maximum(x, 0))


def _inv(f: str, z):
    z = np.asarray(z, dtype=float)
    if f in ("sip_share", "high_risk_share"):
        v = 1 / (1 + np.exp(-z))
        # snap tails to exact 0/1 the way real portfolios often sit
        return np.where(v < 0.04, 0.0, np.where(v > 0.97, 1.0, v))
    if f == "aum_inr":
        return np.exp(z)
    return np.expm1(z).clip(min=0)


def generate(n: int | None = None, seed: int | None = None) -> pd.DataFrame:
    cfg, pc = config(), load_yaml("population_config.yaml")
    n = n or cfg["population"]["n_users"]
    rng = np.random.default_rng(seed if seed is not None else cfg["population"]["seed"])
    personas = list(pc["personas"].keys())
    shares = np.array([pc["personas"][p]["share"] for p in personas])
    shares = shares / shares.sum()
    messy = cfg["population"]["messy_share"]
    cats = sorted({c for p in personas for c in pc["personas"][p]["holdings"]})
    rows = []
    for i in range(n):
        a = rng.choice(len(personas), p=shares)
        mean_a = {f: _fwd(f, pc["personas"][personas[a]]["mean"][f]) for f in FEATURES}
        probs = dict(pc["personas"][personas[a]]["holdings"])
        is_messy = rng.random() < messy
        src = personas[a]
        if is_messy:
            b = rng.choice([j for j in range(len(personas)) if j != a])
            w = rng.uniform(0.3, 0.7)
            mean_b = {f: _fwd(f, pc["personas"][personas[b]]["mean"][f]) for f in FEATURES}
            mean_a = {f: w * mean_a[f] + (1 - w) * mean_b[f] for f in FEATURES}
            pb = pc["personas"][personas[b]]["holdings"]
            probs = {c: w * probs.get(c, 0) + (1 - w) * pb.get(c, 0) for c in cats}
            src = f"{personas[a]} / {personas[b]}"
        feat = {f: float(_inv(f, rng.normal(mean_a[f], pc["noise_sd"][f]))) for f in FEATURES}
        feat["trades_per_month"] = round(feat["trades_per_month"], 1)
        feat["days_since_last_txn"] = int(round(feat["days_since_last_txn"]))
        held = [c for c in cats if rng.random() < probs.get(c, 0)]
        rows.append({"user_id": f"S{i:05d}", "source_persona": src, "messy": is_messy, **feat,
                     "holdings": held, "synthetic": True})
    df = pd.DataFrame(rows)
    return pd.concat([df, test_users_frame()], ignore_index=True)


def test_users_frame() -> pd.DataFrame:
    from .portfolio import demo_categories
    out = []
    for u in load_yaml("test_users.yaml")["users"]:
        if u["track"] != "existing":
            continue
        out.append({"user_id": u["id"], "source_persona": "test user", "messy": False,
                    "trades_per_month": u["trades_per_month"], "days_since_last_txn": u["days_since_last_txn"],
                    "sip_share": u["sip_share_of_inflows"], "high_risk_share": u["high_risk_share"],
                    "aum_inr": u["aum_inr"], "monthly_inflow_inr": u["monthly_inflow_inr"],
                    "holdings": demo_categories(u["id"]), "synthetic": False})
    return pd.DataFrame(out)
