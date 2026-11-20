"""Intent engine: prediction (letters -> phrases) and routing (utterance -> tool).

LLM first (small tier), local fallback always available (WRITEUP §8.5).
"""
from __future__ import annotations

import json
import math
import re
import time
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import state
from adapters import arcee, cognee

PROMPTS = Path(__file__).resolve().parent / "prompts"

STOPWORDS = {"my", "the", "a", "an", "to", "of", "is", "if", "for", "in", "on", "at", "it", "me", "does", "did"}

TOOLS = {"fit_check", "coverage", "appeal", "shop", "caregiver", "status", "speak", "chat", "route"}
READ_ONLY = {"fit_check", "status", "coverage", "chat", "route"}

CHAIR_KEYWORDS = {
    "basic": "basic-manual", "standard": "basic-manual",
    "aero": "aero-m1", "glide": "glide-p2", "nimbus": "nimbus-p3",
    "terra": "terra-hd", "urban": "urban-fold", "comet": "comet-mw", "strider": "strider-rw",
}


@lru_cache(maxsize=8)
def prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text()


# ----------------------------------------------------------------------------
# Letter parsing + local prediction
# ----------------------------------------------------------------------------


def parse_letters(letters: str) -> list[str]:
    """'W W A' -> ['w','w','a'];  'IWW' -> ['i','w','w'];  'WA_T' -> ['wa','t'].

    An underscore (or ␣) groups letters into one word-prefix; otherwise every
    letter is the first letter of a word.
    """
    s = letters.strip().lower().replace("␣", "_")
    if "_" in s:
        return [g.replace(" ", "") for g in s.split("_") if g.replace(" ", "")]
    return [c for c in s if c.isalpha()]


def words_of(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9']+", text.lower())]


def _align(tokens: list[str], words: list[str]) -> Optional[tuple[int, int]]:
    """Match tokens to words in order; only stopwords may be skipped.

    Returns (skips, trailing_words) for the best alignment that consumes every
    token, or None.
    """
    best: Optional[tuple[int, int]] = None

    def go(i: int, j: int, skips: int) -> None:
        nonlocal best
        if i == len(tokens):
            cand = (skips, len(words) - j)
            if best is None or (cand[1], cand[0]) < (best[1], best[0]):
                best = cand
            return
        if j == len(words):
            return
        if words[j].startswith(tokens[i]):
            go(i + 1, j + 1, skips)
        if words[j] in STOPWORDS:
            go(i, j + 1, skips + 1)

    go(0, 0, 0)
    return best


def score_phrase(tokens: list[str], text: str) -> float:
    words = words_of(text)
    if not tokens or not words:
        return 0.0
    al = _align(tokens, words)
    if al is not None:
        skips, trailing = al
        if trailing == 0:
            return max(0.6, 1.0 - 0.08 * skips)  # acronym match
        consumed = len(words) - trailing
        return max(0.2, 0.45 + 0.3 * consumed / len(words) - 0.05 * skips)  # still typing
    joined = "".join(tokens)
    if len(joined) >= 2 and words[0].startswith(joined):
        return 0.7  # prefix style on the first word
    return 0.0


def _boost(p: dict, now: datetime, max_count: int) -> float:
    freq = math.log1p(p.get("count", 0)) / math.log1p(max(max_count, 1))
    tod = 1.0 if p.get("usualTime") in (state.time_bucket(now.hour),) else 0.0
    return 0.10 * freq + 0.06 * tod


def predict_local(letters: str, phrases: list[dict], now: Optional[datetime] = None, k: int = 4,
                  strategy: str = "context") -> list[dict]:
    now = now or datetime.now()
    tokens = parse_letters(letters)
    if not tokens:
        top = sorted(phrases, key=lambda p: -(p.get("count", 0)))
        return [_sugg(p, 0.3) for p in top[:k]]
    max_count = max((p.get("count", 0) for p in phrases), default=1)
    scored: list[tuple[float, dict]] = []
    for p in phrases:
        base = score_phrase(tokens, p["text"])
        if base <= 0:
            continue
        boost = _boost(p, now, max_count) if strategy == "context" else 0.10 * math.log1p(p.get("count", 0)) / math.log1p(max(max_count, 1))
        scored.append((base + boost, p))

    # prefix style: single words that start with the joined letters ("W A T" -> "water")
    joined = "".join(tokens)
    if len(joined) >= 3:
        seen = set()
        for p in phrases:
            for w in words_of(p["text"]):
                if len(w) > len(joined) and w.startswith(joined) and w not in seen and w not in STOPWORDS:
                    seen.add(w)
                    scored.append((0.55, {"text": w.capitalize(), "kind": "say", "tool": "none"}))

    # always offer k tiles: fall back to phrases whose first word matches, then frequent phrases
    if len(scored) < k:
        have = {p["text"] for _, p in scored}
        first = tokens[0]
        for p in phrases:
            if p["text"] in have:
                continue
            ws = words_of(p["text"])
            starts = bool(ws) and ws[0].startswith(first[0])
            scored.append(((0.15 if starts else 0.02) + _boost(p, now, max_count) * 0.5, p))

    scored.sort(key=lambda t: -t[0])
    out, seen_text = [], set()
    for s, p in scored:
        key = p["text"].lower()
        if key in seen_text:
            continue
        seen_text.add(key)
        out.append(_sugg(p, min(0.99, s)))
        if len(out) == k:
            break
    return out


def _sugg(p: dict, conf: float) -> dict:
    tool = p.get("tool") or "none"
    return {
        "text": p["text"],
        "kind": p.get("kind") or "say",
        "tool": None if tool == "none" else tool,
        "confidence": round(conf, 2),
    }


# ----------------------------------------------------------------------------
# Local routing
# ----------------------------------------------------------------------------


def find_chair(text: str) -> Optional[str]:
    t = text.lower()
    for kw, cid in CHAIR_KEYWORDS.items():
        if re.search(rf"\b{kw}\b", t):
            return cid
    return None


def route_local(utterance: str) -> dict:
    t = utterance.lower().strip()
    chair = find_chair(t)

    def task(tool: str, args: dict, confirm: str) -> dict:
        return {"kind": "task", "tool": tool, "args": args, "confirm_text": confirm,
                "needs_confirm": tool not in READ_ONLY}

    if re.search(r"\b(approve|approval|caregiver)\b", t) or re.search(r"\bask alex\b", t):
        return task("caregiver", {"action": "request_approval", "item": chair or "glide-p2"},
                    "Send Alex an approval request?")
    if re.search(r"\b(buy|order|shop|cart|checkout|purchase)\b", t):
        action = "checkout" if re.search(r"\b(checkout|check out|pay|order|buy|purchase)\b", t) else "cart"
        item = chair or "glide-p2"
        name = (state.get_chair(item) or {}).get("name", item)
        return task("shop", {"item": item, "action": action},
                    f"Start checkout for the {name}?" if action == "checkout" else f"Add the {name} to your cart?")
    if re.search(r"\b(appeal|appeals)\b", t) and re.search(r"\b(where|status|when|due|deadline)\b", t):
        return task("status", {"topic": "appeal"}, "Look up your appeal status?")
    if re.search(r"\b(appeal|denied|denial|insurance|acme|cover|coverage|policy)\b", t):
        if re.search(r"\bfile|submit|send\b", t):
            return task("appeal", {"action": "file"}, "File the appeal with Acme (sandbox)?")
        if re.search(r"\breview|check\b", t) and "appeal" in t:
            return task("appeal", {"action": "review"}, "Run the strict reviewer on your appeal?")
        if re.search(r"\bfix|revise|improve\b", t):
            return task("appeal", {"action": "revise"}, "Revise the appeal with the reviewer's fixes?")
        if re.search(r"\bdraft|write|start|make|prepare\b", t):
            return task("appeal", {"action": "draft"}, "Draft your appeal now?")
        return task("coverage", {}, "Check what Acme said and what your plan covers?")
    if re.search(r"\b(fit|fits|door|doorway|chair|chairs|wheelchair)\b", t):
        args = {"item": chair} if chair else {}
        name = (state.get_chair(chair) or {}).get("name") if chair else None
        return task("fit_check", args, f"Check whether the {name} fits your home?" if name else "Check which chairs fit your home?")
    if re.search(r"\b(route|directions|get to|way to|how do i get|take me to|navigate)\b", t):
        dest = re.split(r"\b(?:to|towards)\b", utterance, maxsplit=1)[-1].strip(" ?.") if re.search(r"\bto\b", t) else ""
        return task("route", {"destination": dest}, "Plan an accessible route?")
    if re.search(r"\b(where|status|when|deadline|receipts?)\b", t):
        return task("status", {"topic": "appeal"}, "Look up your status?")
    # questions to Milo (not statements for people nearby) get a real answer
    if t.endswith("?") or re.match(r"^(what|how|why|who|which|can you|could you|do you|does|is|are|should|tell me|explain|help)\b", t):
        if not re.match(r"^(can|could) (you|someone) (help|get|bring|open|call|pass)", t) or t.startswith("can you explain"):
            return {"kind": "chat", "tool": "chat", "args": {"question": utterance.strip()}, "confirm_text": "",
                    "needs_confirm": False}
    return {"kind": "say", "tool": "speak", "args": {"text": utterance.strip()},
            "confirm_text": f"Say “{utterance.strip()}” out loud?", "needs_confirm": True}


# ----------------------------------------------------------------------------
# LLM-backed versions
# ----------------------------------------------------------------------------


def _context() -> dict:
    case = state.get_case()
    conv = state.kv_get("conversation", [])[-5:]
    phrases = sorted(state.list_phrases(), key=lambda p: -p["count"])[:12]
    return {
        "time": datetime.now().strftime("%A %H:%M"),
        "recent_turns": conv,
        "open_tasks": [f"appeal: {case['item']}, {case['status']}, deadline {case['appealDeadline']}"],
        "frequent_phrases": [{"text": p["text"], "count": p["count"], "usual_time": p["usualTime"]} for p in phrases],
    }


async def predict(letters: str, strategy: str = "context") -> dict:
    t0 = time.perf_counter()
    phrases = await cognee.recall_phrases(60)
    local = predict_local(letters, phrases, strategy=strategy)
    tokens = parse_letters(letters)
    if not tokens:
        return {"suggestions": local, "model": None, "latencyMs": 0, "source": "local"}

    ctx = _context()
    freq = "; ".join(f"{p['text']} ({p['count']}, {p['usual_time']})" for p in ctx["frequent_phrases"]) if strategy == "context" else ""
    recent = " / ".join(t.get("user") or "" for t in ctx["recent_turns"])
    habits = cognee.memory_context()  # Cognee knowledge-graph answer about her habits right now (cached)
    user = (
        f"letters: {' '.join(t.upper() for t in tokens)}\n"
        f"time: {ctx['time']}\n"
        f"open tasks: {'; '.join(ctx['open_tasks'])}\n"
        f"recent: {recent}\n"
        f"frequent: {freq}"
        + (f"\nmemory (Cognee): {habits}" if habits and strategy == "context" else "")
    )
    res = await arcee.complete("small", [{"role": "system", "content": prompt("predict")},
                                         {"role": "user", "content": user}], json_mode=False, max_tokens=100)
    if res and isinstance(res["content"], str):
        llm = []
        for line in res["content"].splitlines():
            parts = [x.strip() for x in line.strip().strip("-*0123456789. ").split("|")]
            if len(parts) < 2 or not parts[0]:
                continue
            tool = parts[1] if parts[1] in TOOLS else None
            try:
                conf = float(parts[2]) if len(parts) > 2 else 0.5
            except ValueError:
                conf = 0.5
            llm.append({"text": parts[0].strip('"'), "kind": "task" if tool else "say", "tool": tool,
                        "confidence": round(max(0.0, min(1.0, conf)), 2)})
        # keep only model suggestions consistent with the letters
        llm = [x for x in llm if score_phrase(tokens, x["text"]) > 0]
        if llm:
            merged = _merge(local, llm)
            return {"suggestions": merged, "model": res["model"],
                    "latencyMs": int((time.perf_counter() - t0) * 1000), "source": "live"}
    return {"suggestions": local, "model": None, "latencyMs": int((time.perf_counter() - t0) * 1000),
            "source": "local"}


def _merge(local: list[dict], llm: list[dict]) -> list[dict]:
    """Strong local matches (memory) stay on top; the model fills the rest."""
    out: list[dict] = []
    seen: set[str] = set()

    def add(s: dict) -> None:
        k = s["text"].lower().rstrip("?.!")
        if k not in seen and len(out) < 4:
            seen.add(k)
            out.append(s)

    for s in local:
        if s["confidence"] >= 0.9:
            add(s)
    for s in llm:
        add(s)
    for s in local:
        add(s)
    return out


async def route(utterance: str) -> dict:
    local = route_local(utterance)
    res = await arcee.complete("small", [{"role": "system", "content": prompt("route")},
                                         {"role": "user", "content": utterance}])
    if res and isinstance(res["content"], dict):
        c = res["content"]
        tool = c.get("tool")
        if tool in TOOLS and c.get("kind") in ("say", "task", "chat"):
            args = c.get("args") or {}
            if tool == "speak":
                args.setdefault("text", utterance)
            if tool == "chat":
                args.setdefault("question", utterance)
            if tool == "appeal" and args.get("action") not in ("draft", "review", "revise", "file"):
                args["action"] = "draft"
            return {
                "kind": c["kind"], "tool": tool, "args": args,
                "confirm_text": c.get("confirm_text") or local["confirm_text"],
                "needs_confirm": tool not in READ_ONLY,
                "model": res["model"], "source": "live",
            }
    return {**local, "model": None, "source": "local"}
