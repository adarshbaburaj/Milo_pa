"""route — an accessible way from A to B (Google Places + Routes APIs, key stays server-side).

What is real and honest:
  * Places API (New) `accessibilityOptions`: wheelchair-accessible entrance / parking / restroom / seating at the
    destination, straight from Google.
  * Routes API transit with LESS_WALKING (fewest rolling segments) and a WALK alternative for short trips.
  * Google does not expose kerb cuts, slopes or broken lifts — Milo says so, and checks the person's doorway/width
    needs against the destination when the data exists.
Fallback with no key / API not enabled: a real Google Maps directions link (no key needed) + the checklist.
"""
from __future__ import annotations

import os
import time
import urllib.parse
from typing import Any, Optional

import httpx

import state
from adapters.base import record_sponsor

PLACES = "https://places.googleapis.com/v1/places:searchText"
ROUTES = "https://routes.googleapis.com/directions/v2:computeRoutes"
DEFAULT_ORIGIN = "Oakland City Hall, Oakland, CA"  # demo home area (fictional user)


def _key() -> Optional[str]:
    return os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")


def maps_link(origin: str, dest: str) -> str:
    q = urllib.parse.urlencode({"api": 1, "origin": origin, "destination": dest, "travelmode": "transit"})
    return f"https://www.google.com/maps/dir/?{q}"


async def _place(client: httpx.AsyncClient, key: str, text: str) -> Optional[dict]:
    t0 = time.perf_counter()
    r = await client.post(PLACES, headers={
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.accessibilityOptions",
    }, json={"textQuery": text, "locationBias": {"circle": {"center": {"latitude": 37.8044, "longitude": -122.2712}, "radius": 30000}}})
    ok = r.status_code == 200
    record_sponsor("google", "places.searchText", ok, int((time.perf_counter() - t0) * 1000))
    if not ok:
        raise RuntimeError(f"places {r.status_code}: {r.text[:160]}")
    places = r.json().get("places") or []
    return places[0] if places else None


async def _routes(client: httpx.AsyncClient, key: str, origin: str, dest_place_id: str, mode: str) -> Optional[dict]:
    t0 = time.perf_counter()
    body: dict[str, Any] = {"origin": {"address": origin}, "destination": {"placeId": dest_place_id}, "travelMode": mode,
                            "computeAlternativeRoutes": False}
    if mode == "TRANSIT":
        body["transitPreferences"] = {"routingPreference": "LESS_WALKING"}
    r = await client.post(ROUTES, headers={
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,"
                            "routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,"
                            "routes.legs.steps.navigationInstruction.instructions,"
                            "routes.legs.steps.transitDetails.transitLine.nameShort,"
                            "routes.legs.steps.transitDetails.transitLine.vehicle.type,"
                            "routes.legs.steps.transitDetails.stopDetails.departureStop.name,"
                            "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
    }, json=body)
    ok = r.status_code == 200
    record_sponsor("google", f"routes.{mode.lower()}", ok, int((time.perf_counter() - t0) * 1000))
    if not ok:
        raise RuntimeError(f"routes {r.status_code}: {r.text[:160]}")
    rs = r.json().get("routes") or []
    return rs[0] if rs else None


def _summarise_steps(route: dict) -> tuple[list[dict], int]:
    steps, rolling_m = [], 0
    for leg in route.get("legs", []):
        for st in leg.get("steps", []):
            mode = st.get("travelMode", "")
            dist = st.get("distanceMeters", 0) or 0
            td = st.get("transitDetails")
            if td:
                line = td.get("transitLine", {})
                sd = td.get("stopDetails", {})
                txt = (f"Take {line.get('vehicle', {}).get('type', 'transit').title().replace('_', ' ')} "
                       f"{line.get('nameShort', '')} from {sd.get('departureStop', {}).get('name', '?')} "
                       f"to {sd.get('arrivalStop', {}).get('name', '?')}").replace("  ", " ")
                steps.append({"kind": "transit", "text": txt, "meters": dist})
            else:
                rolling_m += dist
                instr = (st.get("navigationInstruction") or {}).get("instructions") or "Continue"
                if steps and steps[-1]["kind"] == "roll":
                    steps[-1]["meters"] += dist
                else:
                    steps.append({"kind": "roll", "text": instr, "meters": dist})
    return steps, rolling_m


async def run(destination: str, origin: Optional[str] = None) -> dict:
    profile = state.get_profile()
    origin = origin or profile.get("homeAddress") or DEFAULT_ORIGIN
    dest = destination.strip() or "Oakland Public Library, Main Library"
    push_limit_m = round((profile.get("canSelfPropelFt") or 20) * 0.3048)
    link = maps_link(origin, dest)
    checklist = [
        "Call ahead: ask if the entrance has a step, and if lifts/elevators are working today.",
        f"Doors along the way should be at least {profile['home']['narrowestDoorwayIn'] - 2 + 2:g}″ clear for your chair + hands.",
        "Google doesn't know kerb cuts, slopes or broken lifts — treat the route as a starting point.",
    ]
    key = _key()
    base = {"origin": origin, "destination": dest, "mapsLink": link, "checklist": checklist, "live": False}
    if not key:
        return {"result": {**base, "note": "No Google Maps key — showing a Google Maps link instead."},
                "evidence": [], "summary": f"Here's a transit route to {dest} in Google Maps. Check the entrance before you go.",
                "link": None}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            place = await _place(client, key, dest)
            if not place:
                return {"result": {**base, "note": "Couldn't find that place."}, "evidence": [],
                        "summary": f"I couldn't find “{dest}”. Try the full name or address."}
            acc = place.get("accessibilityOptions") or {}
            transit = None
            try:
                transit = await _routes(client, key, origin, place["id"], "TRANSIT")
            except Exception:  # noqa: BLE001
                transit = None
            roll = None
            try:
                roll = await _routes(client, key, origin, place["id"], "WALK")
            except Exception:  # noqa: BLE001
                roll = None
    except Exception as e:  # noqa: BLE001
        return {"result": {**base, "note": f"Google APIs unavailable ({str(e)[:80]}). Using a Maps link."}, "evidence": [],
                "summary": f"Here's a transit route to {dest} in Google Maps. Check the entrance before you go."}

    name = (place.get("displayName") or {}).get("text", dest)
    access = {
        "entrance": acc.get("wheelchairAccessibleEntrance"),
        "parking": acc.get("wheelchairAccessibleParking"),
        "restroom": acc.get("wheelchairAccessibleRestroom"),
        "seating": acc.get("wheelchairAccessibleSeating"),
    }
    best = transit or roll
    steps, rolling_m = _summarise_steps(best) if best else ([], 0)
    mins = round(int(str(best.get("duration", "0s")).rstrip("s") or 0) / 60) if best else None
    over = rolling_m > push_limit_m
    lines = []
    if access["entrance"] is True:
        lines.append("It has a wheelchair-accessible entrance")
    elif access["entrance"] is False:
        lines.append("Google says the entrance is NOT wheelchair accessible")
    else:
        lines.append("Google has no entrance accessibility info — call ahead")
    if best:
        lines.append(f"about {mins} min, with {rolling_m} m of rolling" + (" — longer than you can push, so use your power chair or ask for help" if over else ""))
    summary = f"{name}: " + "; ".join(lines) + "."
    poly = (best or {}).get("polyline", {}).get("encodedPolyline")
    evidence = [
        {"label": "Accessible entrance", "value": str(access["entrance"]), "source": "Google Places accessibilityOptions", "sourceType": "catalog", "live": True},
        {"label": "Accessible restroom", "value": str(access["restroom"]), "source": "Google Places accessibilityOptions", "sourceType": "catalog", "live": True},
        {"label": "Rolling distance", "value": f"{rolling_m} m (your limit ≈ {push_limit_m} m)", "source": "Google Routes + profile", "sourceType": "profile", "live": True},
    ]
    return {"result": {**base, "live": True, "place": {"name": name, "address": place.get("formattedAddress"), "access": access},
                       "minutes": mins, "rollingMeters": rolling_m, "pushLimitMeters": push_limit_m, "overPushLimit": over,
                       "steps": steps[:12], "polyline": poly, "mode": "transit" if transit else ("walk" if roll else None)},
            "evidence": evidence, "summary": summary, "link": "/route"}


async def static_map(polyline: Optional[str], origin: str, dest: str) -> Optional[bytes]:
    key = _key()
    if not key:
        return None
    params = {"size": "800x420", "scale": "2", "key": key, "markers": [f"color:0xC2410C|label:A|{origin}", f"color:0x15803D|label:B|{dest}"]}
    if polyline:
        params["path"] = f"color:0xC2410Cff|weight:6|enc:{polyline}"
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get("https://maps.googleapis.com/maps/api/staticmap", params=params)
        record_sponsor("google", "staticmap", r.status_code == 200, 0)
        return r.content if r.status_code == 200 and r.headers.get("content-type", "").startswith("image") else None
