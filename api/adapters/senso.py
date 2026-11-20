"""Senso — trusted context layer for chair specs, the policy and the denial letter.

Live (SENSO_API_KEY = tgr_…), per docs.senso.ai quickstart:
  POST /org/kb/raw            {title, text}            → ingest (202; 409 if the text already exists)
  POST /org/search            {query}                  → {answer, results[{content_id,title,chunk_text,score,rank}]}
  GET  /org/kb/nodes/{id}                              → processing status
Milo seeds its knowledge (catalog specs, policy, denial letter) once, then every fit check / coverage / chat
answer asks Senso and records the citation in the receipt. Exact quotes still come from the source text.
Mock: data/catalog.json + data/policy.md with paragraph (§) citations.
"""
from __future__ import annotations

import os
import re
from typing import Optional

import httpx

import state
from .base import configured, sponsor_call

SPONSOR = "senso"
BASE = "https://apiv2.senso.ai/api/v1"


def status() -> str:
    return "live" if configured("SENSO_API_KEY") else "mock"


def _live() -> bool:
    return configured("SENSO_API_KEY")


def _headers() -> dict:
    return {"X-API-Key": os.environ["SENSO_API_KEY"], "Content-Type": "application/json"}


def policy_clauses() -> dict[str, str]:
    """{'§4.2(a)': 'A power mobility device ...', ...}"""
    out: dict[str, str] = {}
    for m in re.finditer(r"\*\*(§[\d.]+(?:\([a-z]\))?)[^*]*\*\*\s*(.+)", state.load_text("policy.md")):
        out[m.group(1)] = re.sub(r"\*\*", "", m.group(2)).strip()
    return out


# ---- live calls ---------------------------------------------------------------


_cache: dict[str, dict] = {}


async def _search(query: str) -> dict:
    if query in _cache:  # searches cost credits — reuse answers within this process
        return _cache[query]
    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.post(f"{BASE}/org/search", headers=_headers(), json={"query": query})
        r.raise_for_status()
        _cache[query] = r.json()
        return _cache[query]


def _docs() -> list[dict]:
    docs = [{"title": "Acme Health Plan (fictional) — DME policy §4.2 Power Mobility Devices", "text": state.load_text("policy.md")}]
    inbox = state.DATA / "inbox" / "denial_email.md"
    if inbox.exists():
        docs.append({"title": "Acme denial letter — power wheelchair (fictional, Nov 13 2026)", "text": inbox.read_text()})
    for ch in state.get_catalog():
        docs.append({
            "title": f"MobilityMart spec sheet — {ch['name']}",
            "text": (f"{ch['name']} ({ch['type']} wheelchair). Overall width {ch['overallWidthIn']} in. "
                     f"Seat width {ch['seatWidthIn']} in. Seat-to-floor height {ch['seatToFloorIn']} in. "
                     f"Turning radius {ch['turningRadiusIn'] if ch['turningRadiusIn'] is not None else 'n/a (manual)'} in. "
                     f"Price ${ch['priceUsd']}. {ch.get('note', '')} (Fictional demo catalog, MobilityMart demo store.)"),
        })
    return docs


async def seed() -> dict:
    """Ingest Milo's trusted documents into Senso once (duplicates return 409 and are skipped)."""
    if not _live():
        return {"live": False, "ingested": 0, "skipped": 0}
    ingested, skipped, ids = 0, 0, state.kv_get("senso_ids", {})
    async with httpx.AsyncClient(timeout=20) as c:
        for d in _docs():
            r = await c.post(f"{BASE}/org/kb/raw", headers=_headers(), json=d)
            if r.status_code in (200, 201, 202):
                body = r.json()
                ids[body.get("id") or d["title"]] = {"title": d["title"], "kb_node_id": body.get("kb_node_id")}
                ingested += 1
            elif r.status_code == 409:
                skipped += 1
            else:
                raise RuntimeError(f"senso ingest {r.status_code}: {r.text[:200]}")
    state.kv_set("senso_ids", ids)
    return {"live": True, "ingested": ingested, "skipped": skipped}


# ---- adapter API used by tools ----------------------------------------------------


async def ask(question: str) -> Optional[dict]:
    """Senso answer + top citations, or None when not live / failed."""
    if not _live():
        return None

    async def live():
        d = await _search(question)
        results = d.get("results") or []
        return {"answer": d.get("answer"), "citations": [
            {"title": r.get("title"), "content_id": r.get("content_id"), "score": r.get("score"),
             "text": (r.get("chunk_text") or "")[:240]} for r in results[:3]]}

    value, was_live = await sponsor_call(SPONSOR, "search", live, lambda: None)
    return value if was_live else None


async def get_spec(item_id: str) -> dict | None:
    value, _ = await sponsor_call(SPONSOR, "get_spec", None, lambda: state.get_chair(item_id))
    return value


async def get_catalog() -> list[dict]:
    """Catalog for fit checks. When live, Senso confirms the spec sheets it holds (citation in the receipt)."""
    if _live():
        async def live():
            d = await _search("wheelchair spec sheets: overall width, seat width, seat-to-floor height, turning radius")
            if not (d.get("results") or []):
                raise RuntimeError("no spec sheets in Senso yet")
            return state.get_catalog()

        value, _ = await sponsor_call(SPONSOR, "search.specs", live, state.get_catalog)
        return value
    value, _ = await sponsor_call(SPONSOR, "get_catalog", None, state.get_catalog)
    return value


async def query_policy(clause: str) -> dict:
    """Exact clause text (quoted from the source) + Senso's citation when live."""
    text = policy_clauses().get(clause, "")

    async def live():
        d = await _search("Acme Health Plan power wheelchair coverage criteria, cost share and appeal deadline")
        top = (d.get("results") or [{}])[0]
        return {"answer": text, "citation": f"policy {clause}", "senso": {"title": top.get("title"), "score": top.get("score"),
                                                                           "content_id": top.get("content_id")}}

    value, _ = await sponsor_call(SPONSOR, f"query_policy {clause}", live if _live() else None,
                                  lambda: {"answer": text, "citation": f"policy {clause}"})
    return value
