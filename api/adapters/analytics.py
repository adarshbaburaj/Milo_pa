"""Amplitude + Statsig. Server side we only log; the browser SDKs do the rest."""
from __future__ import annotations

import logging

from .base import configured

log = logging.getLogger("milo.analytics")


def _web_env(name: str) -> bool:
    """The browser SDKs are configured in web/.env.local (public client keys)."""
    try:
        from pathlib import Path

        txt = (Path(__file__).resolve().parents[2] / "web" / ".env.local").read_text()
        return any(l.startswith(name + "=") and len(l.split("=", 1)[1].strip()) > 8 for l in txt.splitlines())
    except OSError:
        return False


def status_amplitude() -> str:
    return "live" if configured("AMPLITUDE_API_KEY") or _web_env("NEXT_PUBLIC_AMPLITUDE_API_KEY") else "mock"


def status_statsig() -> str:
    return "live" if configured("STATSIG_CLIENT_KEY") or _web_env("NEXT_PUBLIC_STATSIG_CLIENT_KEY") else "mock"


def track(event: str, props: dict | None = None) -> None:
    log.info("track %s %s", event, props or {})
