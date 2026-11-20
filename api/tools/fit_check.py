"""fit_check — chairs vs Maria's body + home measurements (WRITEUP §9.1)."""
from __future__ import annotations

from typing import Optional


def _fmt(x: float) -> str:
    return f"{x:g}″"


def check_chair(chair: dict, profile: dict) -> dict:
    home = profile["home"]
    hip = profile["hipWidthIn"]
    tmin, tmax = profile["transferHeightRangeIn"]
    door = home["narrowestDoorwayIn"]
    door_name = home.get("narrowestDoorwayName", "narrowest door")
    turn_space = home["hallwayTurnSpaceIn"]
    propel = profile["canSelfPropelFt"]

    checks = []

    w = chair["overallWidthIn"]
    need = w + 2.0
    ok = need <= door
    checks.append({
        "rule": "Doorway",
        "pass": ok,
        "detail": f"Overall width {_fmt(w)} + 2″ clearance = {_fmt(need)} {'≤' if ok else '>'} {door_name} {_fmt(door)}",
        "numbers": {"overallWidthIn": w, "clearanceIn": 2.0, "requiredIn": need, "doorwayIn": door},
        "short": None if ok else f"{_fmt(need - door)} too wide for your {door_name}",
    })

    s = chair["seatWidthIn"]
    lo, hi = hip + 1, hip + 3
    ok = lo <= s <= hi
    checks.append({
        "rule": "Seat width",
        "pass": ok,
        "detail": f"Seat {_fmt(s)} {'within' if ok else 'outside'} {_fmt(lo)}–{_fmt(hi)} (hips {_fmt(hip)} + 1–3″)",
        "numbers": {"seatWidthIn": s, "minIn": lo, "maxIn": hi, "hipWidthIn": hip},
        "short": None if ok else (f"seat {_fmt(s)} is too narrow" if s < lo else f"seat {_fmt(s)} is too wide"),
    })

    h = chair["seatToFloorIn"]
    ok = tmin <= h <= tmax
    checks.append({
        "rule": "Transfer height",
        "pass": ok,
        "detail": f"Seat-to-floor {_fmt(h)} {'within' if ok else 'outside'} transfer range {_fmt(tmin)}–{_fmt(tmax)}",
        "numbers": {"seatToFloorIn": h, "minIn": tmin, "maxIn": tmax},
        "short": None if ok else f"seat height {_fmt(h)} is outside your transfer range",
    })

    r = chair.get("turningRadiusIn")
    if r is None:
        checks.append({
            "rule": "Turning",
            "pass": True,
            "detail": f"Manual chair — no powered turning radius; hallway turn space {_fmt(turn_space)}",
            "numbers": {"turningRadiusIn": None, "hallwayTurnSpaceIn": turn_space},
            "short": None,
        })
    else:
        ok = r <= turn_space
        checks.append({
            "rule": "Turning",
            "pass": ok,
            "detail": f"Turning radius {_fmt(r)} {'≤' if ok else '>'} hallway turn space {_fmt(turn_space)}",
            "numbers": {"turningRadiusIn": r, "hallwayTurnSpaceIn": turn_space},
            "short": None if ok else f"needs {_fmt(r)} to turn; your hallway has {_fmt(turn_space)}",
        })

    needs_power = propel < 50
    is_power = chair["type"] == "power"
    ok = (not needs_power) or is_power
    checks.append({
        "rule": "Propulsion",
        "pass": ok,
        "detail": (f"Can self-propel about {propel} ft (< 50 ft) → needs power; this chair is {chair['type']}"
                   if needs_power else f"Can self-propel {propel} ft → manual is OK"),
        "numbers": {"canSelfPropelFt": propel, "thresholdFt": 50, "power": is_power},
        "short": None if ok else "manual chair — you can only self-propel about " + f"{propel} ft",
    })

    fails = [c for c in checks if not c["pass"]]
    fits = not fails
    if fits:
        one = f"Fits: {_fmt(need)} with clearance through your {_fmt(door)} {door_name}, seat and height in range."
    else:
        one = "; ".join(c["short"] for c in fails if c["short"])
        one = one[0].upper() + one[1:]
    return {
        "id": chair["id"],
        "name": chair["name"],
        "chair": chair,
        "fits": fits,
        "score": len(checks) - len(fails),
        "checks": checks,
        "failed": [c["rule"] for c in fails],
        "one_liner": one,
    }


def check_all(catalog: list[dict], profile: dict) -> list[dict]:
    results = [check_chair(c, profile) for c in catalog]
    results.sort(key=lambda r: (not r["fits"], -r["score"] if not r["fits"] else 0, r["chair"]["priceUsd"]))
    return results


def run(catalog: list[dict], profile: dict, item_id: Optional[str] = None) -> dict:
    """Pure function: returns {result, evidence, summary}."""
    home = profile["home"]
    prof_ev = [
        {"label": "Narrowest doorway", "value": f"{_fmt(home['narrowestDoorwayIn'])} ({home.get('narrowestDoorwayName')})",
         "source": "profile.home", "sourceType": "profile", "live": False},
        {"label": "Hip width", "value": _fmt(profile["hipWidthIn"]), "source": "profile", "sourceType": "profile", "live": False},
        {"label": "Transfer height", "value": f"{_fmt(profile['transferHeightRangeIn'][0])}–{_fmt(profile['transferHeightRangeIn'][1])}",
         "source": "profile", "sourceType": "profile", "live": False},
        {"label": "Hallway turn space", "value": _fmt(home["hallwayTurnSpaceIn"]), "source": "profile.home", "sourceType": "profile", "live": False},
        {"label": "Self-propel distance", "value": f"{profile['canSelfPropelFt']} ft", "source": "profile", "sourceType": "profile", "live": False},
    ]
    if item_id:
        chair = next((c for c in catalog if c["id"] == item_id), None)
        if not chair:
            return {"result": None, "evidence": [], "summary": "I couldn't find that chair in the catalogue."}
        r = check_chair(chair, profile)
        ev = prof_ev + [
            {"label": f"{chair['name']} overall width", "value": _fmt(chair["overallWidthIn"]), "source": f"catalog:{chair['id']}", "sourceType": "catalog", "live": False},
            {"label": f"{chair['name']} seat width", "value": _fmt(chair["seatWidthIn"]), "source": f"catalog:{chair['id']}", "sourceType": "catalog", "live": False},
        ] + [{"label": c["rule"], "value": ("✅ " if c["pass"] else "❌ ") + c["detail"], "source": "fit_check", "sourceType": "model", "live": False} for c in r["checks"]]
        if r["fits"]:
            summary = f"Yes — the {chair['name']} fits your home and body measurements."
        else:
            summary = f"The {chair['name']} doesn't fit: {r['one_liner'][0].lower() + r['one_liner'][1:]}."
        return {"result": {"item": r}, "evidence": ev, "summary": summary, "link": f"/fit/{chair['id']}"}

    results = check_all(catalog, profile)
    passing = [r for r in results if r["fits"]]
    ev = prof_ev + [{"label": r["name"], "value": ("✅ fits" if r["fits"] else "❌ " + ", ".join(r["failed"])),
                     "source": f"catalog:{r['id']}", "sourceType": "catalog", "live": False} for r in results]
    names = " and the ".join(r["name"] for r in passing)
    summary = (f"{len(passing)} of {len(results)} chairs fit your home: the {names}." if passing
               else "None of the chairs fit your measurements.")
    return {"result": {"items": results}, "evidence": ev, "summary": summary, "link": "/fit"}
