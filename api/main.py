"""Milo API (WRITEUP §13). Run: uvicorn main:app --reload --port 8000"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
from pathlib import Path
from typing import Any, AsyncIterator

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402

import engine  # noqa: E402
import state  # noqa: E402
from adapters import (  # noqa: E402
    airbyte, analytics, arcee, cognee, elevenlabs, firedrill, persona, senso, singlestore, superlinked,
)
from adapters.base import current_trace, start_trace  # noqa: E402
from models import (  # noqa: E402
    ActRequest, CaregiverDecision, CaregiverRequest, PhraseRequest, PredictRequest, RouteRequest,
    VerifyStartRequest,
)
from tools import appeal, caregiver, coverage, fit_check, measure, shop, speak, status  # noqa: E402

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("milo")

app = FastAPI(title="Milo API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

state.init_db()

# ---- SSE broadcast ------------------------------------------------------------

_subscribers: set[asyncio.Queue] = set()


def broadcast(event: str, data: Any) -> None:
    for q in list(_subscribers):
        try:
            q.put_nowait({"event": event, "data": data})
        except asyncio.QueueFull:
            pass


@app.get("/api/events")
async def events(request: Request) -> StreamingResponse:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)

    async def gen() -> AsyncIterator[str]:
        try:
            yield "event: hello\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"event: {msg['event']}\ndata: {json.dumps(msg['data'], default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            _subscribers.discard(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---- health -------------------------------------------------------------------


def sponsor_status() -> dict[str, str]:
    return {
        "llm": arcee.status(),
        "arcee": arcee.arcee_status(),
        "elevenlabs": elevenlabs.status(),
        "cognee": cognee.status(),
        "senso": senso.status(),
        "airbyte": airbyte.status(),
        "superlinked": superlinked.status(),
        "singlestore": singlestore.status(),
        "persona": persona.status(),
        "firedrill": firedrill.status(),
        "amplitude": analytics.status_amplitude(),
        "statsig": analytics.status_statsig(),
    }


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "sponsors": sponsor_status()}


@app.get("/api/tts")
async def tts(text: str, who: str = "milo") -> StreamingResponse:
    """Stream ElevenLabs speech. 503 → the browser uses its own voice instead."""
    text = (text or "").strip()[:800]
    if not text or elevenlabs.status() != "live":
        raise HTTPException(503, "tts unavailable")
    try:
        client, resp = await elevenlabs.open_stream(text, "user" if who == "user" else "milo")
    except Exception as e:  # noqa: BLE001
        logging.getLogger("milo.tts").warning("tts failed: %r", e)
        raise HTTPException(503, "tts unavailable") from e
    return StreamingResponse(elevenlabs.iter_audio(client, resp), media_type="audio/mpeg",
                             headers={"Cache-Control": "no-store"})


@app.post("/api/demo/reset")
async def demo_reset() -> dict:
    state.reset_demo()
    broadcast("reset", {})
    return {"ok": True}


# ---- intent -------------------------------------------------------------------


@app.post("/api/predict")
async def predict(body: PredictRequest) -> dict:
    start_trace()
    strategy = (body.context or {}).get("strategy", "context")
    out = await engine.predict(body.letters, strategy=strategy)
    out["sponsorCalls"] = current_trace()["sponsorCalls"]
    return out


@app.post("/api/route")
async def route(body: RouteRequest) -> dict:
    start_trace()
    out = await engine.route(body.utterance)
    out["sponsorCalls"] = current_trace()["sponsorCalls"]
    return out


async def run_tool(tool: str, args: dict, confirmed: bool) -> dict:
    if tool == "fit_check":
        catalog = await senso.get_catalog()
        profile = state.get_profile()
        out = fit_check.run(catalog, profile, args.get("item") or args.get("item_id"))
        if out["result"] and "items" in out["result"]:
            home = profile.get("home", {})
            out["result"]["items"] = await superlinked.rank(
                "chairs", out["result"]["items"],
                key=lambda r: (not r["fits"], -r["score"] if not r["fits"] else 0, r["chair"]["priceUsd"]),
                query=(f"Wheelchair for someone who can self-propel only about {profile.get('canSelfPropelFt')} ft, "
                       f"hip width {profile.get('hipWidthIn')} in, transfer height "
                       f"{profile.get('transferHeightRangeIn')} in, home doorway "
                       f"{home.get('narrowestDoorwayIn')} in, hallway turn space {home.get('hallwayTurnSpaceIn')} in."),
                text=lambda r: (f"{r['chair']['name']}: {r['chair']['type']} chair, overall width "
                                f"{r['chair']['overallWidthIn']} in, seat width {r['chair']['seatWidthIn']} in, "
                                f"seat-to-floor {r['chair']['seatToFloorIn']} in, turning radius "
                                f"{r['chair'].get('turningRadiusIn')} in, ${r['chair']['priceUsd']}. {r['one_liner']}"),
                # Hard rules first: fitting chairs always above non-fitting ones.
                group=lambda r: (not r["fits"], -r["score"] if not r["fits"] else 0),
                instruction="Rank wheelchairs by how well they suit this person's body, strength and home.",
            )
        return out
    if tool == "coverage":
        return await coverage.run()
    if tool == "appeal":
        return await appeal.run(args.get("action", "draft"), args, confirmed)
    if tool == "status":
        return status.run(args.get("topic", "appeal"))
    if tool == "speak":
        return speak.run(args.get("text", ""))
    if tool == "shop":
        return shop.run(args.get("action", "cart"), args.get("item") or args.get("item_id"), args, confirmed)
    if tool == "caregiver":
        out = caregiver.run(args)
        broadcast("caregiver", out["result"]["request"])
        return out
    raise HTTPException(400, f"unknown tool {tool}")


@app.post("/api/act")
async def act(body: ActRequest) -> dict:
    trace = start_trace()
    t0 = time.perf_counter()
    needs_confirm = body.tool not in engine.READ_ONLY
    if needs_confirm and body.confirmed is not True:
        if body.confirmed is False:
            out = {"result": {"status": "cancelled"}, "evidence": [], "summary": "Okay, I won't do that."}
        else:
            return {"needs_confirmation": True, "summary": "Please confirm first."}
    else:
        out = await run_tool(body.tool, body.args, bool(body.confirmed))

    models = [m for m in [body.predict_model, body.route_model] if m]
    model_dicts = [m.model_dump() for m in models] + trace["models"]
    live = any(c["live"] for c in trace["sponsorCalls"]) or bool(trace["models"]) or any(models)
    receipt = {
        "id": "rcpt_" + secrets.token_hex(5),
        "ts": state.now_iso(),
        "input": body.input_event.model_dump(),
        "interpretedAs": body.interpreted_as or body.input_event.raw,
        "alternatives": [a.model_dump() for a in (body.alternatives or [])] or None,
        "confidence": body.confidence,
        "confirmed": body.confirmed if needs_confirm else None,
        "confirmMode": body.confirm_mode,
        "tool": body.tool,
        "toolArgs": body.args,
        "result": out.get("result"),
        "summary": out.get("summary"),
        "evidence": out.get("evidence", []),
        "model": model_dicts[-1] if model_dicts else None,
        "models": model_dicts,
        "sponsorCalls": trace["sponsorCalls"],
        "source": "live" if live else ("local" if body.input_event.partial or body.tool == "speak" else "mock"),
        "latencyMs": int((time.perf_counter() - t0) * 1000),
    }
    state.save_receipt(receipt)
    conv = state.kv_get("conversation", [])[-20:]
    conv.append({"user": receipt["interpretedAs"], "milo": out.get("summary")})
    state.kv_set("conversation", conv)
    broadcast("receipt", {"id": receipt["id"]})
    analytics.track("tool_completed", {"tool": body.tool, "mode": body.input_event.mode})
    return {"summary": out.get("summary"), "result": out.get("result"), "evidence": out.get("evidence", []),
            "link": out.get("link"), "receipt_id": receipt["id"]}


# ---- receipts -----------------------------------------------------------------


@app.get("/api/receipts")
async def receipts() -> list[dict]:
    return state.list_receipts()


@app.get("/api/receipts/{rid}")
async def receipt(rid: str) -> dict:
    r = state.get_receipt(rid)
    if not r:
        raise HTTPException(404)
    return r


# ---- data ---------------------------------------------------------------------


@app.get("/api/profile")
async def get_profile() -> dict:
    return state.get_profile()


@app.put("/api/profile")
async def put_profile(p: dict) -> dict:
    merged = {**state.get_profile(), **p}
    state.set_profile(merged)
    return merged


@app.get("/api/catalog")
async def catalog() -> dict:
    profile = state.get_profile()
    return {"profile": profile, "items": fit_check.check_all(state.get_catalog(), profile)}


@app.get("/api/catalog/{item_id}")
async def catalog_item(item_id: str) -> dict:
    chair = state.get_chair(item_id)
    if not chair:
        raise HTTPException(404)
    return {"profile": state.get_profile(), "item": fit_check.check_chair(chair, state.get_profile())}


@app.get("/api/case")
async def case() -> dict:
    return status.run("appeal")["result"]


@app.get("/api/coverage")
async def coverage_view() -> dict:
    start_trace()
    out = await coverage.run()
    return {**out["result"], "evidence": out["evidence"]}


@app.get("/api/appeal")
async def appeal_view() -> dict:
    vs = state.kv_get("appeal_versions", [])
    return {"latest": vs[-1] if vs else None, "versions": [{"version": v["version"], "createdAt": v["createdAt"]} for v in vs],
            "case": state.get_case()}


# ---- measurements ------------------------------------------------------------


@app.post("/api/measure/photo")
async def measure_photo(body: dict) -> dict:
    start_trace()
    img = str(body.get("image", ""))
    media = "image/jpeg"
    if img.startswith("data:"):
        media, img = img[5:].split(";base64,", 1)
    out = await measure.estimate(img, media, body.get("target", "doorway"), body.get("reference", "card"))
    out["sponsorCalls"] = current_trace()["sponsorCalls"]
    return out


# ---- memory -------------------------------------------------------------------


@app.post("/api/memory/phrase")
async def memory_phrase(body: PhraseRequest) -> dict:
    start_trace()
    out = await cognee.remember("phrase", body.text, {"kind": body.kind, "tool": body.tool})
    return {"ok": True, "saved": out}


@app.get("/api/memory/phrases")
async def memory_phrases() -> list[dict]:
    return sorted(state.list_phrases(), key=lambda p: -p["count"])


# ---- persona ------------------------------------------------------------------


@app.post("/api/verify/start")
async def verify_start(body: VerifyStartRequest) -> dict:
    start_trace()
    return await persona.start_verification(body.user, body.purpose)


@app.get("/api/verify/{vid}")
async def verify_get(vid: str) -> dict:
    v = persona.get(vid)
    if not v:
        raise HTTPException(404)
    return v


@app.post("/api/verify/{vid}/complete")
async def verify_complete(vid: str) -> dict:
    v = persona.complete(vid)
    if not v:
        raise HTTPException(404)
    broadcast("verification", v)
    return v


# ---- caregiver ----------------------------------------------------------------


@app.post("/api/caregiver/request")
async def caregiver_request(body: CaregiverRequest) -> dict:
    r = caregiver.request(body.item_id, body.amount_usd, body.note)
    broadcast("caregiver", r)
    return r


@app.get("/api/caregiver/{tok}")
async def caregiver_get(tok: str) -> dict:
    r = caregiver.get(tok)
    if not r:
        raise HTTPException(404)
    return r


@app.post("/api/caregiver/{tok}/decision")
async def caregiver_decision(tok: str, body: CaregiverDecision) -> dict:
    r = caregiver.decide(tok, body.approve)
    if not r:
        raise HTTPException(404)
    broadcast("caregiver", r)
    return r


# ---- impact (real session numbers only) ---------------------------------------


@app.get("/api/impact")
async def impact() -> dict:
    rs = state.list_receipts()
    partial = [r for r in rs if r["input"].get("partial") and r.get("interpretedAs")]
    moves, saved, typed = [], 0, 0
    top1 = 0
    for r in partial:
        meta = r["input"].get("meta") or {}
        m = meta.get("moves") or len([c for c in r["input"]["raw"] if c.isalpha()])
        moves.append(m)
        full = len(r["interpretedAs"])
        typed += full
        saved += max(0, full - m)
        if (meta.get("rank") or 0) == 1:
            top1 += 1
    return {
        "sentences": len(partial),
        "avgMovesPerSentence": round(sum(moves) / len(moves), 1) if moves else None,
        "lettersSavedPct": round(100 * saved / typed) if typed else None,
        "top1AccuracyPct": round(100 * top1 / len(partial)) if partial else None,
        "receipts": len(rs),
    }
