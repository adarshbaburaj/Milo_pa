"""Airbyte — pulls the denial email + policy into the agent's context.

Mock: data/inbox/*.
"""
from __future__ import annotations

import state
from .base import configured, sponsor_call

SPONSOR = "airbyte"


def status() -> str:
    return "live" if configured("AIRBYTE_API_KEY") else "mock"


async def sync_inbox() -> list[dict]:
    def mock():
        docs = []
        for p in sorted((state.DATA / "inbox").glob("*")):
            docs.append({"id": p.stem, "name": p.name, "text": p.read_text()})
        return docs

    value, _ = await sponsor_call(SPONSOR, "sync_inbox", None, mock)
    return value
