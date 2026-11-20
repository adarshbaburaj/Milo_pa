"""Superlinked SIE — multi-attribute ranking.

Mock: local weighted scoring.
"""
from __future__ import annotations

from typing import Callable

from .base import configured, sponsor_call

SPONSOR = "superlinked"


def status() -> str:
    return "live" if configured("SUPERLINKED_API_KEY") else "mock"


async def rank(op: str, items: list, key: Callable[[object], float]) -> list:
    value, _ = await sponsor_call(SPONSOR, f"rank.{op}", None, lambda: sorted(items, key=key))
    return value
