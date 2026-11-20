"""measure — estimate a measurement from a photo with a known reference object (Claude vision).

Always an ESTIMATE: the UI labels it and the appeal asks for a home assessment / clinician to confirm.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Optional

from adapters.base import configured, record_model, record_sponsor

TARGETS = {
    "doorway": "the clear opening width of the doorway (inside the frame, door fully open)",
    "hallway": "the width of the hallway / turning space at its narrowest point",
    "hip": "the person's hip width while seated (widest point across the hips)",
    "seat": "the seat width of the wheelchair in the photo (between the side guards)",
    "seat_height": "the height from the floor to the top of the seat",
}
REFERENCES = {
    "card": "a standard bank/credit card (3.37 in × 2.13 in)",
    "a4": "an A4 sheet of paper (8.27 in × 11.69 in)",
    "letter": "a US Letter sheet of paper (8.5 in × 11 in)",
}


async def estimate(image_b64: str, media_type: str, target: str, reference: str) -> dict:
    what = TARGETS.get(target, target)
    ref = REFERENCES.get(reference, reference)
    if not configured("ANTHROPIC_API_KEY"):
        return {"ok": False, "message": "Photo estimates need the Claude API key. Enter the number, or ask a helper to measure."}
    import anthropic

    prompt = (
        f"Estimate {what} in inches. The photo contains {ref} as a size reference, placed in the same plane as the "
        "thing to measure. Use the reference to scale. If the reference or the target is not clearly visible, say so. "
        'Reply with JSON only: {"inches": number|null, "confidence": "low"|"medium"|"high", "note": "<one short sentence>"}'
    )
    t0 = time.perf_counter()
    try:
        client = anthropic.AsyncAnthropic(max_retries=0, timeout=60)
        msg = await asyncio.wait_for(client.messages.create(
            model=os.getenv("CLAUDE_VISION_MODEL", "claude-sonnet-5-5"),
            max_tokens=1500,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ]}],
        ), timeout=60)
        text = "".join(b.text for b in msg.content if b.type == "text")
        m = re.search(r"\{.*\}", text, re.S)
        data = json.loads(m.group(0)) if m else {}
        ms = int((time.perf_counter() - t0) * 1000)
        record_sponsor("claude", "vision.measure", True, ms)
        record_model(msg.model, ms, (msg.usage.input_tokens or 0) + (msg.usage.output_tokens or 0), "vision")
        inches: Optional[float] = data.get("inches")
        return {"ok": inches is not None, "inches": round(float(inches), 1) if inches is not None else None,
                "confidence": data.get("confidence", "low"), "note": data.get("note", ""), "model": msg.model,
                "message": None if inches is not None else (data.get("note") or "I couldn't measure from that photo.")}
    except Exception as e:  # noqa: BLE001
        record_sponsor("claude", "vision.measure", False, int((time.perf_counter() - t0) * 1000))
        return {"ok": False, "message": f"Photo estimate failed ({type(e).__name__}). Enter the number or ask a helper."}
