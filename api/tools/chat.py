"""chat — clean, accurate answers to questions, grounded only in Milo's own data (Claude)."""
from __future__ import annotations

import asyncio
import json
import os
import time

import state
from adapters.base import configured, record_model, record_sponsor
from tools import fit_check

SYSTEM = """You are Milo, a calm, kind assistant for a person with limited movement (fictional demo user).
Answer the question in at most 3 short sentences of plain, warm English (reading age ~12).
Use ONLY the facts in CONTEXT. If the answer isn't there, say you don't know yet and suggest the next step in Milo.
Never give medical or legal advice; for health questions suggest asking their clinician.
Never invent numbers, dates, prices or names. Quote numbers exactly as given, with their meaning:
"overall_width_in" is the chair's width; doorway checks add 2 inches of hand clearance on top.
No markdown, no lists, no emojis.
Milo can: check which wheelchairs fit (Fit Check), explain the insurer's decision and policy, draft and file an appeal,
shop with caregiver approval, speak phrases out loud for the person, caption people talking (Listen), and plan accessible routes."""


def _context() -> dict:
    profile = state.get_profile()
    case = state.get_case()
    results = fit_check.check_all(state.get_catalog(), profile)
    return {
        "profile": {k: profile[k] for k in ("name", "city", "hipWidthIn", "seatWidthRangeIn", "transferHeightRangeIn",
                                              "canSelfPropelFt", "home", "insurer", "caregiver")},
        "case": case,
        "chairs": [{"name": r["name"], "type": r["chair"]["type"], "overall_width_in": r["chair"]["overallWidthIn"],
                    "seat_width_in": r["chair"]["seatWidthIn"], "seat_to_floor_in": r["chair"]["seatToFloorIn"],
                    "turning_radius_in": r["chair"]["turningRadiusIn"], "price_usd": r["chair"]["priceUsd"],
                    "fits_maria": r["fits"], "failed_checks": r["failed"],
                    "checks": [c["detail"] for c in r["checks"]]} for r in results],
        "denial": {"date": case.get("deniedOn"), "item": "power wheelchair (Group 2, mid-wheel)",
                   "reason": "not medically necessary; member can use a standard manual wheelchair",
                   "rule_cited": "policy §4.2(e) least costly alternative", "appeal_deadline": case.get("appealDeadline")},
        "policy": "Power wheelchairs are covered when the member can't functionally self-propel a manual chair at home, "
                  "the home allows the device, a face-to-face exam note and clinician statement are submitted, and prior "
                  "authorisation is obtained. 20% cost share after deductible. Appeal within 60 days of denial; decision within "
                  "30 days of a complete appeal. (Acme Health Plan, fictional, §4.2, §4.3, §7)",
    }


def _fallback(question: str) -> str:
    return ("I can check which chairs fit your home, explain Acme's decision, draft and file your appeal, shop with "
            "Alex's approval, or say something out loud for you. Which would help?")


async def run(question: str) -> dict:
    ctx = _context()
    evidence = [
        {"label": "Grounded in", "value": "profile, case tracker, fit check, policy summary", "source": "Milo data",
         "sourceType": "model", "live": False},
    ]
    if not configured("ANTHROPIC_API_KEY"):
        return {"result": {"answer": _fallback(question)}, "evidence": evidence, "summary": _fallback(question)}
    import anthropic

    t0 = time.perf_counter()
    try:
        client = anthropic.AsyncAnthropic(max_retries=0, timeout=20)
        msg = await asyncio.wait_for(client.messages.create(
            model=os.getenv("CLAUDE_CHAT_MODEL", "claude-sonnet-5-5"),
            max_tokens=300,
            system=SYSTEM,
            messages=[{"role": "user", "content": f"CONTEXT:\n{json.dumps(ctx)}\n\nQUESTION: {question}"}],
        ), timeout=20)
        answer = " ".join("".join(b.text for b in msg.content if b.type == "text").split()).strip()
        ms = int((time.perf_counter() - t0) * 1000)
        record_sponsor("claude", "chat", True, ms)
        record_model(msg.model, ms, (msg.usage.input_tokens or 0) + (msg.usage.output_tokens or 0), "chat")
        evidence[0]["live"] = True
        return {"result": {"answer": answer}, "evidence": evidence, "summary": answer or _fallback(question)}
    except Exception:  # noqa: BLE001
        record_sponsor("claude", "chat", False, int((time.perf_counter() - t0) * 1000))
        return {"result": {"answer": _fallback(question)}, "evidence": evidence, "summary": _fallback(question)}
