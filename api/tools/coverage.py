"""coverage — what Acme said + what the policy requires (WRITEUP §9.2)."""
from __future__ import annotations

import re
from datetime import date, datetime

import state
from adapters import airbyte, senso

CLAUSES = ["§4.2(a)", "§4.2(b)", "§4.2(c)", "§4.2(d)", "§4.2(e)", "§4.3(a)", "§7.1", "§7.3"]


def _parse_denial(text: str) -> dict:
    def grab(pat: str, default: str = "") -> str:
        m = re.search(pat, text, re.M)
        return m.group(1).strip() if m else default

    reason = grab(r"denied\s+—\s+\"([^\"]+)\"", "not medically necessary").rstrip(".")
    raw_date = grab(r"^Date:\s*(.+)$")
    try:
        d = datetime.strptime(raw_date[:16], "%a, %d %b %Y").date()
    except ValueError:
        d = date(2026, 11, 13)
    item = grab(r"request for a ([^.]+?) submitted", "power wheelchair")
    window = int(grab(r"within (\d+) days", "60"))
    return {
        "from": grab(r"^From:\s*(.+)$"),
        "subject": grab(r"^Subject:\s*(.+)$"),
        "date": d.isoformat(),
        "item": item,
        "reason": reason,
        "windowDays": window,
    }


async def run() -> dict:
    docs = await airbyte.sync_inbox()
    denial_doc = next((d for d in docs if "denial" in d["id"]), docs[0] if docs else None)
    denial = _parse_denial(denial_doc["text"]) if denial_doc else {}
    case = state.get_case()
    deadline = case["appealDeadline"]
    days_left = (date.fromisoformat(deadline) - date.today()).days

    policy = {}
    for c in CLAUSES:
        policy[c] = (await senso.query_policy(c))["answer"]

    profile = state.get_profile()
    glide = state.get_chair("glide-p2") or {}
    price = glide.get("priceUsd", 0)
    measured = profile.get("measured") or {}
    names = {"hipWidthIn": "hip width", "narrowestDoorwayIn": "doorway", "hallwayTurnSpaceIn": "hallway",
             "transferHeightIn": "seat height", "canSelfPropelFt": "push distance"}
    shaky = [names.get(k, k) for k, v in measured.items() if v in ("estimated", "photo", "current_chair")]
    requirements = [
        {"label": "Can't functionally self-propel a manual chair at home", "clause": "§4.2(a)", "status": "evidence",
         "evidence": f"Self-propel limit about {profile['canSelfPropelFt']} ft (profile); fit check shows manual chairs fail propulsion"},
        {"label": "Home allows the device (doorways, turning space)", "clause": "§4.2(b)", "status": "evidence",
         "evidence": f"Narrowest door {profile['home']['narrowestDoorwayIn']}″, hallway turn space {profile['home']['hallwayTurnSpaceIn']}″ (profile)"},
        *([{"label": "Confirm estimated measurements (" + ", ".join(shaky) + ")", "clause": "§4.2(b)", "status": "needed",
             "evidence": "Estimated in Milo — a home assessment or clinician should measure"}] if shaky else []),
        {"label": "Face-to-face exam note (within 45 days)", "clause": "§4.2(c)", "status": "needed", "evidence": "Ask the treating clinician"},
        {"label": "Signed clinician statement", "clause": "§4.2(c)", "status": "needed", "evidence": "Placeholder in the appeal draft"},
        {"label": "Prior authorisation", "clause": "§4.2(d)", "status": "needed", "evidence": "Requested as part of the appeal"},
    ]
    result = {
        "denial": {**denial, "deadline": deadline, "daysLeft": days_left, "caseStatus": case["status"]},
        "policy": [{"clause": k, "text": v} for k, v in policy.items()],
        "requirements": requirements,
        "costShare": {"pct": 20, "item": glide.get("name"), "priceUsd": price, "memberCostUsd": round(price * 0.2, 2),
                      "note": "after the deductible"},
    }
    live = any(c["sponsor"] == "airbyte" and c["live"] for c in __import__("adapters.base", fromlist=["current_trace"]).current_trace()["sponsorCalls"])
    evidence = [
        {"label": "Denied item", "value": denial.get("item", ""), "source": "denial letter, para 2", "sourceType": "denial", "live": live},
        {"label": "Reason", "value": f"“{denial.get('reason', '')}”", "source": "denial letter, para 3", "sourceType": "denial", "live": live},
        {"label": "Denial date", "value": denial.get("date", ""), "source": "denial letter, header", "sourceType": "denial", "live": live},
        {"label": "Appeal deadline", "value": f"{deadline} ({days_left} days left)", "source": "denial letter, para 4 + policy §7.1", "sourceType": "denial", "live": live},
        {"label": "Coverage rule", "value": policy["§4.2(a)"][:140] + "…", "source": "policy §4.2(a)", "sourceType": "policy", "live": live},
        {"label": "Least costly alternative", "value": policy["§4.2(e)"][:140] + "…", "source": "policy §4.2(e)", "sourceType": "policy", "live": live},
        {"label": "Cost share", "value": "20% after the deductible", "source": "policy §4.3(a)", "sourceType": "policy", "live": live},
        {"label": "Decision time", "value": "30 days after a complete appeal", "source": "policy §7.3", "sourceType": "policy", "live": live},
    ]
    d = date.fromisoformat(denial.get("date", "2026-11-13"))
    dl = date.fromisoformat(deadline)
    summary = (f"Acme denied your {denial.get('item', 'power wheelchair').split(' (')[0]} on {d.strftime('%b')} {d.day}: "
               f"“{denial.get('reason')}.” You have until {dl.strftime('%b')} {dl.day} to appeal.")
    return {"result": result, "evidence": evidence, "summary": summary, "link": "/appeal"}
