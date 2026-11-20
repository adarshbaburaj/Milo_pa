"""Superlinked Inference Engine (SIE) — shared client helpers.

Pattern from github.com/superlinked/cookbook (agentic/route_coding_tasks_to_open_models_first,
ecommerce/rerank_search_within_filters): open models on SIE first, Claude only as fallback.

Env:
  SIE_API_KEY          SIE Serverless key
  SIE_BASE_URL         optional, for SIE Cluster / SIE Local (default https://api.superlinked.com)
  SIE_CHAT_MODEL       default Qwen/Qwen3.8-27B-FP8
  SIE_RERANK_MODEL     default Qwen/Qwen3-Reranker-4B
"""
from __future__ import annotations

import os
from typing import Any, Optional

from .base import configured

DEFAULT_BASE = "https://api.superlinked.com"
# Cold models on SIE Serverless can take minutes to provision; we never wait that long in a
# request — the caller's timeout fires and the next provider (Claude, then local) takes over.
PROVISION_TIMEOUT_S = 20


def enabled() -> bool:
    return configured("SIE_API_KEY") or configured("SIE_BASE_URL")


def chat_model() -> str:
    return os.getenv("SIE_CHAT_MODEL", "Qwen/Qwen3.8-27B-FP8")


def rerank_model() -> str:
    return os.getenv("SIE_RERANK_MODEL", "Qwen/Qwen3-Reranker-4B")


def _client(timeout_s: float):
    from sie_sdk import SIEAsyncClient

    return SIEAsyncClient(
        api_key=os.getenv("SIE_API_KEY") or None,
        base_url=(os.getenv("SIE_BASE_URL") or DEFAULT_BASE).rstrip("/"),
        timeout_s=timeout_s,
    )


async def chat(messages: list[dict], max_tokens: int, timeout_s: float) -> dict:
    """Returns the raw OpenAI-style reply dict from SIE."""
    async with _client(timeout_s) as c:
        return await c.chat_completions(
            chat_model(),
            messages,
            max_completion_tokens=max_tokens,
            temperature=0.2,
            provision_timeout_s=PROVISION_TIMEOUT_S,
        )


async def score(query: str, docs: list[tuple[str, str]], instruction: Optional[str], timeout_s: float) -> dict[str, float]:
    """Rerank (id, text) docs against query. Returns {id: score}."""
    from sie_sdk.types import Item

    async with _client(timeout_s) as c:
        kwargs: dict[str, Any] = {"provision_timeout_s": PROVISION_TIMEOUT_S}
        if instruction:
            kwargs["instruction"] = instruction
        reply = await c.score(
            rerank_model(),
            Item(id="query", text=query),
            [Item(id=i, text=t) for i, t in docs],
            **kwargs,
        )
    return {s["item_id"]: float(s["score"]) for s in reply["scores"]}
