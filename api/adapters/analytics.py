"""Amplitude + Statsig. Server side we only log; the browser SDKs do the rest."""
from __future__ import annotations

import logging

from .base import configured

log = logging.getLogger("milo.analytics")


def status_amplitude() -> str:
    return "live" if configured("AMPLITUDE_API_KEY") else "mock"


def status_statsig() -> str:
    return "live" if configured("STATSIG_CLIENT_KEY") else "mock"


def track(event: str, props: dict | None = None) -> None:
    log.info("track %s %s", event, props or {})
