"""ElevenLabs — human-sounding speech. The key stays server-side; the browser streams audio
from /api/tts. If this isn't configured or fails, the browser falls back to its own voice.

Env:
  ELEVENLABS_API_KEY
  ELEVENLABS_MODEL         default eleven_v3 (most expressive); eleven_flash_v2_5 is ~4x faster
  ELEVENLABS_VOICE_USER    voice used when Milo speaks *for* the user (AAC)  — default Lauren
  ELEVENLABS_VOICE_MILO    Milo's own voice                                  — default Jessica
"""
from __future__ import annotations

import os
from typing import AsyncIterator, Literal

import httpx

from .base import configured

Who = Literal["user", "milo"]

BASE = "https://api.elevenlabs.io/v1"
DEFAULT_VOICES = {
    "user": "DODLEQrClDo8wCz460ld",  # Lauren — Friendly, Comforting and Soft
    "milo": "cgSgspJ2msm6clMCkdW9",  # Jessica — Playful, Bright, Warm
}


def status() -> str:
    return "live" if configured("ELEVENLABS_API_KEY") else "mock"


def model() -> str:
    return os.getenv("ELEVENLABS_MODEL", "eleven_v3")


def voice(who: Who) -> str:
    return os.getenv(f"ELEVENLABS_VOICE_{who.upper()}") or DEFAULT_VOICES[who]


async def open_stream(text: str, who: Who) -> tuple[httpx.AsyncClient, httpx.Response]:
    """Start a streaming TTS request. Raises on HTTP error; caller must close client+response."""
    client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=4.0))
    req = client.build_request(
        "POST",
        f"{BASE}/text-to-speech/{voice(who)}/stream",
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
        json={"text": text, "model_id": model()},
    )
    resp = await client.send(req, stream=True)
    if resp.status_code != 200:
        body = (await resp.aread())[:300]
        await resp.aclose()
        await client.aclose()
        raise RuntimeError(f"elevenlabs {resp.status_code}: {body!r}")
    return client, resp


async def iter_audio(client: httpx.AsyncClient, resp: httpx.Response) -> AsyncIterator[bytes]:
    try:
        async for chunk in resp.aiter_bytes():
            yield chunk
    finally:
        await resp.aclose()
        await client.aclose()
