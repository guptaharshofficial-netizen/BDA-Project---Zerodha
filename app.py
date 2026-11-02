"""Vercel entrypoint: exposes the FastAPI app that lives in prototype/backend/yourbroker."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "prototype" / "backend"))

from yourbroker.api import app  # noqa: E402,F401  (Vercel looks for a variable named `app`)
