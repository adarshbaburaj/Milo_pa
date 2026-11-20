"""LLM adapter — provider chain, first one that answers wins:

  1. Superlinked SIE   open model (Qwen) — the main brain          SIE_API_KEY
  2. Claude            Anthropic API — fallback                     ANTHROPIC_API_KEY, CLAUDE_MODEL
  3. Arcee             OpenAI wire format                           ARCEE_API_KEY, ARCEE_BASE_URL, ARCEE_*_MODEL
  4. Any OpenAI-compatible endpoint                                 LLM_BASE_URL, LLM_API_KEY, LLM_*_MODEL

Every attempt (live or failed) is recorded in the Receipt trace. If none answers,
`complete` returns None and callers use their local fallback.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Literal, Optional

import httpx

from . import sie
from .base import configured, record_model, record_sponsor, TIMEOUT_S

log = logging.getLogger("milo.llm")

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


CLAUDE_FALLBACK_BETA = "server-side-fallback-2026-07-01"


def _claude_model() -> str:
    return os.getenv("CLAUDE_MODEL", "claude-opus-5-5")


def arcee_status() -> str:
    p = _provider("small")
    return "live" if p and p["sponsor"] == "arcee" else "mock"


def status() -> str:
    """Which provider answers first: sie | claude | live (arcee) | llm | mock."""
    if sie.enabled():
        return "sie"
    if configured("ANTHROPIC_API_KEY"):
        return "claude"
    p = _provider("small")
    return "live" if p and p["sponsor"] == "arcee" else ("llm" if p else "mock")


def _parse_json(text: str) -> Any:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=0)
    return json.loads(text[start:])


def _wrap(sponsor: str, model_name: str, tier: Tier, t0: float, text: str, json_mode: bool,
          tokens: Optional[int]) -> dict:
    content = _parse_json(text) if json_mode else text.strip()
    ms = int((time.perf_counter() - t0) * 1000)
    record_sponsor(sponsor, f"complete.{tier}", True, ms)
    return {"content": content, "model": record_model(model_name, ms, tokens, tier)}


def _fail(sponsor: str, tier: Tier, t0: float, err: Exception) -> None:
    log.warning("%s complete.%s failed: %r", sponsor, tier, err)
    record_sponsor(sponsor, f"complete.{tier}", False, int((time.perf_counter() - t0) * 1000))


async def _sie(tier: Tier, messages: list[dict], json_mode: bool, max_tokens: int,
               timeout: float) -> Optional[dict]:
    t0 = time.perf_counter()
    try:
        msgs = list(messages)
        if json_mode and msgs and msgs[-1]["role"] == "user":
            msgs[-1] = {**msgs[-1], "content": f"{msgs[-1]['content']}\n\nReply with valid JSON only."}
        data = await asyncio.wait_for(sie.chat(msgs, max_tokens, timeout), timeout=timeout)
        text = data["choices"][0]["message"].get("content") or ""
        return _wrap("superlinked", sie.chat_model(), tier, t0, text, json_mode,
                     (data.get("usage") or {}).get("total_tokens"))
    except Exception as e:  # noqa: BLE001 — fall through to the next provider
        _fail("superlinked", tier, t0, e)
        return None


async def _claude(tier: Tier, messages: list[dict], json_mode: bool, max_tokens: int,
                  timeout: float) -> Optional[dict]:
    import anthropic

    t0 = time.perf_counter()
    try:
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        if json_mode:
            system = (system + "\n\nReply with valid JSON only, no prose.").strip()
        convo = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
        client = anthropic.AsyncAnthropic(timeout=timeout, max_retries=0)
        if tier == "small":
            # latency-critical (prediction / routing): fast model, no extended thinking
            msg = await asyncio.wait_for(client.messages.create(
                model=os.getenv("CLAUDE_SMALL_MODEL", "claude-haiku-5-5"),
                max_tokens=max_tokens,
                system=system or anthropic.NOT_GIVEN,
                messages=convo,
                temperature=0.2,
            ), timeout=timeout)
            text = "".join(b.text for b in msg.content if b.type == "text")
            u = msg.usage
            return _wrap("claude", msg.model, tier, t0, text, json_mode,
                         (u.input_tokens or 0) + (u.output_tokens or 0))
        msg = await asyncio.wait_for(client.beta.messages.create(
            model=_claude_model(),
            # Opus 5.5 always thinks; thinking tokens share max_tokens, so leave headroom.
            max_tokens=max_tokens + 2000,
            system=system or anthropic.NOT_GIVEN,
            messages=convo,
            output_config={"effort": "low" if tier == "small" else "medium"},
            betas=[CLAUDE_FALLBACK_BETA],
            fallbacks="default",
        ), timeout=timeout)
        if msg.stop_reason == "refusal":
            raise RuntimeError(f"refusal: {getattr(msg, 'stop_details', None)}")
        text = "".join(b.text for b in msg.content if b.type == "text")
        u = msg.usage
        return _wrap("claude", msg.model, tier, t0, text, json_mode,
                     (u.input_tokens or 0) + (u.output_tokens or 0))
    except Exception as e:  # noqa: BLE001
        _fail("claude", tier, t0, e)
        return None


async def _openai_compat(p: dict, tier: Tier, messages: list[dict], json_mode: bool, max_tokens: int,
                         timeout: float) -> Optional[dict]:
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
        async with httpx.AsyncClient(timeout=timeout) as client:
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
        return _wrap(p["sponsor"], p["model"], tier, t0, text, json_mode,
                     (data.get("usage") or {}).get("total_tokens"))
    except Exception as e:  # noqa: BLE001
        _fail(p["sponsor"], tier, t0, e)
        return None


async def complete(
    tier: Tier,
    messages: list[dict],
    json_mode: bool = True,
    max_tokens: int = 600,
    timeout: Optional[float] = None,
) -> Optional[dict]:
    """Returns {"content": str|obj, "model": {...}} or None if every provider failed."""
    budget = timeout or (TIMEOUT_S if tier == "small" else 30)
    if tier == "small" and sie.enabled() and configured("ANTHROPIC_API_KEY"):
        # Hedged request: Qwen on SIE is the brain; if it hasn't answered after HEDGE_S,
        # start Claude in parallel and take the first good answer.
        res = await _hedged(messages, json_mode, max_tokens, budget)
        if res:
            return res
    elif sie.enabled():
        res = await _sie(tier, messages, json_mode, max_tokens, budget)
        if res:
            return res
    if configured("ANTHROPIC_API_KEY") and not (tier == "small" and sie.enabled()):
        res = await _claude(tier, messages, json_mode, max_tokens, budget)
        if res:
            return res
    p = _provider(tier)
    if p:
        return await _openai_compat(p, tier, messages, json_mode, max_tokens, budget)
    return None


HEDGE_S = float(os.getenv("LLM_HEDGE_S", "2.5"))


async def _hedged(messages: list[dict], json_mode: bool, max_tokens: int, budget: float) -> Optional[dict]:
    sie_task = asyncio.create_task(_sie("small", messages, json_mode, max_tokens, budget))
    done, _ = await asyncio.wait({sie_task}, timeout=HEDGE_S)
    if sie_task in done and sie_task.result():
        return sie_task.result()
    claude_task = asyncio.create_task(_claude("small", messages, json_mode, max_tokens, budget))
    pending = {t for t in (sie_task, claude_task) if not t.done()}
    if sie_task.done() and not sie_task.result():
        pending = {claude_task}
    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for t in done:
            if t.result():
                for p in pending:
                    p.cancel()
                return t.result()
    return None
