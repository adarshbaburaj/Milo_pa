"""Senso — trusted context layer for chair specs + policy text.

Mock: data/catalog.json + data/policy.md with paragraph (§) citations.
"""
from __future__ import annotations

import re

import state
from .base import configured, sponsor_call

SPONSOR = "senso"


def status() -> str:
    return "live" if configured("SENSO_API_KEY") else "mock"


def policy_clauses() -> dict[str, str]:
    """{'§4.2(a)': 'A power mobility device ...', ...}"""
    out: dict[str, str] = {}
    for m in re.finditer(r"\*\*(§[\d.]+(?:\([a-z]\))?)[^*]*\*\*\s*(.+)", state.load_text("policy.md")):
        out[m.group(1)] = re.sub(r"\*\*", "", m.group(2)).strip()
    return out


async def get_spec(item_id: str) -> dict | None:
    value, _ = await sponsor_call(SPONSOR, "get_spec", None, lambda: state.get_chair(item_id))
    return value


async def get_catalog() -> list[dict]:
    value, _ = await sponsor_call(SPONSOR, "get_catalog", None, state.get_catalog)
    return value


async def query_policy(clause: str) -> dict:
    def mock():
        text = policy_clauses().get(clause, "")
        return {"answer": text, "citation": f"policy {clause}"}

    value, _ = await sponsor_call(SPONSOR, f"query_policy {clause}", None, mock)
    return value
