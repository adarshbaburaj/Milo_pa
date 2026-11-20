"""Firedrill — strict insurance reviewer simulation.

Fallback: large-model role-play, then a deterministic rule-based reviewer.
"""
from __future__ import annotations

from .base import configured

SPONSOR = "firedrill"


def status() -> str:
    return "live" if configured("FIREDRILL_API_KEY") else "mock"
