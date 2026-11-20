"""shop — MobilityMart (demo store) cart + accessible checkout (WRITEUP §9.4)."""
from __future__ import annotations

import secrets
from typing import Optional

import state
from adapters import persona


def _summary(item_id: str) -> dict:
    chair = state.get_chair(item_id) or state.get_chair("glide-p2")
    profile = state.get_profile()
    price = chair["priceUsd"]
    covered = round(price * 0.8, 2)
    case = state.get_case()
    return {
        "store": "MobilityMart (demo store)",
        "item": chair,
        "priceUsd": price,
        "coverage": {"pct": 80, "status": "pending appeal" if case["status"] != "approved" else "approved",
                     "estimatedCoveredUsd": covered},
        "memberCostUsd": round(price - covered, 2),
        "shipping": {"name": profile["name"], "city": profile["city"], "method": "Standard (free)"},
        "totalDueNowUsd": price,
        "readAloud": (f"Your order: the {chair['name']}, ${price:,.0f}. If your appeal is approved, Acme covers about "
                      f"80%, so your share would be about ${price - covered:,.0f}. Shipping to {profile['name']} in "
                      f"{profile['city']}."),
    }


def run(action: str, item_id: Optional[str], args: dict, confirmed: bool) -> dict:
    s = _summary(item_id or "glide-p2")
    chair = s["item"]
    ev = [
        {"label": "Price", "value": f"${s['priceUsd']:,.0f}", "source": f"catalog:{chair['id']}", "sourceType": "catalog", "live": False},
        {"label": "Estimated coverage", "value": "80% if the appeal is approved", "source": "policy §4.3(a)", "sourceType": "policy", "live": False},
        {"label": "Ship to", "value": f"{s['shipping']['name']}, {s['shipping']['city']}", "source": "profile", "sourceType": "profile", "live": False},
    ]
    if action == "cart":
        cart = [chair["id"]]
        state.kv_set("cart", cart)
        return {"result": {"status": "in_cart", **s}, "evidence": ev,
                "summary": f"The {chair['name']} is in your cart: ${s['priceUsd']:,.0f}.", "link": "/shop"}

    profile = state.get_profile()
    limit = profile["caregiver"]["approvalOverUsd"]
    if s["totalDueNowUsd"] > limit:
        reqs = state.kv_get("caregiver_requests", {})
        tok = args.get("caregiver_token")
        if not tok or reqs.get(tok, {}).get("status") != "approved":
            return {"result": {"status": "needs_caregiver", **s}, "evidence": ev,
                    "summary": f"This is over ${limit}, so {profile['caregiver']['name']} needs to approve it first."}
    if not persona.is_verified(args.get("verification_id")):
        return {"result": {"status": "needs_verification", **s}, "evidence": ev, "summary": "First I need to verify it's you."}
    if not confirmed:
        return {"result": {"status": "needs_confirmation", **s}, "evidence": ev, "summary": "Place the order?"}
    oid = f"MM-{secrets.token_hex(3).upper()}"
    orders = state.kv_get("orders", [])
    orders.append({"id": oid, "item": chair["id"], "at": state.now_iso(), "sandbox": True})
    state.kv_set("orders", orders)
    ev.append({"label": "Order", "value": f"{oid} (demo store)", "source": "MobilityMart", "sourceType": "case", "live": False})
    return {"result": {"status": "ordered", "orderId": oid, **s}, "evidence": ev,
            "summary": f"Order placed (demo): {oid}. Delivery details will follow.", "link": "/shop"}
