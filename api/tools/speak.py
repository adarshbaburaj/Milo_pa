"""speak — say a phrase aloud for the user (TTS runs in the browser)."""
from __future__ import annotations


def run(text: str) -> dict:
    text = (text or "").strip()
    return {
        "result": {"text": text, "display": "large"},
        "evidence": [{"label": "Phrase", "value": text, "source": "user selection", "sourceType": "user", "live": False}],
        "summary": f"“{text}”",
    }
