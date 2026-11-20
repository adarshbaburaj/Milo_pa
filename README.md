# Milo — the personal agent you can talk to *any* way

> Most AI agents assume you can type. Milo works with whatever you can do: speak, sign, or just move your head. Three head movements become a full sentence.

**All data in this demo is fictional.** Milo helps with paperwork and everyday communication. It is not medical or legal advice. Appeal letters are drafts for a clinician to review and sign. Filing and checkout are sandboxed.

## Problem

People with limited hand and arm movement are often shut out of the tools that would help them most. Getting the right wheelchair bought and paid for is a long shopping task: measuring the home, comparing chairs, reading the insurance policy, appealing a denial and checking out. Today it assumes you can type, click and fill in forms.

## What Milo does

Milo is a shopping agent with an audit trail. Its core task is getting the right mobility equipment bought and paid for:

1. **Fit Check**: checks every chair in the catalogue against the person's body and home measurements and shows the numbers ("24.5″ + 2″ clearance = 26.5″ ≤ bathroom door 28″ ✅"). Exactly 2 of 8 chairs fit. The insurer's default manual chair fails.
2. **Coverage**: reads the denial letter and the policy, and cites every fact (`policy §4.2(a)`, `denial letter, para 3`).
3. **Appeal**: drafts an appeal packet from that evidence. A simulated strict reviewer attacks the draft, Milo fixes it (v2, with a diff), and filing requires a verified human plus explicit confirmation.
4. **Accessible checkout**: reads the total aloud, gets caregiver approval for anything over $500 (Alex approves from a phone link), verifies the human, then orders from a demo store.
5. **Speaks for you (AAC)**: "I'm in pain" is said aloud and shown in 64 px type for the people in the room.

Every step lands in **Receipts**: the input mode, what Milo understood, its confidence, the alternatives it showed, what the person confirmed and how, the tool and its inputs and outputs, the evidence (label · value · source), the model and its latency, and whether each sponsor call was live or mock.

## The 4 input modes

| Mode | How |
|---|---|
| **Aa Text** | Type normally, or type just first letters (`W W A`) to use prediction |
| **🎙 Voice** | Web Speech API STT, push-to-talk (hold Space) or tap; replies are read aloud; say "yes"/"no" to confirm |
| **🙂 Head** | MediaPipe FaceLandmarker → head pose → One Euro filter → calibrated cursor. Dwell (800 ms) or nod to select, shake to go back. Pick the **first letter of each word**; Milo predicts the sentence |
| **🤟 Sign (beta)** | MediaPipe HandLandmarker → 63-float hand vector → in-browser k-NN. Static fingerspelling plus YES / NO / HELP / STOP / MORE, trained live on a "Teach Milo a sign" screen. *Not a full ASL translator.* |

Camera frames never leave the browser. Only the chosen letters and phrases are sent to the API.

## Architecture

```
InputEvent → normalise → (letters? → predict → pick) → route → confirm → tool → respond → Receipt → Milo reacts → TTS
```

- **web/**: Next.js 14, TypeScript, Tailwind, Framer Motion, Zustand, MediaPipe Tasks Vision (WASM and models served locally, so it works offline on stage)
- **api/**: FastAPI, Pydantic v2. Tools in `api/tools/*` are pure functions that return `{result, evidence[], summary}`. Every sponsor sits behind an adapter with a mock; a failure or a call slower than 4 s falls back silently and is recorded as `mock` in the receipt.
- **Prediction**: local memory-based acronym matching first. It is instant, skips filler words ("W W A" → "Where's my wheelchair appeal?") and is boosted by frequency and time of day. Model suggestions are then merged in.

## Sponsor tech used (live vs mock, honestly)

Check `GET /api/health` or Settings → API status for the live state.

| Sponsor | Role in Milo | Status |
|---|---|---|
| **Senso** | Trusted context layer: policy, denial letter and chair spec sheets are ingested; fit checks, coverage and every chat answer search Senso and cite the source in the receipt | ✅ live |
| **Superlinked SIE** | Qwen on SIE is the brain (letter prediction, routing, appeal summary) + reranks chairs against the needs profile | ✅ live |
| **Airbyte** | PyAirbyte runs the `source-file` connector to sync the inbox (denial email) into the agent's context | ✅ live |
| **Amplitude** | Unified SDK: task steps + outcomes (`tool_completed`, `input_mode_used`, `suggestion_rank_chosen`, `moves_per_sentence`, `time_to_intent_ms`), autocapture, session replay | ✅ live (ingestion verified) |
| **Statsig** | Agent settings as dynamic config (`milo_agent_settings`: dwell, prediction strategy A/B, suggestion count), gate `sign_mode_beta`, mirrored events | ✅ live |
| **ElevenLabs** | Two human voices: Milo (Sarah) and the voice that speaks for the person (Lauren) | ✅ live |
| **Claude (Anthropic)** | Grounded chat answers, fallback brain, photo measurement estimates (vision) | ✅ live |
| **SingleStore** | Audit trail + case tracker mirrored for live SQL analytics and deadline queries | adapter ready — set `SINGLESTORE_URL` |
| **Cognee** | Phrase memory | mock (SQLite) — key pending |
| **Firedrill** | Strict reviewer simulation | rule-based fallback — sign-in pending |
| **Persona** | Verify the human before filing/paying | sandbox modal |
| **Google Maps** | Places accessibility + least-walking transit routes | Maps-link fallback — Maps key pending |

## How to run

```bash
cp .env.example .env        # add keys, or leave blank: everything has a mock
# API
cd api && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000
# Web (new terminal)
cd web && npm install && npm run dev      # open http://localhost:3000 in Chrome
```

- `http://localhost:3000/?demo=1` resets to Maria's fresh demo state. Press **D** for the Director panel.
- `MOCK_ALL=1` forces every adapter to its mock (safe for stage).
- Tests: `cd api && .venv/bin/python -m pytest -q` · Eval: `cd api && .venv/bin/python ../scripts/eval.py`

### Prediction eval (30 letter sequences)

| strategy | top-1 | top-4 |
|---|---|---|
| local memory | 100% | 100% |
| model + memory merge | 100% | 100% |

## Demo data notice

Maria Alvarez, Alex, Acme Health Plan and MobilityMart are fictional. Profiles store functional measurements only, never diagnoses.

## Limitations

- Sign input is a beta: static fingerspelling plus 5 signs, approximated as static poses.
- Head tracking needs reasonable lighting and Chrome; calibrate per seating position.
- Appeal letters are drafts that need a clinician's review and signature; filing is sandboxed.
- Not medical or legal advice.

## Team

_TBD — names + contacts_
