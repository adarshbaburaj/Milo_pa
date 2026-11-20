"""Cognee — long-term memory (phrases, profile facts, case facts).

Mock: SQLite phrase table + keyword recall (state.py). Live wiring lands in P1.4
once the Cognee docs have been checked.
"""
from __future__ import annotations

import state
from .base import configured, sponsor_call

SPONSOR = "cognee"


def status() -> str:
    return "live" if configured("COGNEE_API_KEY") else "mock"


async def remember(kind: str, text: str, meta: dict | None = None) -> dict:
    def mock():
        if kind == "phrase":
            return state.bump_phrase(text, (meta or {}).get("kind"), (meta or {}).get("tool"))
        return {"ok": True}

    value, _ = await sponsor_call(SPONSOR, f"remember.{kind}", None, mock)
    return value


async def recall_phrases(k: int = 40) -> list[dict]:
    def mock():
        ps = state.list_phrases()
        ps.sort(key=lambda p: -p["count"])
        return ps[:k]

    value, _ = await sponsor_call(SPONSOR, "recall.phrases", None, mock)
    return value
