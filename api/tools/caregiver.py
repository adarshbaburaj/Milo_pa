"""caregiver — approval requests to Alex (WRITEUP §9.5)."""
from __future__ import annotations

import secrets
from typing import Optional

import state


def request(item_id: Optional[str], amount_usd: float, note: str = "") -> dict:
    profile = state.get_profile()
    chair = state.get_chair(item_id or "glide-p2") or {}
    tok = secrets.token_urlsafe(6)
    reqs = state.kv_get("caregiver_requests", {})
    reqs[tok] = {
        "token": tok, "item": chair.get("id"), "itemName": chair.get("name"),
        "amountUsd": amount_usd or chair.get("priceUsd", 0), "note": note,
        "from": profile["name"], "to": profile["caregiver"]["name"], "status": "pending", "createdAt": state.now_iso(),
    }
    state.kv_set("caregiver_requests", reqs)
    return reqs[tok]


def get(tok: str) -> Optional[dict]:
    return state.kv_get("caregiver_requests", {}).get(tok)


def decide(tok: str, approve: bool) -> Optional[dict]:
    reqs = state.kv_get("caregiver_requests", {})
    if tok not in reqs:
        return None
    reqs[tok]["status"] = "approved" if approve else "declined"
    reqs[tok]["decidedAt"] = state.now_iso()
    state.kv_set("caregiver_requests", reqs)
    return reqs[tok]


def run(args: dict) -> dict:
    r = request(args.get("item"), float(args.get("amount_usd") or 0), args.get("note", ""))
    return {"result": {"request": r, "link": f"/caregiver/{r['token']}"},
            "evidence": [{"label": "Approval request", "value": f"{r['itemName']} · ${r['amountUsd']:,.0f}",
                          "source": "caregiver", "sourceType": "user", "live": False}],
            "summary": f"Sent to {r['to']}. I'll let you know when {r['to']} answers.", "link": f"/caregiver/{r['token']}"}
