"""LLM adapter — Arcee first (small/large tiers), then any OpenAI-compatible endpoint.

Env:
  ARCEE_API_KEY, ARCEE_BASE_URL, ARCEE_SMALL_MODEL, ARCEE_LARGE_MODEL
  LLM_BASE_URL, LLM_API_KEY, LLM_SMALL_MODEL, LLM_LARGE_MODEL   (fallback)

Both are called with the OpenAI chat-completions wire format. If neither is
configured, `complete` returns None and callers use their local fallback.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Literal, Optional

import httpx

from .base import configured, record_model, record_sponsor, TIMEOUT_S

Tier = Literal["small", "large"]


def _provider(tier: Tier) -> Optional[dict]:
    if configured("ARCEE_API_KEY", "ARCEE_BASE_URL"):
        model = os.getenv("ARCEE_SMALL_MODEL" if tier == "small" else "ARCEE_LARGE_MODEL")
        if model:
            return {
                "sponsor": "arcee",
                "base": os.environ["ARCEE_BASE_URL"].rstrip("/"),
                "key": os.environ["ARCEE_API_KEY"],
                "model": model,
            }
    if configured("LLM_BASE_URL", "LLM_API_KEY"):
        model = os.getenv("LLM_SMALL_MODEL" if tier == "small" else "LLM_LARGE_MODEL") or os.getenv("LLM_MODEL")
        if model:
            return {
                "sponsor": "llm",
                "base": os.environ["LLM_BASE_URL"].rstrip("/"),
                "key": os.environ["LLM_API_KEY"],
                "model": model,
            }
    return None


def status() -> str:
    p = _provider("small")
    return "live" if p and p["sponsor"] == "arcee" else ("llm" if p else "mock")


def _parse_json(text: str) -> Any:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=0)
    return json.loads(text[start:])


async def complete(
    tier: Tier,
    messages: list[dict],
    json_mode: bool = True,
    max_tokens: int = 600,
    timeout: Optional[float] = None,
) -> Optional[dict]:
    """Returns {"content": str|obj, "model": {...}} or None if unavailable/failed."""
    p = _provider(tier)
    if not p:
        return None
    body: dict[str, Any] = {
        "model": p["model"],
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout or (TIMEOUT_S if tier == "small" else 30)) as client:
            r = await client.post(
                f"{p['base']}/chat/completions",
                headers={"Authorization": f"Bearer {p['key']}"},
                json=body,
            )
            if r.status_code == 400 and json_mode:
                # some providers don't support response_format; retry without it
                body.pop("response_format", None)
                r = await client.post(
                    f"{p['base']}/chat/completions",
                    headers={"Authorization": f"Bearer {p['key']}"},
                    json=body,
                )
            r.raise_for_status()
            data = r.json()
        text = data["choices"][0]["message"]["content"] or ""
        content = _parse_json(text) if json_mode else text
    except Exception:  # noqa: BLE001
        record_sponsor(p["sponsor"], f"complete.{tier}", False, int((time.perf_counter() - t0) * 1000))
        return None
    ms = int((time.perf_counter() - t0) * 1000)
    tokens = (data.get("usage") or {}).get("total_tokens")
    record_sponsor(p["sponsor"], f"complete.{tier}", True, ms)
    model = record_model(p["model"], ms, tokens, tier)
    return {"content": content, "model": model}
