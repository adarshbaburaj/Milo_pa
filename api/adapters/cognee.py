"""Cognee — long-term memory: what Maria says, when, and the facts of her life (knowledge graph).

Live (COGNEE_API_KEY): Cognee Cloud HTTP API, per docs.cognee.ai/cognee-cloud/http-api
  * the tenant's own service URL is discovered from the control plane (GET /api/v1/tenants/current/service-url),
  * remember(): POST /api/v1/remember (multipart raw_data + datasetName) — adds AND cognifies each chosen phrase
    with its time of day and input mode,
  * recall(): POST /api/v1/search (GRAPH_COMPLETION) — "what does Maria usually say now?", cached and refreshed in
    the background so prediction stays instant.
Local SQLite phrase counts stay the fast path for prediction scoring.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime
from typing import Optional

import httpx

import state
from .base import configured, record_sponsor, sponsor_call

SPONSOR = "cognee"
DATASET = "milo_maria"
CONTROL = "https://api.aws.cognee.ai"
log = logging.getLogger("milo.cognee")

_base: Optional[str] = os.getenv("COGNEE_BASE_URL") or None
_memory: dict = {"text": None, "at": 0.0, "bucket": None}
_cognify_task: Optional[asyncio.Task] = None
_pending = 0


def status() -> str:
    return "live" if configured("COGNEE_API_KEY") else "mock"


def _hdr() -> dict:
    return {"X-Api-Key": os.environ["COGNEE_API_KEY"]}


async def _service_url(c: httpx.AsyncClient) -> str:
    global _base
    if not _base:
        r = await c.get(f"{CONTROL}/api/v1/tenants/current/service-url", headers=_hdr())
        r.raise_for_status()
        _base = r.json()["service_url"].rstrip("/")
    return _base


async def _add(*texts: str) -> None:
    """POST /api/v1/remember: literal text entries → added AND cognified (graph built) in the background."""
    async with httpx.AsyncClient(timeout=30) as c:
        base = await _service_url(c)
        files = [("raw_data", (None, t)) for t in texts] + [("datasetName", (None, DATASET)), ("run_in_background", (None, "true"))]
        r = await c.post(f"{base}/api/v1/remember", headers=_hdr(), files=files)
        r.raise_for_status()


async def _cognify_soon(delay: float = 20) -> None:
    """Debounce: build the graph once after a burst of new memories."""
    global _pending
    await asyncio.sleep(delay)
    if _pending <= 0:
        return
    _pending = 0
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            base = await _service_url(c)
            r = await c.post(f"{base}/api/v1/cognify", headers={**_hdr(), "Content-Type": "application/json"}, json={"datasets": [DATASET]})
            r.raise_for_status()
        log.info("cognee: cognify started (%d ms)", int((time.perf_counter() - t0) * 1000))
    except Exception as e:  # noqa: BLE001
        log.warning("cognee cognify failed: %r", e)


def _schedule_cognify() -> None:
    global _cognify_task, _pending
    _pending += 1
    if _cognify_task is None or _cognify_task.done():
        _cognify_task = asyncio.create_task(_cognify_soon())


async def _search(query: str, search_type: str = "GRAPH_COMPLETION") -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        base = await _service_url(c)
        r = await c.post(f"{base}/api/v1/search", headers={**_hdr(), "Content-Type": "application/json"},
                         json={"query": query, "search_type": search_type, "datasets": [DATASET]})
        r.raise_for_status()
        data = r.json()
    # response shape isn't documented: accept a list of strings / objects, a dict, or a stringified list
    if isinstance(data, str) and data.startswith("["):
        import ast

        try:
            data = ast.literal_eval(data)
        except (ValueError, SyntaxError):
            pass
    if isinstance(data, list):
        parts = []
        for d in data:
            if isinstance(d, str):
                parts.append(d.strip("[]'\" "))
            elif isinstance(d, dict):
                parts.append(str(d.get("search_result") or d.get("text") or d.get("answer") or d))
        return " ".join(p for p in parts if p)[:800]
    if isinstance(data, dict):
        return str(data.get("search_result") or data.get("answer") or data)[:800]
    return str(data)[:800]


# ---- adapter API ------------------------------------------------------------------


async def remember(kind: str, text: str, meta: dict | None = None) -> dict:
    meta = meta or {}
    local = state.bump_phrase(text, meta.get("kind"), meta.get("tool")) if kind == "phrase" else {"ok": True}
    if configured("COGNEE_API_KEY"):
        now = datetime.now()
        sentence = (f"On {now:%A} at {now:%H:%M} ({state.time_bucket(now.hour)}), Maria chose the phrase "
                    f"“{text}”" + (f" using {meta.get('mode')} mode" if meta.get("mode") else "") +
                    (f" (a request for Milo to {meta.get('tool')})" if meta.get("tool") else " (said out loud to people nearby)") + ".")

        async def live():
            await _add(sentence)  # remember = add + cognify
            return local

        await sponsor_call(SPONSOR, f"remember.{kind}", live, lambda: local, timeout=8)
        return local
    await sponsor_call(SPONSOR, f"remember.{kind}", None, lambda: local)
    return local


async def recall_phrases(k: int = 40) -> list[dict]:
    def mock():
        ps = state.list_phrases()
        ps.sort(key=lambda p: -p["count"])
        return ps[:k]

    value, _ = await sponsor_call(SPONSOR, "recall.phrases", None, mock)
    return value


def memory_context() -> Optional[str]:
    """Cached graph answer about Maria's habits right now (refreshed in the background)."""
    bucket = state.time_bucket(datetime.now().hour)
    if configured("COGNEE_API_KEY") and (time.time() - _memory["at"] > 120 or _memory["bucket"] != bucket):
        _memory["at"] = time.time()  # avoid stampedes

        async def refresh():
            t0 = time.perf_counter()
            try:
                txt = await _search(f"What does Maria usually say or ask for in the {bucket}? List her most likely phrases.")
                _memory.update(text=txt, bucket=bucket)
                record_sponsor(SPONSOR, "search.graph_completion", True, int((time.perf_counter() - t0) * 1000))
            except Exception as e:  # noqa: BLE001
                log.warning("cognee recall failed: %r", e)

        try:
            asyncio.get_running_loop().create_task(refresh())
        except RuntimeError:
            pass
    return _memory["text"]


async def ask(question: str) -> Optional[str]:
    if not configured("COGNEE_API_KEY"):
        return None

    async def live():
        return await _search(question)

    value, was_live = await sponsor_call(SPONSOR, "search.graph_completion", live, lambda: None, timeout=12)
    return value if was_live else None


async def seed() -> dict:
    """Load Maria's life facts + phrase habits (fictional demo data) into her Cognee memory and build the graph."""
    if not configured("COGNEE_API_KEY"):
        return {"live": False}
    p = state.get_profile()
    case = state.get_case()
    facts = [
        f"Maria Alvarez (fictional demo user) lives in {p['city']}. She uses a manual wheelchair today and can self-propel "
        f"about {p['canSelfPropelFt']} feet. Her hips are {p['hipWidthIn']} inches wide; her narrowest door is the "
        f"{p['home']['narrowestDoorwayName']} at {p['home']['narrowestDoorwayIn']} inches.",
        f"Maria's caregiver is {p['caregiver']['name']}, her {p['caregiver']['relation']}, who approves purchases over "
        f"${p['caregiver']['approvalOverUsd']}.",
        f"Maria's insurer {p['insurer']} denied her power wheelchair on {case['deniedOn']}; the appeal deadline is "
        f"{case['appealDeadline']}.",
    ]
    for ph in sorted(state.list_phrases(), key=lambda x: -x["count"])[:20]:
        facts.append(f"Maria says “{ph['text']}” often ({ph['count']} times), usually in the {ph['usualTime']}.")
    await _add(*facts)
    return {"live": True, "added": len(facts), "graph": "building (remember)"}
