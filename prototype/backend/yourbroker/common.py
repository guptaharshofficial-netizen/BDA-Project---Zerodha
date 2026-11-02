"""Shared paths, config and small helpers."""
from __future__ import annotations

import json
from functools import lru_cache
import os
from pathlib import Path
from typing import Any

try:  # PyYAML if available; otherwise the pure-Python ruamel.yaml (works on any Python version)
    import yaml as _yaml
    _safe_load = _yaml.safe_load
except ImportError:  # pragma: no cover
    from ruamel.yaml import YAML as _YAML

    def _safe_load(stream):
        # a fresh loader per call: a shared ruamel YAML object is not thread-safe
        return _YAML(typ="safe", pure=True).load(stream)

PROTO = Path(__file__).resolve().parents[2]          # .../prototype
DATA = PROTO / "data"


@lru_cache(maxsize=1)
def config() -> dict[str, Any]:
    with open(PROTO / "config.yaml", encoding="utf-8") as f:
        return _safe_load(f)


# On read-only hosts (Vercel, other serverless) only /tmp is writable: the audit log and the NAV cache go there.
WRITABLE = {"audit_log", "cache_dir"}


def _scratch() -> Path | None:
    d = os.environ.get("YB_WRITABLE_DIR") or ("/tmp/yourbroker" if os.environ.get("VERCEL") else None)
    return Path(d) if d else None


def path(key: str) -> Path:
    rel = config()["paths"][key]
    sc = _scratch()
    if sc is not None and key in WRITABLE:
        sc.mkdir(parents=True, exist_ok=True)
        return (sc / Path(rel).name).resolve()
    return (PROTO / rel).resolve()


def artifacts() -> Path:
    p = path("artifacts_dir")
    p.mkdir(parents=True, exist_ok=True)
    return p


def load_yaml(name: str) -> Any:
    with open(DATA / name, encoding="utf-8") as f:
        return _safe_load(f)


def write_json(name: str, obj: Any) -> Path:
    p = artifacts() / name
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False, default=_default)
    return p


def read_json(name: str) -> Any:
    with open(artifacts() / name, encoding="utf-8") as f:
        return json.load(f)


def _default(o: Any) -> Any:
    try:
        import numpy as np
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return None if np.isnan(o) else round(float(o), 6)
        if isinstance(o, np.ndarray):
            return o.tolist()
    except ImportError:  # pragma: no cover
        pass
    raise TypeError(f"not serialisable: {type(o)}")


def versions() -> dict[str, str]:
    v = config()["versions"]
    return {"model_version": v["model_version"], "rules_version": v["rules_version"],
            "data_asof": v["data_asof"]}


def catalogue() -> dict[str, dict]:
    return load_yaml("product_catalogue.yaml")["categories"]


SECTORS = ["Financial Services", "IT", "Energy", "FMCG", "Auto", "Capital Goods",
           "Healthcare", "Metals & Mining", "Telecom", "Utilities", "Others"]
