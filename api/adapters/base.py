"""Shared adapter plumbing.

Every sponsor call goes through `sponsor_call`, which:
  * runs the live implementation if the adapter is configured (and MOCK_ALL != 1),
  * falls back to the mock silently on error or after 4 s,
  * records {sponsor, op, live, latencyMs} into the current request trace so it
    lands in the Receipt.
"""
from __future__ import annotations

import asyncio
import inspect
import logging
import os
import time
from contextvars import ContextVar
from typing import Any, Awaitable, Callable, Optional

log = logging.getLogger("milo.adapters")

TIMEOUT_S = float(os.getenv("ADAPTER_TIMEOUT_S", "4"))

_trace: ContextVar[Optional[dict]] = ContextVar("milo_trace", default=None)


def mock_all() -> bool:
    return os.getenv("MOCK_ALL", "0") == "1"


def configured(*env_vars: str) -> bool:
    return not mock_all() and all(os.getenv(v) for v in env_vars)


def start_trace() -> dict:
    t = {"sponsorCalls": [], "models": []}
    _trace.set(t)
    return t


def current_trace() -> dict:
    t = _trace.get()
    if t is None:
        t = start_trace()
    return t


def record_sponsor(sponsor: str, op: str, live: bool, latency_ms: int) -> None:
    current_trace()["sponsorCalls"].append(
        {"sponsor": sponsor, "op": op, "live": live, "latencyMs": latency_ms}
    )


def record_model(name: str, latency_ms: int, tokens: Optional[int], tier: str) -> dict:
    m = {"name": name, "latencyMs": latency_ms, "tokens": tokens, "tier": tier}
    current_trace()["models"].append(m)
    return m


async def _maybe_await(v: Any) -> Any:
    return await v if inspect.isawaitable(v) else v


async def sponsor_call(
    sponsor: str,
    op: str,
    live: Optional[Callable[[], Awaitable[Any] | Any]],
    mock: Callable[[], Any],
    record: bool = True,
    timeout: float | None = None,
) -> tuple[Any, bool]:
    """Returns (value, was_live)."""
    t0 = time.perf_counter()
    if live is not None:
        try:
            value = await asyncio.wait_for(_maybe_await(live()), timeout=timeout or TIMEOUT_S)
            if record:
                record_sponsor(sponsor, op, True, int((time.perf_counter() - t0) * 1000))
            return value, True
        except Exception as e:  # noqa: BLE001 — demo must never break
            log.warning("%s.%s live call failed, using mock: %r", sponsor, op, e)
    t1 = time.perf_counter()
    value = await _maybe_await(mock())
    if record:
        record_sponsor(sponsor, op, False, int((time.perf_counter() - t1) * 1000))
    return value, False
