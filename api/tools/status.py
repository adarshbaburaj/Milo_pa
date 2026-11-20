"""status — reads the case tracker (WRITEUP §9.6)."""
from __future__ import annotations

from datetime import date

import state


def _d(s: str) -> str:
    d = date.fromisoformat(s)
    return f"{d.strftime('%b')} {d.day}"


def run(topic: str = "appeal") -> dict:
    case = state.get_case()
    st = case["status"]
    days_left = (date.fromisoformat(case["appealDeadline"]) - date.today()).days
    if st == "denied":
        summary = (f"Acme denied your power chair on {_d(case['deniedOn'])}. "
                   f"You have until {_d(case['appealDeadline'])} to appeal — {days_left} days left.")
    elif st == "appeal_draft":
        summary = (f"Your appeal is drafted but not filed yet. The deadline is {_d(case['appealDeadline'])} "
                   f"({days_left} days left).")
    elif st == "appeal_filed":
        summary = (f"Your appeal was filed {_d(case['filedOn'])}. Acme should decide by {_d(case['decisionDue'])}. "
                   "Nothing needed from you right now.")
    else:
        summary = f"Your {case['item']} case is {st.replace('_', ' ')}."
    evidence = [
        {"label": "Case status", "value": st, "source": f"case tracker:{case['id']}", "sourceType": "case", "live": False},
        {"label": "Denied on", "value": case["deniedOn"], "source": "case tracker", "sourceType": "case", "live": False},
        {"label": "Appeal deadline", "value": case["appealDeadline"], "source": "case tracker", "sourceType": "case", "live": False},
    ]
    if case.get("confirmation"):
        evidence.append({"label": "Confirmation", "value": case["confirmation"], "source": "case tracker", "sourceType": "case", "live": False})
    return {"result": {"case": case, "daysLeft": days_left}, "evidence": evidence, "summary": summary, "link": "/appeal"}
