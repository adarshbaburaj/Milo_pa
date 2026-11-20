"""Prediction eval: 30 letter sequences → top-1 / top-4 accuracy, local vs LLM.

Run: cd api && .venv/bin/python ../scripts/eval.py
"""
from __future__ import annotations

import asyncio
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import engine  # noqa: E402
import state  # noqa: E402
from adapters.base import start_trace  # noqa: E402

CASES = [
    ("I W W", "I want water"), ("W W A", "Where's my wheelchair appeal?"), ("C A", "Call Alex"),
    ("I I P", "I'm in pain"), ("I C", "I'm cold"), ("I T", "I'm tired"), ("T Y", "Thank you"),
    ("P W", "Please wait"), ("I N H", "I need help"), ("I N T B", "I need the bathroom"),
    ("Y P", "Yes please"), ("N T Y", "No thank you"), ("W D A S", "What did Acme say?"),
    ("C I T G F", "Check if the Glide fits"), ("C T C F", "Check the Comet fits"),
    ("W C F M H", "Which chairs fit my home?"), ("D M A", "Draft my appeal"), ("F T A", "File the appeal"),
    ("O T G P", "Order the Glide P2"), ("A A T A", "Ask Alex to approve"), ("T O T L", "Turn on the lights"),
    ("O T D", "Open the door"), ("I L Y", "I love you"), ("G M", "Good morning"), ("G N", "Good night"),
    ("I W C", "I want coffee"), ("I W T W T", "I want to watch TV"), ("I H", "I'm hungry"),
    ("W I M A D", "When is my appeal due?"), ("H A Y", "How are you?"),
]


def norm(s: str) -> str:
    return s.lower().strip().rstrip("?.!")


async def main() -> None:
    state.init_db()
    phrases = state.list_phrases()
    rows = []
    for name in ("local", "llm"):
        top1 = top4 = 0
        t0 = time.perf_counter()
        for letters, want in CASES:
            if name == "local":
                out = engine.predict_local(letters, phrases, now=datetime.now())
            else:
                start_trace()
                out = (await engine.predict(letters))["suggestions"]
            texts = [norm(s["text"]) for s in out]
            top1 += texts[:1] == [norm(want)]
            top4 += norm(want) in texts
        ms = (time.perf_counter() - t0) * 1000 / len(CASES)
        rows.append((name, top1, top4, ms))
    print(f"{'strategy':<8} {'top-1':>7} {'top-4':>7} {'ms/seq':>8}")
    for name, t1, t4, ms in rows:
        print(f"{name:<8} {t1 / len(CASES):>7.0%} {t4 / len(CASES):>7.0%} {ms:>8.0f}")
    print(f"(n={len(CASES)}; 'llm' = model + memory merge, falls back to local when no model is configured)")


if __name__ == "__main__":
    asyncio.run(main())
