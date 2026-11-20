"""Persona — verify the human before filing / paying.

Mock: a sandbox inquiry the UI completes through a "Sandbox verification" modal.
"""
from __future__ import annotations

import secrets

import state
from .base import configured, sponsor_call

SPONSOR = "persona"


def status() -> str:
    return "live" if configured("PERSONA_API_KEY", "PERSONA_TEMPLATE_ID") else "mock"


async def start_verification(user: str, purpose: str) -> dict:
    def mock():
        vid = "inq_sandbox_" + secrets.token_hex(6)
        v = {"id": vid, "user": user, "purpose": purpose, "status": "pending", "sandbox": True, "url": None}
        vs = state.kv_get("verifications", {})
        vs[vid] = v
        state.kv_set("verifications", vs)
        return v

    value, _ = await sponsor_call(SPONSOR, "start_verification", None, mock)
    return value


def get(vid: str) -> dict | None:
    return state.kv_get("verifications", {}).get(vid)


def complete(vid: str) -> dict | None:
    vs = state.kv_get("verifications", {})
    if vid not in vs:
        return None
    vs[vid]["status"] = "approved"
    vs[vid]["completedAt"] = state.now_iso()
    state.kv_set("verifications", vs)
    return vs[vid]


def is_verified(vid: str | None) -> bool:
    v = get(vid) if vid else None
    return bool(v and v["status"] == "approved")
