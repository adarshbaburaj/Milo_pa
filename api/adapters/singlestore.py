"""SingleStore — real-time store for the agent's audit trail (receipts) and the case tracker.

Live (SINGLESTORE_URL, e.g. "user:password@host:3306/milo" or "singlestoredb://…"):
  * every receipt is mirrored into `receipts` (JSON body + typed columns for analytics),
  * the case into `cases`,
  * /api/insights runs live SQL over the audit trail (steps by input mode, confirmation rate, avg confidence,
    tools completed) and the deadline query (due within N days).
SQLite (state.py) stays the local source of truth so the demo never breaks.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any, Optional

from .base import configured

SPONSOR = "singlestore"
log = logging.getLogger("milo.singlestore")
_lock = threading.Lock()
_conn = None
_ready = False


def status() -> str:
    return "live" if configured("SINGLESTORE_URL") else "mock"


def _connect():
    global _conn, _ready
    if _conn is not None:
        return _conn
    import singlestoredb as s2

    _conn = s2.connect(os.environ["SINGLESTORE_URL"], autocommit=True)
    if not _ready:
        with _conn.cursor() as c:
            c.execute("""CREATE TABLE IF NOT EXISTS receipts (
                id VARCHAR(40) PRIMARY KEY, ts DATETIME(6), input_mode VARCHAR(10), tool VARCHAR(20),
                confirmed TINYINT NULL, confidence DOUBLE NULL, source VARCHAR(10), partial TINYINT,
                moves INT NULL, body JSON)""")
            c.execute("""CREATE TABLE IF NOT EXISTS cases (
                id VARCHAR(40) PRIMARY KEY, item VARCHAR(80), status VARCHAR(20), denied_on DATE,
                appeal_deadline DATE, filed_on DATE NULL, decision_due DATE NULL, confirmation VARCHAR(40) NULL)""")
        _ready = True
    return _conn


def _run(fn) -> Any:
    if not configured("SINGLESTORE_URL"):
        return None
    try:
        with _lock:
            return fn(_connect())
    except Exception as e:  # noqa: BLE001 — never break the demo
        global _conn
        log.warning("singlestore: %r", e)
        _conn = None
        return None


def mirror_receipt(r: dict) -> None:
    """Fire-and-forget mirror of a receipt (called from state.save_receipt)."""
    if not configured("SINGLESTORE_URL"):
        return

    def work(conn):
        inp = r.get("input") or {}
        with conn.cursor() as c:
            c.execute(
                "REPLACE INTO receipts (id, ts, input_mode, tool, confirmed, confidence, source, partial, moves, body) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (r["id"], r["ts"][:19].replace("T", " "), inp.get("mode"), r.get("tool"),
                 None if r.get("confirmed") is None else int(bool(r.get("confirmed"))), r.get("confidence"),
                 r.get("source"), int(bool(inp.get("partial"))), (inp.get("meta") or {}).get("moves"),
                 json.dumps(r, default=str)),
            )

    threading.Thread(target=lambda: _run(work), daemon=True).start()


def mirror_case(case: dict) -> None:
    if not configured("SINGLESTORE_URL"):
        return

    def work(conn):
        with conn.cursor() as c:
            c.execute(
                "REPLACE INTO cases (id, item, status, denied_on, appeal_deadline, filed_on, decision_due, confirmation) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (case["id"], case["item"], case["status"], case["deniedOn"], case["appealDeadline"], case.get("filedOn"),
                 case.get("decisionDue"), case.get("confirmation")),
            )

    threading.Thread(target=lambda: _run(work), daemon=True).start()


def insights() -> Optional[dict]:
    def work(conn):
        with conn.cursor() as c:
            c.execute("SELECT input_mode, COUNT(*), AVG(confidence) FROM receipts GROUP BY input_mode ORDER BY 2 DESC")
            by_mode = [{"mode": m, "steps": int(n), "avgConfidence": None if a is None else round(float(a), 2)} for m, n, a in c.fetchall()]
            c.execute("SELECT tool, COUNT(*) FROM receipts GROUP BY tool ORDER BY 2 DESC")
            by_tool = [{"tool": t, "count": int(n)} for t, n in c.fetchall()]
            c.execute("SELECT SUM(confirmed = 1), SUM(confirmed = 0), AVG(moves) FROM receipts")
            yes, no, moves = c.fetchone()
            c.execute("SELECT id, item, status, appeal_deadline, DATEDIFF(appeal_deadline, CURRENT_DATE()) FROM cases "
                      "WHERE status IN ('denied','appeal_draft') AND appeal_deadline <= DATE_ADD(CURRENT_DATE(), INTERVAL 60 DAY)")
            due = [{"id": i, "item": it, "status": st, "deadline": str(d), "daysLeft": int(n)} for i, it, st, d, n in c.fetchall()]
        return {"byMode": by_mode, "byTool": by_tool, "confirmed": int(yes or 0), "cancelled": int(no or 0),
                "avgMovesPerSentence": None if moves is None else round(float(moves), 1), "dueSoon": due}

    return _run(work)
