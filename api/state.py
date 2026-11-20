"""App state: demo data from /data + a small SQLite store.

SQLite is the fallback for SingleStore (WRITEUP §12). Everything is stored as JSON
blobs so the schema stays trivial and demo resets are instant.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DB_PATH = Path(__file__).resolve().parent / ".milo.sqlite3"

_lock = threading.RLock()


def load_json(name: str) -> Any:
    return json.loads((DATA / name).read_text())


def load_text(name: str) -> str:
    return (DATA / name).read_text()


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


_db = _conn()


def init_db() -> None:
    with _lock:
        _db.executescript(
            """
            CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, ts TEXT NOT NULL, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS phrases (text TEXT PRIMARY KEY, kind TEXT, tool TEXT,
                count INTEGER NOT NULL DEFAULT 0, usual_time TEXT, last_used TEXT, hours TEXT);
            """
        )
        _db.commit()
        if kv_get("seeded") is None:
            reset_demo()


def kv_get(k: str, default: Any = None) -> Any:
    with _lock:
        row = _db.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return json.loads(row["v"]) if row else default


def kv_set(k: str, v: Any) -> None:
    with _lock:
        _db.execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (k, json.dumps(v)))
        _db.commit()


def reset_demo() -> None:
    """Demo mode: Maria's fresh profile, denial in inbox, case denied, seeded phrases."""
    with _lock:
        _db.execute("DELETE FROM kv")
        _db.execute("DELETE FROM receipts")
        _db.execute("DELETE FROM phrases")
        for p in load_json("phrases.json"):
            _db.execute(
                "INSERT INTO phrases (text, kind, tool, count, usual_time, hours) VALUES (?,?,?,?,?,?)",
                (p["text"], p["kind"], p["tool"], p["count"], p["usualTime"], "[]"),
            )
        _db.commit()
    kv_set("profile", load_json("profile.json"))
    kv_set("cases", load_json("cases.json"))
    kv_set("appeal_versions", [])
    kv_set("cart", [])
    kv_set("orders", [])
    kv_set("verifications", {})
    kv_set("caregiver_requests", {})
    kv_set("conversation", [])
    kv_set("seeded", now_iso())


# ---- profile / catalog / cases -----------------------------------------------


def get_profile() -> dict:
    return kv_get("profile") or load_json("profile.json")


def set_profile(p: dict) -> None:
    kv_set("profile", p)


def get_catalog() -> list[dict]:
    return load_json("catalog.json")


def get_chair(item_id: str) -> dict | None:
    for c in get_catalog():
        if c["id"] == item_id:
            return c
    return None


def get_cases() -> list[dict]:
    return kv_get("cases") or load_json("cases.json")


def get_case() -> dict:
    return get_cases()[0]


def update_case(**fields: Any) -> dict:
    cases = get_cases()
    cases[0].update(fields)
    kv_set("cases", cases)
    return cases[0]


# ---- receipts ----------------------------------------------------------------


def save_receipt(r: dict) -> None:
    with _lock:
        _db.execute(
            "INSERT OR REPLACE INTO receipts (id, ts, body) VALUES (?,?,?)",
            (r["id"], r["ts"], json.dumps(r, default=str)),
        )
        _db.commit()


def list_receipts() -> list[dict]:
    with _lock:
        rows = _db.execute("SELECT body FROM receipts ORDER BY ts DESC, rowid DESC").fetchall()
    return [json.loads(r["body"]) for r in rows]


def get_receipt(rid: str) -> dict | None:
    with _lock:
        row = _db.execute("SELECT body FROM receipts WHERE id=?", (rid,)).fetchone()
    return json.loads(row["body"]) if row else None


# ---- phrase memory (Cognee fallback) -----------------------------------------


def list_phrases() -> list[dict]:
    with _lock:
        rows = _db.execute("SELECT * FROM phrases").fetchall()
    return [
        {
            "text": r["text"],
            "kind": r["kind"],
            "tool": r["tool"],
            "count": r["count"],
            "usualTime": r["usual_time"],
            "lastUsed": r["last_used"],
            "hours": json.loads(r["hours"] or "[]"),
        }
        for r in rows
    ]


def bump_phrase(text: str, kind: str | None = None, tool: str | None = None) -> dict:
    hour = datetime.now().hour
    with _lock:
        row = _db.execute("SELECT * FROM phrases WHERE lower(text)=lower(?)", (text,)).fetchone()
        if row:
            hours = json.loads(row["hours"] or "[]")[-49:] + [hour]
            _db.execute(
                "UPDATE phrases SET count=count+1, last_used=?, hours=? WHERE text=?",
                (now_iso(), json.dumps(hours), row["text"]),
            )
        else:
            _db.execute(
                "INSERT INTO phrases (text, kind, tool, count, usual_time, last_used, hours) VALUES (?,?,?,?,?,?,?)",
                (text, kind or "say", tool or "none", 1, time_bucket(hour), now_iso(), json.dumps([hour])),
            )
        _db.commit()
    return {"text": text, "hour": hour}


def time_bucket(hour: int) -> str:
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 22:
        return "evening"
    return "night"
