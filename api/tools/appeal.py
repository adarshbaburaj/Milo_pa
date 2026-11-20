"""appeal — draft / review / revise / file (WRITEUP §9.3).

Template first so the demo never breaks; the large model (if configured) writes
the narrative summary paragraph and the reviewer role-play.
"""
from __future__ import annotations

import difflib
import json
import secrets
from datetime import date, timedelta
from typing import Any, Optional

import state
from adapters import arcee, firedrill, persona
from adapters.base import sponsor_call
from tools import coverage as coverage_tool
from tools import fit_check

FOOTER = "DRAFT prepared with Milo — for clinician review and signature."


def _fmt(x: Any) -> str:
    return f"{x:g}″" if isinstance(x, (int, float)) else str(x)


def _fit_table(r: dict) -> dict:
    return {
        "columns": ["Check", "Result", "Numbers"],
        "rows": [[c["rule"], "✅ pass" if c["pass"] else "❌ fail", c["detail"]] for c in r["checks"]],
    }


def _versions() -> list[dict]:
    return state.kv_get("appeal_versions", [])


def _save_version(v: dict) -> None:
    vs = _versions()
    vs.append(v)
    state.kv_set("appeal_versions", vs)


def latest() -> Optional[dict]:
    vs = _versions()
    return vs[-1] if vs else None


def packet_text(v: dict) -> list[str]:
    lines = [v["title"], ""]
    for s in v["sections"]:
        lines.append(f"## {s['title']}")
        if s.get("body"):
            lines.extend(s["body"].split("\n"))
        if s.get("table"):
            for row in s["table"]["rows"]:
                lines.append(" | ".join(str(c) for c in row))
        for it in s.get("items", []):
            lines.append(f"[{'x' if it.get('done') else ' '}] {it['label']}")
        lines.append("")
    lines.append(FOOTER)
    return lines


# ----------------------------------------------------------------------------
# draft
# ----------------------------------------------------------------------------


async def draft(item_id: str = "glide-p2") -> dict:
    profile = state.get_profile()
    catalog = state.get_catalog()
    cov = await coverage_tool.run()
    denial = cov["result"]["denial"]
    policy = {p["clause"]: p["text"] for p in cov["result"]["policy"]}
    chair = state.get_chair(item_id) or state.get_chair("glide-p2")
    basic = next(c for c in catalog if c.get("insurerDefault"))
    r_basic = fit_check.check_chair(basic, profile)
    r_chair = fit_check.check_chair(chair, profile)
    home = profile["home"]
    case = state.get_case()

    narrative = (
        f"{profile['name']} is appealing the {date.fromisoformat(denial['date']).strftime('%B')} "
        f"{date.fromisoformat(denial['date']).day} denial of a power wheelchair. The plan's standard "
        f"alternative, the {basic['name']}, fails {len(r_basic['failed'])} of 5 measured checks "
        f"({', '.join(r_basic['failed']).lower()}). The requested {chair['name']} passes all 5 checks against "
        f"her body and home measurements."
    )
    model = None
    res = await arcee.complete(
        "large",
        [
            {"role": "system", "content": (
                "You write the opening summary paragraph of an insurance appeal for durable medical equipment. "
                "Use ONLY the facts given. No diagnoses, no medical claims beyond the facts. 3 sentences, plain "
                "English, third person. Return JSON {\"paragraph\": \"...\"}.")},
            {"role": "user", "content": json.dumps({
                "member": profile["name"], "denied_item": denial["item"], "denial_reason": denial["reason"],
                "denial_date": denial["date"], "functional": {"self_propel_ft": profile["canSelfPropelFt"]},
                "covered_alternative": {"name": basic["name"], "failed_checks": r_basic["failed"]},
                "requested": {"name": chair["name"], "passes": "all 5 checks"},
                "home": home,
            })},
        ],
        max_tokens=300,
    )
    if res and isinstance(res["content"], dict) and res["content"].get("paragraph"):
        narrative = str(res["content"]["paragraph"]).strip()
        model = res["model"]

    sections = [
        {"id": "summary", "title": "1. Member and claim summary",
         "body": (f"Member: {profile['name']} · Member ID {profile['memberId']} · {profile['insurer']}\n"
                  f"Claim: {denial['item']} · denied {denial['date']} · appeal deadline {case['appealDeadline']}\n\n"
                  f"{narrative}"),
         "cite": ["profile", "denial letter, header"]},
        {"id": "denied", "title": "2. What was denied and why",
         "body": (f"Acme denied the request as “{denial['reason']}.” The denial relies on policy §4.2(e): "
                  f"“{policy['§4.2(e)']}”"),
         "cite": ["denial letter, para 3", "policy §4.2(e)"]},
        {"id": "functional", "title": "3. Functional needs",
         "body": (f"• Can self-propel a manual wheelchair for about {profile['canSelfPropelFt']} ft before needing to stop.\n"
                  f"• Hip width {_fmt(profile['hipWidthIn'])}; needs a seat {_fmt(profile['seatWidthRangeIn'][0])}–{_fmt(profile['seatWidthRangeIn'][1])} wide.\n"
                  f"• Safe transfer height {_fmt(profile['transferHeightRangeIn'][0])}–{_fmt(profile['transferHeightRangeIn'][1])}.\n"
                  "Described functionally; no diagnosis is included."),
         "cite": ["profile"]},
        {"id": "alt_fails", "title": f"4. Why the covered alternative ({basic['name']}) fails",
         "body": "Checked against the member's measurements, it fails: " + "; ".join(
             c["detail"] for c in r_basic["checks"] if not c["pass"]) + ".",
         "table": _fit_table(r_basic), "cite": [f"catalog:{basic['id']}", "profile", "fit_check"]},
        {"id": "req_fits", "title": f"5. Why the {chair['name']} fits",
         "body": f"It passes all {len(r_chair['checks'])} checks against the member's body and home measurements.",
         "table": _fit_table(r_chair), "cite": [f"catalog:{chair['id']}", "profile", "fit_check"]},
        {"id": "home", "title": "6. Home accessibility",
         "body": (f"Narrowest doorway: {home.get('narrowestDoorwayName')} {_fmt(home['narrowestDoorwayIn'])}. "
                  f"Hallway turning space: {_fmt(home['hallwayTurnSpaceIn'])}. "
                  f"The {chair['name']} needs {_fmt(chair['overallWidthIn'] + 2)} with hand clearance and turns in "
                  f"{_fmt(chair['turningRadiusIn'])}."),
         "cite": ["profile.home", f"catalog:{chair['id']}"]},
        {"id": "criteria", "title": "7. Policy criteria",
         "items": [
             {"label": f"{q['clause']} {q['label']} — {q['evidence']}", "done": q["status"] == "evidence"}
             for q in cov["result"]["requirements"]
         ], "cite": ["policy §4.2(a)–(d)"]},
        {"id": "clinician", "title": "8. Clinician statement",
         "body": "To be completed and signed by treating clinician.", "placeholder": True},
        {"id": "attachments", "title": "9. Attachments checklist",
         "items": [
             {"label": "Denial notice (Nov 13, 2026)", "done": True},
             {"label": "Fit check report (Milo)", "done": True},
             {"label": "Face-to-face exam note (within 45 days)", "done": False},
             {"label": "Signed clinician statement", "done": False},
         ]},
    ]
    vs = _versions()
    v = {
        "version": len(vs) + 1,
        "title": f"Appeal: power wheelchair — {profile['name']}",
        "createdAt": state.now_iso(),
        "item": chair["id"],
        "sections": sections,
        "footer": FOOTER,
        "model": model,
        "source": "live" if model else "template",
        "objections": [],
        "diff": None,
    }
    _save_version(v)
    if case["status"] == "denied":
        state.update_case(status="appeal_draft")
    evidence = cov["evidence"][:4] + [
        {"label": f"{basic['name']} fails", "value": ", ".join(r_basic["failed"]), "source": f"fit_check:{basic['id']}", "sourceType": "catalog", "live": False},
        {"label": f"{chair['name']} passes", "value": "5 / 5 checks", "source": f"fit_check:{chair['id']}", "sourceType": "catalog", "live": False},
        {"label": "Self-propel limit", "value": f"{profile['canSelfPropelFt']} ft", "source": "profile", "sourceType": "profile", "live": False},
    ]
    return {"result": {"packet": v}, "evidence": evidence,
            "summary": f"Your appeal draft v{v['version']} is ready. It's a draft for your clinician to review and sign.",
            "link": "/appeal"}


# ----------------------------------------------------------------------------
# review (Firedrill strict reviewer)
# ----------------------------------------------------------------------------


def _rule_reviewer(v: dict) -> list[dict]:
    ids = {s["id"] for s in v["sections"]}
    obj = []
    if "optimal_manual" not in ids:
        obj.append({
            "id": "optimal_manual",
            "claim": "The packet only rules out the basic manual chair.",
            "why_weak": ("Policy §4.2(a) asks whether the member can use an optimally configured manual "
                         "wheelchair. A lightweight manual chair hasn't been ruled out."),
            "fix": "Add the fit check for a lightweight manual chair (Aero M1) and show why it still fails.",
        })
    if "home_assessment" not in ids:
        obj.append({
            "id": "home_assessment",
            "claim": "Home measurements are listed but not documented.",
            "why_weak": "Policy §4.2(b) requires a home assessment documenting doorway widths and turning space.",
            "fix": "Add a home assessment table with the measured values and list the assessment form as an attachment.",
        })
    return obj


async def review() -> dict:
    v = latest()
    if not v:
        await draft()
        v = latest()

    # Firedrill live hook goes here once configured; fallback = rule-based strict reviewer.
    objections, live = await sponsor_call(firedrill.SPONSOR, "simulate_review", None, lambda: _rule_reviewer(v))
    vs = _versions()
    vs[-1]["objections"] = objections
    state.kv_set("appeal_versions", vs)
    ev = [{"label": "Objection", "value": o["claim"] + " " + o["why_weak"], "source": "reviewer simulation",
           "sourceType": "model", "live": live} for o in objections]
    n = len(objections)
    summary = (f"The strict reviewer raised {n} objection{'s' if n != 1 else ''}. Want me to fix them?" if n
               else "The strict reviewer found no objections.")
    return {"result": {"objections": objections, "version": vs[-1]["version"]}, "evidence": ev, "summary": summary,
            "link": "/appeal"}


# ----------------------------------------------------------------------------
# revise
# ----------------------------------------------------------------------------


async def revise() -> dict:
    v = latest()
    if not v:
        return await draft()
    if not v.get("objections"):
        await review()
        v = latest()
    profile = state.get_profile()
    home = profile["home"]
    sections = [dict(s) for s in v["sections"]]
    fixed = []
    for o in v["objections"]:
        oid = o.get("id")
        if oid == "optimal_manual" and not any(s["id"] == "optimal_manual" for s in sections):
            aero = state.get_chair("aero-m1")
            r = fit_check.check_chair(aero, profile)
            idx = next(i for i, s in enumerate(sections) if s["id"] == "alt_fails") + 1
            sections.insert(idx, {
                "id": "optimal_manual", "title": f"4b. Why an optimally configured manual chair also fails ({aero['name']})",
                "body": ("Even a lightweight manual chair that fits the member's body and home fails on propulsion: "
                         f"the member can self-propel a manual chair for only about {profile['canSelfPropelFt']} ft, "
                         "so it cannot be used functionally for daily activities in the home (\u00a74.2(a)). "
                         "Failed: " + "; ".join(c["detail"] for c in r["checks"] if not c["pass"]) + "."),
                "table": _fit_table(r), "cite": [f"catalog:{aero['id']}", "profile", "policy §4.2(a)"],
            })
            fixed.append(oid)
        elif oid == "home_assessment" and not any(s["id"] == "home_assessment" for s in sections):
            for s in sections:
                if s["id"] == "home":
                    s["id"] = "home_assessment"
                    s["title"] = "6. Home assessment (§4.2(b))"
                    s["table"] = {"columns": ["Measurement", "Value", "Requirement"], "rows": [
                        [f"{home.get('narrowestDoorwayName', 'Narrowest door').capitalize()} width", _fmt(home["narrowestDoorwayIn"]), "≥ chair width + 2″"],
                        ["Hallway turning space", _fmt(home["hallwayTurnSpaceIn"]), "≥ turning radius"],
                    ]}
                    s["body"] = s["body"] + " Measured values are documented below; the signed home assessment form must be attached."
            for s in sections:
                if s["id"] == "attachments":
                    s["items"] = s["items"] + [{"label": "Home assessment form (doorways + turning space)", "done": False}]
            fixed.append(oid)
    new = {**v, "version": len(_versions()) + 1, "createdAt": state.now_iso(), "sections": sections,
           "objections": [], "fixed": fixed}
    diff = [
        {"op": "add" if l.startswith("+") else "del", "text": l[1:]}
        for l in difflib.unified_diff(packet_text(v), packet_text(new), lineterm="", n=0)
        if (l.startswith("+") or l.startswith("-")) and not l.startswith(("+++", "---"))
    ]
    new["diff"] = diff
    _save_version(new)
    ev = [{"label": "Fixed", "value": f, "source": "reviewer objection", "sourceType": "model", "live": False} for f in fixed]
    return {"result": {"packet": new, "diff": diff}, "evidence": ev,
            "summary": f"Revised to v{new['version']} — fixed {len(fixed)} objection{'s' if len(fixed) != 1 else ''}.",
            "link": "/appeal"}


# ----------------------------------------------------------------------------
# file
# ----------------------------------------------------------------------------


async def file(verification_id: Optional[str], confirmed: bool) -> dict:
    v = latest()
    if not v:
        await draft()
        v = latest()
    if not confirmed:
        return {"result": {"status": "needs_confirmation"}, "evidence": [], "summary": "I won't file without your yes."}
    if not persona.is_verified(verification_id):
        return {"result": {"status": "needs_verification"}, "evidence": [],
                "summary": "First I need to verify it's you. Opening verification."}
    conf = f"ACME-APL-{secrets.randbelow(900000) + 100000}"
    today = date.today()
    case = state.update_case(status="appeal_filed", filedOn=today.isoformat(),
                             decisionDue=(today + timedelta(days=30)).isoformat(), confirmation=conf)
    vs = _versions()
    vs[-1]["filed"] = {"confirmation": conf, "at": state.now_iso(), "verification": verification_id, "sandbox": True}
    state.kv_set("appeal_versions", vs)
    ev = [
        {"label": "Verified human", "value": f"Persona inquiry {verification_id}", "source": "persona", "sourceType": "user", "live": False},
        {"label": "Packet", "value": f"v{v['version']}", "source": "appeal", "sourceType": "model", "live": False},
        {"label": "Confirmation", "value": f"{conf} (sandbox)", "source": "Acme sandbox", "sourceType": "case", "live": False},
        {"label": "Decision due", "value": case["decisionDue"], "source": "policy §7.3", "sourceType": "policy", "live": False},
    ]
    return {"result": {"status": "filed", "confirmation": conf, "case": case, "sandbox": True}, "evidence": ev,
            "summary": "Appeal filed (sandbox). I'll remind you if Acme doesn't answer in 30 days.", "link": "/appeal"}


async def run(action: str, args: dict, confirmed: bool) -> dict:
    if action == "review":
        return await review()
    if action == "revise":
        return await revise()
    if action == "file":
        return await file(args.get("verification_id"), bool(confirmed))
    return await draft(args.get("item") or "glide-p2")
