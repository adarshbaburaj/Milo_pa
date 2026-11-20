"""Airbyte — pulls Maria's inbox (the denial email) into the agent's context.

Live: PyAirbyte runs the real Airbyte `source-file` connector over data/inbox/inbox.jsonl and caches the stream in
DuckDB (no login, no Docker). Swap the source for `source-gmail` / `source-google-drive` with credentials and the rest
of Milo is unchanged. Set AIRBYTE_DISABLE=1 to force the mock.
Mock: read data/inbox/* directly.
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import logging
import os
import time

import state
from .base import mock_all, record_sponsor

SPONSOR = "airbyte"
log = logging.getLogger("milo.airbyte")
_cached: list[dict] | None = None
_last_sync: float = 0


def available() -> bool:
    return not mock_all() and os.getenv("AIRBYTE_DISABLE") != "1" and importlib.util.find_spec("airbyte") is not None


def status() -> str:
    return "live" if available() else "mock"


def _jsonl_path() -> str:
    p = state.DATA / "inbox" / "inbox.jsonl"
    if not p.exists():  # build the connector's input from the inbox files
        rows = []
        for f in sorted((state.DATA / "inbox").glob("*.md")):
            t = f.read_text()
            get = lambda k: next((l.split(":", 1)[1].strip() for l in t.splitlines() if l.startswith(k + ":")), "")  # noqa: E731
            rows.append({"id": f.stem, "from": get("From"), "date": get("Date"), "subject": get("Subject"), "body": t})
        p.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    return str(p.resolve())


def _sync_blocking() -> list[dict]:
    import airbyte as ab

    src = ab.get_source("source-file", config={"dataset_name": "inbox", "format": "jsonl", "url": _jsonl_path(),
                                              "provider": {"storage": "local"}}, install_if_missing=True)
    src.select_all_streams()
    res = src.read()
    out = []
    for ds in res.streams.values():
        for r in ds:
            out.append({"id": r.get("id"), "name": f"{r.get('id')}.md", "subject": r.get("subject"), "from": r.get("from"),
                        "date": r.get("date"), "text": r.get("body") or ""})
    return out


def _mock() -> list[dict]:
    return [{"id": p.stem, "name": p.name, "text": p.read_text()} for p in sorted((state.DATA / "inbox").glob("*.md"))]


async def warm() -> None:
    """Run the first Airbyte sync in the background at startup."""
    global _cached, _last_sync
    if not available():
        return
    try:
        _cached = await asyncio.to_thread(_sync_blocking)
        _last_sync = time.time()
        log.info("airbyte: synced %d inbox records", len(_cached))
    except Exception as e:  # noqa: BLE001
        log.warning("airbyte warm sync failed: %r", e)


async def sync_inbox() -> list[dict]:
    global _cached, _last_sync
    t0 = time.perf_counter()
    if available():
        try:
            if _cached is None or time.time() - _last_sync > 300:
                _cached = await asyncio.wait_for(asyncio.to_thread(_sync_blocking), timeout=20)
                _last_sync = time.time()
            record_sponsor(SPONSOR, "source-file.read inbox", True, int((time.perf_counter() - t0) * 1000))
            return _cached
        except Exception as e:  # noqa: BLE001
            log.warning("airbyte sync failed, using mock: %r", e)
    record_sponsor(SPONSOR, "sync_inbox", False, int((time.perf_counter() - t0) * 1000))
    return _mock()
