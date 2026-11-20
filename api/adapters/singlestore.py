"""SingleStore — case tracker + receipts store. Mock: SQLite (state.py)."""
from __future__ import annotations

from .base import configured

SPONSOR = "singlestore"


def status() -> str:
    return "live" if configured("SINGLESTORE_URL") else "mock"
