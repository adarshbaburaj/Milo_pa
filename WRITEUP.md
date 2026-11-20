# Milo — the personal agent you can talk to *any* way

> **Build spec for Claude Code.** Paste this whole file into Claude Code in VS Code and say:
> *"Read WRITEUP.md fully, then build it phase by phase. Commit after every phase. Never block on a sponsor integration — use the mock adapter and move on."*

---

## 0. Instructions for Claude Code (read first)

1. **Hard deadline:** submission closes **4:30 PM PT today (Fri Nov 20, 2026)**. Finalist demos are at 5:00 PM. Build in the phase order of §15. Phases P0 → P1 must be done before anything in P2.
2. **The demo must never break.** Every external service sits behind an adapter with a `mock` implementation. If an API key is missing or a call fails or takes more than 4 s, fall back to the mock **silently** and record `"source": "mock"` in the audit trail.
3. **Read sponsor docs before integrating.** The resource links for every sponsor are on `https://tokensand.com/personalagenthack`. Do **not** guess SDK method names. If the docs aren't reachable, write the adapter against the interface in §12 and leave the mock on.
4. **The UI must be extremely clean and minimal** (see §4). When unsure, remove things. No gradients, no heavy shadows, no dashboard clutter.
5. **Accessibility is the product, not a feature.** Every screen must work by keyboard alone, by voice alone, and by head control alone. Tap targets in head mode are at least 88 px.
6. **Sign language is built last** (Phase P2). Don't start it until everything in P0/P1 works end to end.
7. All demo data is **fictional** (§11). No real health data, no real names, no real insurer.
8. Keep a `PROGRESS.md` in the repo root with checkboxes copied from §15, and tick them as you go.

---

## 1. Product summary

**Milo** is a personal AI agent for people who can't easily use a keyboard, mouse or touchscreen. You can talk to it four ways:

| # | Mode | Who it's for |
|---|------|--------------|
| 1 | **Text** | Default; low vision (large text), cognitive needs (simple choices) |
| 2 | **Voice** | Blind / low-vision users, anyone who can speak |
| 3 | **Head** (first-letter prediction) ⭐ | Limited hand/arm movement, nonverbal users |
| 4 | **Sign** (fingerspelling + 5 signs, beta) | Deaf / hard-of-hearing users — built last |

Every mode feeds **one intent engine** that works out what the person means, confirms it, and then either:

- **Speaks for them** (AAC: "I'm in pain" is said aloud to the people in the room), or
- **Does it for them** using tools: fit-check, insurance coverage + appeal, accessible checkout, caregiver approval, deadline tracking.

Every step is written to an **audit trail ("Receipts")** that shows which input mode was used, what the agent understood, how confident it was, what the user confirmed, and the evidence behind each action.

**Pitch line:** *"Most AI agents assume you can type. Milo works with whatever you can do — speak, sign, or just move your head. Three head movements become a full sentence."*

**How it fits the hackathon brief:** the official challenge is *"Build a shopping agent with an audit trail"*: help someone make a purchase or finish a shopping task, use reliable context, take a meaningful action, and show the information and steps behind its choices. Milo's core task is **getting the right mobility equipment bought and paid for**: find what fits → check coverage → appeal the denial → check out. The Receipts view is the audit trail.

**Agent + mascot:** the agent is called **Milo**, and Milo has a face: a small, cute 8-bit pixel creature that reacts to everything (listens, thinks, jumps when you answer, celebrates when an appeal is filed). See §5.

---

## 2. Demo persona (fictional)

**Maria Alvarez, 34, Oakland CA (fictional).**
- Uses a manual wheelchair today. Has **limited upper-body strength and hand function** (described functionally; no diagnosis anywhere in the app).
- Can move her head reliably. Speech is tiring for long sentences, so she mixes **head mode** with short **voice** commands.
- Her insurer (**"Acme Health Plan" — fictional**) **denied** a power wheelchair as "not medically necessary; a standard manual wheelchair is sufficient."
- Caregiver: **Alex** (her brother), who approves larger purchases.

Secondary persona for the voice-only segment (optional): **Sam, blind**, who uses voice + screen-reader style read-backs.

---

## 3. Core principles (enforce in code)

1. **Confirm before acting.** Nothing is filed, bought or sent without an explicit confirmation in *any* mode (dwell on ✓, nod, say "yes", sign YES, press Enter).
2. **"Not this" is always one movement away.** Every suggestion screen has a "None of these" tile; every action has Undo for 5 s where possible.
3. **Everything goes in Receipts.** Input → interpretation → confirmation → tool → evidence → result.
4. **Functional needs, not diagnoses.** Profiles store measurements and abilities ("can self-propel ≤ 20 ft"), never conditions.
5. **Drafts for professionals.** Appeal letters are labelled *"DRAFT — for clinician review and signature."* The app shows a footer: *"Milo helps with paperwork. It is not medical or legal advice."*
6. **Read-aloud everything important** when voice output is on (default on for voice mode).
7. **Respect `prefers-reduced-motion`.** Milo still changes expression but doesn't jump.

---

## 4. Design system — "calm Notion / Hark-style personal AI"

**Feeling:** a quiet white page, generous space, black text, one accent colour, one cute mascot. It should look like a beautifully kept Notion page that happens to be alive.

### 4.1 Tokens

```css
:root {
  /* surfaces */
  --bg:            #FFFFFF;
  --surface:       #F7F7F5;   /* Notion-style light grey blocks */
  --surface-hover: #EFEFED;
  --border:        #E9E9E7;
  /* text */
  --text:          #37352F;   /* Notion ink */
  --text-muted:    #787774;
  --text-faint:    #ACABA9;
  /* accent + states (use sparingly) */
  --accent:        #2383E2;
  --accent-soft:   #E7F3FF;
  --success:       #0F7B6C;
  --success-soft:  #DDEDEA;
  --warning:       #CB912F;
  --warning-soft:  #FBF3DB;
  --danger:        #E03E3E;
  --danger-soft:   #FBE4E4;
  /* mascot */
  --milo:           #FFD84D;
  --milo-shade:     #F2C230;
  --milo-ink:       #2B2A26;
  /* shape */
  --radius-sm: 6px;  --radius: 10px;  --radius-lg: 16px;
  --shadow: 0 1px 2px rgba(15,15,15,.04), 0 2px 8px rgba(15,15,15,.04);
}
```

Dark mode is P2 only. If built: `--bg #191919`, `--surface #202020`, `--text #E6E6E4`, `--border #2F2F2F`.

### 4.2 Typography
- **Inter** (via `next/font`) for everything. Optional **Newsreader** serif only for the appeal document title.
- Sizes: body 16 px / 1.6; small 14; page title 32/40 semibold; section 20 semibold; head-mode tiles 40 px letters.
- Large-text setting scales the root font to 20 px.

### 4.3 Layout
- Single centred column, **max-width 720 px**, like a Notion page. Lots of top padding (64 px).
- Left **sidebar 240 px** (collapsible), Notion-style: Home, Fit Check, Coverage & Appeal, Shop, Receipts, Settings. Each item = emoji + label (🏠 🪑 📄 🛒 🧾 ⚙️).
- **Input dock** fixed at the bottom of the main column: a rounded 56 px bar with a mode switcher on the left (`Aa` · 🎙 · 🙂 · 🤟) and the active input on the right.
- Right side: nothing by default. Receipts open as a **slide-over panel** (400 px) from the right.

### 4.4 Components (build these once, reuse everywhere)
- `Block` — Notion-like block with hover handle; used for messages and doc content.
- `Callout` — emoji + soft background (`--surface`, `--warning-soft`, `--success-soft`).
- `Toggle` — Notion toggle list (▸) used in Receipts to expand evidence.
- `PropertyRow` — key/value row like Notion database properties (used in fit-check results and profile).
- `Table` — minimal table, 1 px `--border` lines, no zebra stripes.
- `Tile` — big selectable square for head/sign mode (min 88×88, radius 16, `--surface`, selected = `--accent-soft` + 2 px `--accent` ring).
- `DwellRing` — circular progress around the head cursor.
- `Chip` — tiny pill for input-mode badges (`🙂 head`, `🎙 voice`, `Aa text`, `🤟 sign`) and `source: mock/live`.
- `ConfirmBar` — "Do this?" with ✓ / ✕ tiles, always the same position (bottom centre).
- Icons: `lucide-react`, 18 px, stroke 1.75, colour `--text-muted`.

### 4.5 Motion
- Framer Motion. Durations 150–250 ms, easing `[0.2, 0.8, 0.2, 1]`.
- Messages fade + rise 6 px. Panels slide 16 px. Nothing bounces except Milo.

### 4.6 Accessibility checklist
- WCAG AA contrast at minimum. Visible focus ring: 2 px `--accent`, offset 2 px.
- Every interactive element is reachable by Tab, has an `aria-label`, and works with Enter/Space.
- An `aria-live="polite"` region announces agent replies and Milo state changes ("Milo is listening").
- Respect `prefers-reduced-motion`.
- Settings: text size, dwell time, head sensitivity, voice rate, voice output on/off, high contrast.

---

## 5. Milo — the mascot

### 5.1 Look
- An original character: a **soft rounded square blob** drawn as an SVG on a **12×12 pixel grid** (a cute 8-bit / pixel look), filled `--milo` with a 1-pixel `--milo-shade` bottom edge.
- Two dot eyes (2×2 px squares, `--milo-ink`), a tiny 1-px mouth, two little pixel feet.
- Default size 48 px in the header of Home; 96 px in onboarding and in empty states; 28 px next to every agent message.
- Build it as `components/milo/Milo.tsx` taking `state` and `size` props. Pure SVG + Framer Motion. **No external image assets.**

### 5.2 States and triggers

| State | Trigger | Animation |
|---|---|---|
| `idle` | nothing happening | breathing scale 1 → 1.03 (3 s loop), blink every 4–6 s (eyes → 1 px line, 120 ms) |
| `listening` | mic open / camera tracking active / waiting for letters | eyes wide (3×3), two pixel "sound wave" arcs pulse on each side |
| `thinking` | intent engine or tool running | eyes look up-right, three pixel dots appear above in sequence |
| `happy` | user answers a question / picks a suggestion / confirms | **jump**: y 0 → −14 → 0 with squash (scaleY .9 on landing), 400 ms; a 3-pixel sparkle |
| `speaking` | TTS playing | mouth toggles open/closed on `SpeechSynthesisUtterance.onboundary` word events |
| `confused` | low-confidence prediction (< 0.5) or "None of these" chosen | tilt 8°, a pixel "?" above |
| `celebrate` | appeal filed / order placed / caregiver approved | double jump + 12 tiny pixel confetti squares in accent/milo colours, 900 ms |
| `waiting` | ConfirmBar visible | eyes look down toward the confirm bar |
| `sleep` | camera off / app idle > 2 min | eyes closed, small "z" |

- `useMilo()` hook (Zustand store) so any component can call `milo.react('happy')`; transient states return to the base state after the animation.
- Under `prefers-reduced-motion`: swap animations for expression changes only.

### 5.3 Milo's voice / copy style
Short, warm, plain language, no exclamation spam. Examples:
- "I'm listening."
- "Got it — 'I want water'. Should I say it out loud?"
- "This chair is 1.5 inches too wide for your bathroom door."
- "Appeal filed. I'll remind you if Acme doesn't answer in 30 days."

---

## 6. Screens

### 6.1 Onboarding (`/welcome`) — 4 steps, one per page
1. **Hello** — Milo (96 px) waves. "Hi, I'm Milo. I'm here to help you get things done, any way you like to talk."
2. **How do you want to talk to me?** — four large cards (2×2), multi-select: `Aa Type`, `🎙 Speak`, `🙂 Move my head`, `🤟 Sign (beta)`. Each card is a Tile and is selectable by keyboard, voice ("speak", "head"), or head dwell once the camera is on.
3. **About you** (prefilled with Maria in demo mode) — PropertyRows: name, seat width range, hip width, narrowest doorway, transfer height range, hallway turning space, "can self-propel a manual chair for…", insurer, caregiver. Each with a small "Why we ask" toggle.
4. **Calibrate** (only if head selected) — see §7.3.

### 6.2 Home (`/`)
- Header: Milo (48 px) + greeting "Good morning, Maria" + date in `--text-muted`.
- **Nudges** (max 2 Callouts): e.g. "📄 Your appeal deadline is in 52 days" and "🪑 2 chairs fit your home."
- **Conversation** as Blocks: user messages right-aligned in `--surface` with an input-mode Chip; agent messages left-aligned with the 28 px Milo.
- **Input dock** at the bottom (§7).
- **Quick actions** row above the dock (only when the conversation is empty): "Check a chair fits", "Where's my appeal?", "Say something for me", "Shop".

### 6.3 Head mode overlay (`HeadBoard`)
Full-width sheet that rises over the bottom 60% of the screen when head mode is active:
- **Composer line** at top: shows chosen letters as large chips, e.g. `W  W  A`, plus a faint hint "first letter of each word".
- **Letter grid**: 6 columns × 5 rows of Tiles (A–Z + `␣ next word`, `⌫`, `✓ done`, `✕ close`). Alphabetical order, so it stays predictable.
- After **every** letter, suggestions refresh live in a row of **4 large suggestion tiles** above the grid, plus a 5th tile **"None of these"**.
- Head cursor: a 20 px circle with a DwellRing; the hovered tile gets the accent ring.
- Gestures: **dwell** (default 800 ms) = select; **nod** = select immediately; **head shake** = "not this" / back.

### 6.4 Suggestions → Confirm
Choosing a suggestion shows the ConfirmBar:
- For `say` intents: "Say 'I want water' out loud?" → ✓ speaks it via TTS at a larger volume, Milo `speaking`.
- For `task` intents: "Check whether the Glide P2 fits your home?" → ✓ runs the tool.

### 6.5 Fit Check (`/fit`)
- Title "🪑 Fit Check", subtitle "Checked against your measurements."
- **Table** of all catalogue chairs: Name · Fits? (✅/❌ chip) · Why (one line) · Price.
- Click a row → **detail page** like a Notion database item: PropertyRows of specs, then a "Checks" list where each rule shows ✅/❌ and the exact numbers ("Overall width 24.5″ + 2″ clearance = 26.5″ ≤ bathroom door 28″ ✅").
- Button: "Use this chair for my appeal".

### 6.6 Coverage & Appeal (`/appeal`)
Laid out like a Notion document:
- Callout with the denial summary (from the ingested denial letter): reason, date, appeal deadline.
- **Coverage check** section: what the policy says (quoted clause from the mock policy), what's needed (prior authorisation, clinician statement, home assessment), estimated member cost.
- **Appeal packet** (generated document): title in Newsreader serif, then sections (§9.3). A version badge `v1`, `v2`…
- **Reviewer simulation** block (Firedrill): "🧑‍⚖️ Strict reviewer says…" listing objections; "Fix with Milo" button produces v2; show a simple diff (removed lines red-soft, added lines green-soft).
- **Verify & file** button → Persona verification → ConfirmBar → "Filed (sandbox)". Milo `celebrate`.
- Export: "Download PDF" (print stylesheet) and "Copy text".

### 6.7 Shop (`/shop`) — accessible checkout
- A built-in mock store "**MobilityMart (demo store)**" with the catalogue.
- The agent does the whole checkout: selects the fitted chair, applies "pending insurance approval" or estimated coverage, fills shipping from the profile, shows the total.
- Before paying: **read the receipt aloud**, then Persona verification + caregiver approval if over $500, then ConfirmBar. Order placed (mock). Milo `celebrate`.

### 6.8 Receipts (`/receipts` + slide-over panel)
- Notion-like timeline grouped by day. Each entry is a Toggle:
  `11:42  🙂 head  "W W A" → "Where's my wheelchair appeal?"  (0.91)  ✓ confirmed`
- Expanded: interpretation, alternatives shown, tool called, inputs, outputs, **evidence** list (label · value · source), model used + latency, `source: live/mock` chip.
- Buttons: "Read aloud", "Export JSON".

### 6.9 Settings (`/settings`)
Input modes on/off, dwell time (500–1500 ms), head sensitivity, invert X/Y, recalibrate, voice rate, voice output toggle, text size, reduced motion, caregiver contact, demo mode toggle, API status list (each sponsor: live/mock dot).

---

## 7. Input modes — detailed spec

All modes produce an `InputEvent` (§10) and send it to the intent engine. Mode switcher: `Aa` · 🎙 · 🙂 · 🤟 in the dock; keyboard shortcuts `Alt+1..4`; voice command "switch to head mode".

### 7.1 Text (P0)
- Single-line input that grows to 4 lines. Enter = send, Shift+Enter = newline.
- **Partial text is allowed**: if the input is ≤ 4 characters or all caps letters with spaces (e.g. `W W A`), treat it as letters and run prediction (same as head mode). Great for keyboard users with limited dexterity.

### 7.2 Voice (P0)
- STT: **Web Speech API** (`webkitSpeechRecognition`, Chrome), `interimResults: true`, `lang: en-US`. Interim text shows greyed in the dock; final text is sent.
- Controls: big mic button; **hold Space** to talk (push-to-talk) when focus isn't in a text field; or tap once to toggle.
- TTS: `speechSynthesis`, choose a natural English voice if available, rate from settings (default 1.0). Milo `speaking` while it plays.
- **Voice confirmation**: when the ConfirmBar is open, listen for yes/no/confirm/cancel/stop and map them.
- Read-back: in voice mode, every agent reply is spoken; long replies are spoken as a 1-sentence summary + "Want the details?"
- Optional upgrade (P2): Whisper or a sponsor STT if latency allows.

### 7.3 Head mode (P0 — the wow feature)

**Tracking**
- `@mediapipe/tasks-vision` **FaceLandmarker**, `runningMode: "VIDEO"`, `numFaces: 1`, `outputFacialTransformationMatrixes: true`, GPU delegate with CPU fallback. Load the WASM + model from the official CDN/storage URLs given in the MediaPipe docs.
- Run in a `requestAnimationFrame` loop on a hidden `<video>` (640×480). Show a small 120×90 mirrored self-view in the top-right corner with a face outline (it builds trust and helps the demo video).
- **Head pose**: derive yaw and pitch from the facial transformation matrix. Fallback if unavailable: landmark ratios —
  - yaw ≈ `(nose.x − L.x) / (R.x − L.x)` using nose tip `1`, cheek points `234` and `454`
  - pitch ≈ `(nose.y − top.y) / (chin.y − top.y)` using `10` (forehead) and `152` (chin)
- **Smoothing**: One Euro filter (`minCutoff 1.0`, `beta 0.01`) on x and y. Simpler fallback: EMA α = 0.3.

**Calibration (onboarding step 4 and Settings)**
1. "Look at Milo in the middle and hold still" → 1.5 s → neutral yaw/pitch.
2. "Now turn gently to look at each corner" → Milo hops to 4 corners in turn (1.2 s each) → records the range → computes gain so a comfortable head turn covers the whole board.
3. "Try it: choose the star ⭐" → test target. If missed twice, reduce sensitivity automatically.
- Store calibration in `localStorage` (wrapped in try/catch).

**Cursor + selection**
- `cursorX = cx − (yaw − yaw0) · gainX` (sign flips with the "invert X" setting), `cursorY = cy + (pitch − pitch0) · gainY`.
- Hit-test with `document.elementFromPoint` against elements with `data-head-target`. The cursor itself has `pointer-events: none`.
- **Dwell**: the same target for `dwellMs` (default 800) → select. DwellRing fills while dwelling. 400 ms cooldown after any selection.
- **Nod** = quick select: pitch down by more than θ then back within 600 ms.
- **Shake** = "not this"/back: yaw crosses ±θ twice within 800 ms.
- If no face is detected for 2 s: dim the board, Milo `sleep`, aria-live "I can't see you — move into the camera view."

**First-letter prediction**
- The user picks the **first letter of each word** (acronym style); `␣` separates words when they want to spell a word's first two letters. Examples: `I W W` → "I want water"; `W W A` → "Where's my wheelchair appeal?"; `C T C F` → "Check the Comet fits".
- Also support **prefix style** (letters spell the start of one word: `W A T` → "water").
- After every letter, call `POST /api/predict` (§13) → returns 4 suggestions. Debounce 150 ms. Show cached/local suggestions instantly and replace them when the model returns (target < 700 ms).
- Each suggestion has a `kind` (`say` | `task`) and a `confidence`; tasks show a tiny tool emoji (🪑 📄 🛒).
- **Learning**: the chosen phrase is saved to memory (Cognee) with a timestamp; frequency + time-of-day boost future predictions.
- Show the saving: under the composer, a faint line "3 moves · saved 17 letters" (computed for real from the letter count vs the phrase length).

### 7.4 Sign (P2 — build last, label "beta")
- `@mediapipe/tasks-vision` **HandLandmarker**, 1 hand, VIDEO mode.
- **Features**: 21 landmarks → subtract the wrist (0) → divide by the wrist→middle-MCP (9) distance → flatten x,y,z = 63 floats. Mirror left hands to right.
- **Classifier**: in-browser k-NN (k = 5, Euclidean), trained live from a **"Teach Milo a sign"** screen: pick a label, hold the sign, record 40 frames. Ship a default sample set recorded by the team and saved as `public/signs/default.json`.
- **Vocabulary for the demo**: static fingerspelling letters (exclude J and Z, which need motion) plus 5 signs: **YES, NO, HELP, STOP, MORE** (use static approximations and say so in the UI).
- **Stability**: the same label for 12 consecutive frames with mean distance under a threshold → emit; 800 ms cooldown.
- Letters go into the **same composer and prediction pipeline** as head mode. YES/NO map to confirm/cancel; HELP triggers the "Say for me: I need help" ConfirmBar; STOP cancels any running action.
- UI copy must be honest: *"Sign input (beta): fingerspelling and a few signs. Not a full ASL translator."*

---

## 8. Intent engine

### 8.1 Pipeline
```
InputEvent → normalise → (partial? → predict → user picks) → route → confirm → tool → respond → log Receipt → Milo reacts → (TTS)
```
1. **Normalise**: text/voice → full utterance; head/sign/short text → letters (`partial: true`).
2. **Predict** (partials only): `/api/predict` → 4 suggestions → the user picks one → it becomes a full utterance with `interpretation_confidence` = that suggestion's confidence.
3. **Route**: `/api/route` → `{ kind: "say" | "task" | "chat", tool?, args?, confirm_text }`.
4. **Confirm**: ConfirmBar in any mode. Skip only for read-only tools (fit_check, status lookups).
5. **Tool**: run (§9).
6. **Respond**: a short reply (≤ 2 sentences) + an optional link to the result page.
7. **Receipt**: always.

### 8.2 Model routing (Arcee — "Pareto frontier")
- **Fast/small model** → prediction + routing (latency-critical).
- **Large model** → appeal drafting, reviewer simulation, revisions.
- Model IDs come from env vars (`ARCEE_SMALL_MODEL`, `ARCEE_LARGE_MODEL`); look up the current IDs in the Arcee docs. If Arcee is unavailable, use any OpenAI-compatible endpoint from `LLM_BASE_URL` / `LLM_API_KEY`.
- Log `model`, `latency_ms` and `tokens` per call into the receipt, and show a small "⚡ small model · 240 ms" chip in Receipts. This is the evidence for the Arcee prize.

### 8.3 Prompt — prediction (small model, JSON mode)
```
SYSTEM:
You help a person with limited movement communicate. They select letters with head
movements. Letters are usually the FIRST LETTER OF EACH WORD of what they want to say
(acronym style); sometimes they spell the start of a single word (prefix style).
Return exactly 4 different suggestions, ranked by likelihood, as JSON:
{"suggestions":[{"text": "...", "kind": "say|task", "tool": "fit_check|coverage|appeal|shop|status|none", "confidence": 0-1}]}
- Prefer first-person, short, natural phrases (≤ 8 words).
- "say" = something to speak aloud to people nearby. "task" = something Milo should do.
- Use the context: time of day, recent conversation, open tasks, frequent phrases.
- Never invent medical facts.

USER:
letters: "W W A"
time: "Friday 09:12"
recent_turns: [...last 5...]
open_tasks: ["appeal: power wheelchair, denied, deadline 2027-01-12"]
frequent_phrases: [{"text":"I want water","count":14,"usual_time":"morning"}, ...]
```

### 8.4 Prompt — router (small model, JSON mode)
```
Classify the user's utterance for Milo.
Tools: fit_check(item?), coverage(), appeal(action: draft|review|revise|file), shop(item?, action: cart|checkout),
caregiver(action: request_approval), status(topic), speak(text).
Return {"kind":"say|task|chat","tool":"...","args":{...},"confirm_text":"<short question to confirm>"}.
If the utterance is addressed to people nearby ("I'm cold", "thank you"), kind="say", tool="speak".
```

### 8.5 Local fallback (no LLM available)
- **Prediction**: score the phrase bank (§11.6) — acronym match on word initials (score 1.0), prefix match on the first word (0.7), then frequency + time-of-day boost. Return the top 4.
- **Routing**: keyword rules (`fit|fits|door|chair` → fit_check; `appeal|denied|insurance` → appeal/coverage; `buy|order|shop|cart` → shop; `where|status|when` → status; otherwise → speak).
- Mark these receipts `source: local`.

---

## 9. Tools

All tools live in `api/tools/*.py`, are pure functions over the state + adapters, and return `{ result, evidence[], summary }`.

### 9.1 `fit_check(item_id?: str)`
Rules (inputs from the profile and home measurements, §11.1):

| Rule | Pass condition |
|---|---|
| Doorway | `overall_width_in + 2.0 ≤ narrowest_doorway_in` (2″ hand clearance) |
| Seat width | `hip_width_in + 1 ≤ seat_width_in ≤ hip_width_in + 3` |
| Transfer height | `transfer_min ≤ seat_to_floor_in ≤ transfer_max` |
| Turning | `turning_radius_in ≤ hallway_turn_space_in` |
| Propulsion | if `can_self_propel_ft < 50` → requires `power == true` |

- Output per item: `fits: bool`, `checks: [{rule, pass, detail, numbers}]`, `score` (number of passes), `one_liner`.
- With the §11 data, exactly **Glide P2** and **Comet Mid-Wheel** pass everything, and the insurer's default **Basic Standard Manual** fails seat width and propulsion. This is intentional; it drives the appeal story.
- Ranking: all-pass first, then price ascending. Optionally rerank with Superlinked (§12).

### 9.2 `coverage()`
- Reads the policy (Senso context / mock file) and the denial letter (Airbyte / mock inbox).
- Extracts: denied item, reason, denial date, appeal window (60 days in the mock), requirements (prior authorisation, face-to-face exam note, home assessment, clinician statement), estimated member cost share (20% in the mock).
- Every extracted fact is evidence with `source: "policy §4.2"` or `source: "denial letter, para 2"`.

### 9.3 `appeal(action)`
- `draft` → generates the packet from the fit-check + coverage evidence (large model, with a template fallback):
  1. Member + claim summary
  2. What was denied and why (quoting the denial)
  3. Functional needs (measurements, self-propulsion limit) — no diagnoses
  4. **Why the covered alternative fails** — a table from fit_check for "Basic Standard Manual"
  5. **Why the requested device fits** — a table for the chosen chair
  6. Home accessibility evidence (doorway, hallway)
  7. Policy criteria met (each requirement mapped to evidence, or ✗ "still needed")
  8. Clinician statement — placeholder block "To be completed and signed by treating clinician"
  9. Attachments checklist
  10. Footer: "DRAFT prepared with Milo — for clinician review and signature."
- `review` → **Firedrill** strict-reviewer simulation (or a large-model role-play fallback) → `objections[]` (each: claim, why weak, what evidence would fix it).
- `revise` → applies the fixes → `v2`, stores the diff.
- `file` → requires Persona verification + ConfirmBar → mock submission → returns a confirmation number `ACME-APL-XXXXXX` (labelled sandbox) → creates a deadline in the tracker (decision expected in 30 days).

### 9.4 `shop(item_id, action)`
- `cart` → adds to the MobilityMart mock cart, shows price, estimated coverage ("80% if the appeal is approved"), member cost.
- `checkout` → fills shipping from the profile → **reads the summary aloud** → if total > $500 → `caregiver(request_approval)` → Persona → ConfirmBar → order ID (mock).

### 9.5 `caregiver(action: request_approval)`
- Mock: shows "Sent to Alex" with a pending state; a second browser tab at `/caregiver/[token]` shows a minimal approve/decline page (great for the video: approve on a phone). Approval updates the state via polling or SSE.

### 9.6 `status(topic)`
- Reads the case tracker (SingleStore) → "Your appeal was filed Nov 20. Acme should decide by Dec 20. Nothing needed from you right now."

### 9.7 `speak(text)`
- TTS at volume 1.0, slightly slower rate; shows the phrase in very large type (64 px) on screen for people nearby (useful in noisy rooms). Milo `speaking`.

---

## 10. Data models (TypeScript; mirror them as Pydantic in the API)

```ts
type InputMode = "text" | "voice" | "head" | "sign";

interface InputEvent {
  id: string; ts: string; mode: InputMode;
  raw: string;              // "W W A" or full utterance
  partial: boolean;         // letters only?
  meta?: { dwellMs?: number; moves?: number; signConfidence?: number };
}

interface Suggestion { text: string; kind: "say" | "task"; tool?: ToolName; confidence: number; }

type ToolName = "fit_check" | "coverage" | "appeal" | "shop" | "caregiver" | "status" | "speak";

interface Evidence { label: string; value: string; source: string; sourceType: "profile" | "catalog" | "policy" | "denial" | "model" | "user"; live: boolean; }

interface Receipt {
  id: string; ts: string;
  input: InputEvent;
  interpretedAs?: string;
  alternatives?: Suggestion[];
  confidence?: number;
  confirmed: boolean | null;
  confirmMode?: InputMode;
  tool?: ToolName; toolArgs?: Record<string, unknown>;
  result?: unknown;
  evidence: Evidence[];
  model?: { name: string; latencyMs: number; tokens?: number };
  sponsorCalls: { sponsor: string; op: string; live: boolean; latencyMs: number }[];
}

interface Profile {
  name: string; city: string;
  hipWidthIn: number; seatWidthRangeIn: [number, number];
  transferHeightRangeIn: [number, number];
  canSelfPropelFt: number;
  home: { narrowestDoorwayIn: number; narrowestDoorwayName: string; hallwayTurnSpaceIn: number };
  insurer: string; memberId: string;
  caregiver: { name: string; relation: string; approvalOverUsd: number };
  inputModes: InputMode[];
}

interface Chair {
  id: string; name: string; type: "manual" | "power";
  overallWidthIn: number; seatWidthIn: number; seatToFloorIn: number;
  turningRadiusIn: number | null; priceUsd: number; insurerDefault?: boolean; emoji: string;
}

interface Case {
  id: string; item: string; status: "denied" | "appeal_draft" | "appeal_filed" | "approved" | "closed";
  deniedOn: string; appealDeadline: string; filedOn?: string; decisionDue?: string; confirmation?: string;
}
```

---

## 11. Mock data (fictional — commit to `/data`)

### 11.1 `profile.json`
```json
{
  "name": "Maria Alvarez", "city": "Oakland, CA",
  "hipWidthIn": 17, "seatWidthRangeIn": [18, 20],
  "transferHeightRangeIn": [19, 21],
  "canSelfPropelFt": 20,
  "home": { "narrowestDoorwayIn": 28, "narrowestDoorwayName": "bathroom door", "hallwayTurnSpaceIn": 24 },
  "insurer": "Acme Health Plan (fictional)", "memberId": "ACM-000-DEMO",
  "caregiver": { "name": "Alex", "relation": "brother", "approvalOverUsd": 500 },
  "inputModes": ["head", "voice", "text"]
}
```

### 11.2 `catalog.json` (designed so exactly 2 chairs pass)
```json
[
  {"id":"basic-manual","name":"Basic Standard Manual","type":"manual","overallWidthIn":25,"seatWidthIn":16,"seatToFloorIn":19.5,"turningRadiusIn":null,"priceUsd":289,"insurerDefault":true,"emoji":"🦽"},
  {"id":"aero-m1","name":"Aero M1 Lightweight","type":"manual","overallWidthIn":24,"seatWidthIn":18,"seatToFloorIn":20,"turningRadiusIn":null,"priceUsd":1450,"emoji":"🦽"},
  {"id":"glide-p2","name":"Glide P2 Mid-Wheel","type":"power","overallWidthIn":24.5,"seatWidthIn":18,"seatToFloorIn":20,"turningRadiusIn":20,"priceUsd":3890,"emoji":"🪑"},
  {"id":"nimbus-p3","name":"Nimbus Compact P3","type":"power","overallWidthIn":23.5,"seatWidthIn":17,"seatToFloorIn":20,"turningRadiusIn":19,"priceUsd":3200,"emoji":"🪑"},
  {"id":"terra-hd","name":"Terra HD Power","type":"power","overallWidthIn":27,"seatWidthIn":20,"seatToFloorIn":20.5,"turningRadiusIn":26,"priceUsd":5400,"emoji":"🪑"},
  {"id":"urban-fold","name":"Urban Fold Power","type":"power","overallWidthIn":24,"seatWidthIn":19,"seatToFloorIn":22,"turningRadiusIn":22,"priceUsd":2750,"emoji":"🪑"},
  {"id":"comet-mw","name":"Comet Mid-Wheel","type":"power","overallWidthIn":25.5,"seatWidthIn":20,"seatToFloorIn":19,"turningRadiusIn":21,"priceUsd":4100,"emoji":"🪑"},
  {"id":"strider-rw","name":"Strider Rear-Wheel","type":"power","overallWidthIn":25,"seatWidthIn":19,"seatToFloorIn":20,"turningRadiusIn":29,"priceUsd":3650,"emoji":"🪑"}
]
```
Expected results: Basic ❌ (seat width, propulsion) · Aero ❌ (propulsion) · **Glide ✅** · Nimbus ❌ (seat 17) · Terra ❌ (door 29 > 28; turning) · Urban ❌ (transfer 22) · **Comet ✅** (25.5 + 2 = 27.5 ≤ 28) · Strider ❌ (turning 29 > 24). **Write a unit test asserting exactly this.**

### 11.3 `policy.md` — "Acme Health Plan (fictional) — Durable Medical Equipment, §4.2 Power Mobility Devices"
Write ~1 page of plain-English mock policy: power mobility is covered when (a) the member cannot functionally self-propel an optimally configured manual wheelchair for daily activities in the home, (b) the home allows the device to be used (doorways, turning space), (c) a face-to-face exam note and a clinician statement are submitted, (d) prior authorisation is obtained. Cost share 20% after the deductible. Appeals within 60 days of a denial notice; decision within 30 days of a complete appeal. Mark it **FICTIONAL — DEMO ONLY** at the top.

### 11.4 `inbox/denial_email.eml` (or `.md`)
From `noreply@acme-health.example`, dated **Nov 13, 2026**, subject "Coverage decision: power wheelchair request". Body: request for a power wheelchair (Group 2, mid-wheel) **denied — "not medically necessary; member can use a standard manual wheelchair."** You may appeal within 60 days of this notice (→ deadline **Jan 12, 2027**). Mark it fictional.

### 11.5 `cases.json`
One case: `power wheelchair`, status `denied`, deniedOn `2026-11-13`, appealDeadline `2027-01-12`.

### 11.6 `phrases.json` (prediction fallback + memory seed)
Around 40 phrases with `kind`, `tool`, `count`, `usualTime`. Must include:
"I want water", "I want to watch TV", "I'm in pain", "I'm cold", "I'm tired", "Thank you", "Please wait", "I need help", "I need the bathroom", "Yes please", "No thank you", "Call Alex", "Where's my wheelchair appeal?" (task/status), "What did Acme say?" (task/coverage), "Check if the Glide fits" (task/fit_check), "Check the Comet fits" (task/fit_check), "Which chairs fit my home?" (task/fit_check), "Draft my appeal" (task/appeal), "File the appeal" (task/appeal), "Order the Glide P2" (task/shop), "Ask Alex to approve" (task/caregiver), "Turn on the lights", "Open the door", "I love you", "Good morning".

---

## 12. Sponsor integrations (adapters in `api/adapters/`)

Each adapter: `class XAdapter(Protocol)` + `XLive` + `XMock`, chosen by `os.getenv("X_API_KEY")` and `MOCK_ALL=1`. Each call records `{sponsor, op, live, latencyMs}` into the current receipt. Settings shows a live/mock dot per sponsor.

| Sponsor | What it does in Milo | Where in the flow | Interface | Prize to target |
|---|---|---|---|---|
| **Cognee** (open-source agent memory) | Long-term memory: profile, measurements, frequent phrases + time of day, case facts. Feeds prediction context. | predict, route, every tool | `remember(kind, text, meta)`, `recall(query, k) → list` | Best Use of Cognee |
| **Senso** (Context Layer, MCP) | Trusted source for chair specs + policy text; tools query it instead of trusting the LLM. | fit_check, coverage, appeal | `get_spec(item_id)`, `query_policy(question) → {answer, citation}` | Best Use of Senso (shopping agent with trusted context) |
| **Airbyte** (context for agents, 700+ sources) | Pulls the denial email (Gmail) + policy PDF (Drive) into the context. | coverage | `sync_inbox() → docs[]`, `get_doc(id)` | Airbyte prizes |
| **Arcee** (open-weight models) | Small model for prediction/routing, large for appeal/reviewer; logged per call. | §8.2 | `complete(model_tier, messages, json=True)` | Most Impressive Use of the Pareto Frontier |
| **Superlinked** (SIE, task-specific inference) | Ranks suggestions / matches chairs to the needs profile (multi-attribute). | predict rerank, fit ranking | `rank(query, items, weights) → items` | Best Personal Agent Harness / Best Technical Build with SIE |
| **SingleStore** (real-time data for agents) | Case tracker + receipts store + phrase vectors; deadline queries. | status, receipts, nudges | `upsert_case`, `list_receipts`, `due_soon(days)` | Best Use of SingleStoreDB |
| **Persona** (agent detection + verifying the human) | Verifies Maria (or Alex) before filing/paying; "✓ Verified human authorised this agent" badge on the packet and the order. | appeal.file, shop.checkout | `start_verification(user) → url/inquiry_id`, `status(id)` | Best Use of Persona |
| **Firedrill** (simulation for agents) | Strict insurance reviewer simulation + simulated users of each input mode for testing. | appeal.review; tests | `simulate_review(packet) → objections[]`, `simulate_user(mode, goal)` | Best Use of Firedrill |
| **Amplitude + Statsig** | Events: `input_mode_used`, `letters_entered`, `suggestion_rank_chosen`, `moves_per_sentence`, `time_to_intent_ms`, `tool_completed`. Statsig experiment `prediction_strategy` (A: context-aware, B: frequency-only) + gate `sign_mode_beta`. | frontend + API | `track(event, props)`, `get_experiment(name)` | Amplitude + Statsig Best Use |
| **Guild AI** (build/eval/deploy agents) | Run the agent eval suite (prediction accuracy, routing accuracy, fit-check correctness) + deployment if time allows. | CI / evals | `scripts/eval.py` | Most Interesting Use of Agents |
| **tokens&** | Connect the repo and run the connected checks (tests from §16) — first scored check each UTC day earns points. | repo | follow their integration guide | builder perks |

**Fallbacks:**
- Cognee → JSON file memory with keyword recall.
- Senso → `data/catalog.json` + `data/policy.md` with paragraph citations.
- Airbyte → `data/inbox/*`.
- Arcee → `LLM_BASE_URL`, then the local rules.
- Superlinked → local weighted scoring.
- SingleStore → SQLite.
- Persona → a mock modal labelled "Sandbox verification".
- Firedrill → large-model role-play with a fixed reviewer persona prompt.
- Amplitude/Statsig → console + an in-app "Impact" mini-panel.

### 12.1 Sponsor resource links + sign-up timing (do these in this order)

| When | Sponsor | Link | What to do |
|---|---|---|---|
| **Now (before P0.6)** | Arcee | https://docs.arcee.ai/ | Get an API key + current small/large model IDs → `.env` |
| **Now** | Superlinked SIE | https://superlinked.com/serverless · docs https://superlinked.com/docs · cookbook https://github.com/superlinked/cookbook | Sign up for SIE Serverless. SIE runs task recipes from one API (search, rerank, extract, classify, redact, chat, translate…). Use: **classify** for routing (§8.4), **rerank** for the 4 suggestions, **extract** for denial-letter facts, **redact** to strip personal details before any large-model call. Start from the closest cookbook recipe. Rahul from Superlinked has a booth outside: ask him which small models to use for classify/rerank. |
| **Now** | Cognee | Cloud sign-up https://platform.cognee.ai/sign-up · docs https://docs.cognee.ai/ · SDK https://github.com/topoteretes/cognee · cookbook https://docs.cognee.ai/cookbooks/personalized-email | Memory for phrases + profile (P1.4, but sign up now) |
| **By P1 (~2:30)** | Senso | docs https://docs.senso.ai/docs/overview · FAQ / MCP setup / example flow: https://docs.google.com/document/d/17tFdnTaLQAFhe1_k0k1Ve_kLov9HHO7pyenw0X8Pv04/edit | Load catalog + policy into the Context Layer |
| **By P1** | Firedrill | quickstart https://firedrill.run/hacker-docs · docs https://docs.firedrill.run/ | Strict-reviewer simulation |
| **By P1** | Persona | https://help.withpersona.com/ | Sandbox verification (ask their table for sandbox keys) |
| **By P1** | SingleStore | https://docs.singlestore.com/cloud/getting-started-with-singlestore-helios/ · Python https://docs.singlestore.com/cloud/developer-resources/connect-with-application-development-tools/connect-with-python/ · vectors https://docs.singlestore.com/cloud/developer-resources/functional-extensions/working-with-vector-data/ | Cases + receipts store |
| **By P1** | Airbyte | https://docs.airbyte.com/platform/context-layer | Inbox/Drive ingestion |
| **By P1.4** | Amplitude | sign up https://amplitude.com/get-started · docs https://amplitude.com/docs | Browser SDK; events from §12. Track **task steps and outcomes** — that's what their team asked for. |
| **By P1.4** | Statsig | sign up https://console.statsig.com/sign_up · docs https://docs.statsig.com/welcome | Make agent settings configurable: dynamic config for `dwellMs`, `predictionStrategy`, `suggestionCount`; gate `sign_mode_beta`. Prize: Best Use of Amplitude x Statsig — $1,000 / $500 gift cards. Their table helps with setup. |
| Optional | Guild AI | docs https://docs.guild.ai/ · Smith bot https://app.guild.ai/chat | Eval runs |
| Optional | tokens& | integration guide on the event page | Connect the repo; run checks daily |
| **At the venue** | AWS Builder Loft | QR codes posted in the venue/Discord | $25 AWS credits or a chance at an AWS Builder Jacket — scan with a phone, takes 1 minute |

No promo codes are published on the event page; credits come from signing up at the links above or the QR codes at the venue.

**Impact panel** (Settings → "Impact", and shown in the video): real session numbers only — "Average moves per sentence: 3.4 · Letters saved: 81% · Prediction top-1 accuracy: 72%". Never hard-code these.

---

## 13. API (FastAPI, port 8000)

| Method | Path | Body → Response |
|---|---|---|
| POST | `/api/predict` | `{letters, mode, context?}` → `{suggestions: Suggestion[], model, latencyMs, source}` |
| POST | `/api/route` | `{utterance, mode}` → `{kind, tool, args, confirm_text}` |
| POST | `/api/act` | `{tool, args, confirmed, input_event}` → `{summary, result, evidence, receipt_id}` |
| GET | `/api/receipts` | → `Receipt[]` |
| GET | `/api/receipts/{id}` | → `Receipt` |
| GET | `/api/profile` · PUT `/api/profile` | profile |
| GET | `/api/catalog` | chairs + fit results |
| GET | `/api/case` | current case + deadlines |
| POST | `/api/memory/phrase` | `{text}` → saves the chosen phrase |
| POST | `/api/verify/start` · GET `/api/verify/{id}` | Persona |
| POST | `/api/caregiver/request` · POST `/api/caregiver/{token}/decision` | approval |
| GET | `/api/events` (SSE) | pushes receipts + caregiver decisions to the UI |
| GET | `/api/health` | `{sponsors: {name: "live"|"mock"}}` |

CORS: allow `http://localhost:3000`.

---

## 14. Tech stack + repo structure

- **Web**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion + Zustand + lucide-react + `@mediapipe/tasks-vision`. Fonts via `next/font` (Inter, Newsreader).
- **API**: Python 3.11 + FastAPI + Pydantic v2 + httpx + uvicorn. (Python because Cognee and Airbyte are Python-first.)
- **Browser**: demo in **Chrome** (Web Speech API + MediaPipe GPU).

```
milo/
├─ WRITEUP.md            ← this file
├─ PROGRESS.md
├─ README.md             ← submission description (§18)
├─ .env.example
├─ data/                 ← §11 mock data
├─ web/
│  ├─ app/
│  │  ├─ layout.tsx  page.tsx (Home)
│  │  ├─ welcome/ fit/ fit/[id]/ appeal/ shop/ receipts/ settings/ caregiver/[token]/
│  ├─ components/
│  │  ├─ milo/Milo.tsx  milo/useMilo.ts
│  │  ├─ ui/ Block Callout Toggle PropertyRow Table Tile Chip ConfirmBar DwellRing Sidebar
│  │  ├─ input/ Dock.tsx TextInput.tsx VoiceInput.tsx HeadBoard.tsx SignInput.tsx Suggestions.tsx
│  │  ├─ receipts/ ReceiptItem.tsx ReceiptsPanel.tsx
│  ├─ lib/
│  │  ├─ head/ faceTracker.ts pose.ts oneEuro.ts gestures.ts calibration.ts
│  │  ├─ sign/ handTracker.ts features.ts knn.ts
│  │  ├─ speech/ stt.ts tts.ts
│  │  ├─ api.ts  store.ts  analytics.ts  demo.ts  phrasesLocal.ts
├─ api/
│  ├─ main.py  models.py  engine.py (predict/route)  state.py
│  ├─ tools/ fit_check.py coverage.py appeal.py shop.py caregiver.py status.py speak.py
│  ├─ adapters/ cognee.py senso.py airbyte.py arcee.py superlinked.py singlestore.py persona.py firedrill.py analytics.py
│  ├─ prompts/ predict.md route.md appeal_draft.md reviewer.md revise.md
│  └─ tests/ test_fit_check.py test_predict_local.py test_route_local.py
└─ scripts/ eval.py  seed.py
```

`.env.example`: `MOCK_ALL=0`, `LLM_BASE_URL`, `LLM_API_KEY`, `ARCEE_API_KEY`, `ARCEE_SMALL_MODEL`, `ARCEE_LARGE_MODEL`, `COGNEE_API_KEY`, `SENSO_API_KEY`, `AIRBYTE_*`, `SUPERLINKED_*`, `SINGLESTORE_URL`, `PERSONA_API_KEY`, `PERSONA_TEMPLATE_ID`, `FIREDRILL_API_KEY`, `AMPLITUDE_API_KEY`, `STATSIG_CLIENT_KEY`.

Run: `cd api && uvicorn main:app --reload` · `cd web && npm run dev`.

---

## 15. Build phases (time-boxed — it's ~12:00 now)

### P0 — must work (12:00 → 2:30)
- [ ] **P0.1 (20 min)** Scaffold both apps, design tokens, Inter, Sidebar, empty pages, `/api/health`, mock data loaded.
- [ ] **P0.2 (20 min)** Milo component with all states + `useMilo` store + a demo page to cycle states.
- [ ] **P0.3 (25 min)** Text input → `/api/route` (local fallback) → `/api/act` → reply blocks → Receipts panel.
- [ ] **P0.4 (25 min)** `fit_check` + unit test (§11.2 expectations) + Fit Check table and detail pages.
- [ ] **P0.5 (40 min)** **Head mode**: FaceLandmarker, pose, One Euro, calibration, cursor, dwell, HeadBoard, nod/shake.
- [ ] **P0.6 (20 min)** `/api/predict` with LLM + local fallback, suggestion tiles, ConfirmBar, `speak` tool with large-text display.
- [ ] **P0.7 (15 min)** Voice: STT, TTS, voice confirmation, Milo `speaking`.

### P1 — the story (2:30 → 3:40)
- [ ] **P1.1 (25 min)** Coverage + appeal draft page (template first, then the large model) with evidence citations.
- [ ] **P1.2 (15 min)** Reviewer simulation (Firedrill or fallback) → revise → v2 diff.
- [ ] **P1.3 (15 min)** Persona verify (live or sandbox mock) → file → confirmation → deadline → Milo celebrate.
- [ ] **P1.4 (15 min)** Wire sponsor adapters that have keys (Cognee memory for phrases first, then SingleStore, Senso, Airbyte), plus analytics events + Impact panel.

### Demo + submit (3:40 → 4:30)
- [ ] Demo mode (§17.1) — 10 min
- [ ] Record the video (§17.2) — 25 min
- [ ] README, push to GitHub, submit — 15 min

### P2 — only if ahead of schedule
- [ ] Shop + caregiver approval page
- [ ] **Sign input (beta)** — §7.4
- [ ] Statsig experiment, Guild eval run, tokens& checks
- [ ] Dark mode

**Cut order if behind:** dark mode → sign → shop/caregiver → Statsig → reviewer diff. **Never cut** head mode, prediction, fit check, appeal draft or Receipts.

---

## 16. Tests + evals (also used for the tokens& and Guild checks)
- `test_fit_check.py`: exact pass/fail per chair (§11.2).
- `test_predict_local.py`: `"I W W"` → top-1 "I want water"; `"W W A"` → top-1 "Where's my wheelchair appeal?"; `"C A"` → contains "Call Alex".
- `test_route_local.py`: "check if the glide fits" → fit_check; "I'm cold" → speak; "file the appeal" → appeal(file) with a confirmation required.
- `scripts/eval.py`: 30 letter sequences → measure top-1/top-4 prediction accuracy for the LLM vs local; print a table (use it in the video and README).

---

## 17. Demo mode + demo video

### 17.1 Demo mode (`?demo=1` or the Settings toggle)
- Resets the state to Maria's fresh profile, the denial in the inbox, the case `denied`, and 14 seeded phrase counts.
- Shows a tiny unobtrusive "Demo" chip in the sidebar.
- Optional **"Director" panel** (press `D`): buttons to jump to each scene's starting state so retakes are fast.
- It does **not** fake head tracking, voice or model outputs. Those happen live on camera. (Judges will ask; real is the whole point.)

### 17.2 Demo video — 2:30 to 3:00, required for submission
Recording setup: Chrome at 1440×900, clean profile, macOS **Screen Studio** or **OBS/QuickTime**; webcam bubble bottom-left (it shows the head movements happening for real); captions burned in (an accessibility product needs captions); calm lo-fi music at low volume.

| Time | Scene | On screen | Voiceover |
|---|---|---|---|
| 0:00–0:12 | Hook | White screen → Milo hops in → "Milo" | "Most AI agents assume you can type. Maria can't, not easily." |
| 0:12–0:25 | Onboarding | 4 mode cards; Maria picks Head + Voice; calibration with Milo hopping to the corners | "Milo lets you talk to it any way you can — text, voice, head movement, or sign." |
| 0:25–0:50 | **Head mode** ⭐ | Webcam bubble: Maria turns her head → `I` `W` `W` → "I want water" tile → nod → spoken aloud in big type, Milo jumps; "3 moves · saved 9 letters" | "She picks the first letter of each word. Milo predicts the rest from context. Three head movements, one full sentence — spoken for her." |
| 0:50–1:15 | Head → task | `W W A` → "Where's my wheelchair appeal?" → Milo: "Acme denied your power chair on Nov 13. You have until Jan 12 to appeal." | "It also knows her life — the denial email, her insurer's policy, her deadlines." |
| 1:15–1:40 | Voice + fit check | "Which chairs fit my home?" → Fit table: 2 ✅, 6 ❌ → open Terra HD: "27″ + 2″ clearance = 29″ > bathroom door 28″" | "Milo checks every chair against her real measurements and shows its working." |
| 1:40–2:10 | Appeal | Draft appeal appears as a clean doc; "Why the standard manual chair fails" table; the reviewer sim raises 2 objections → "Fix with Milo" → v2 | "The fit check becomes the evidence for her appeal. A simulated strict reviewer attacks it first, so it's stronger before it's sent." |
| 2:10–2:30 | Verify + file | Persona verify → ConfirmBar → nod ✓ → "Filed" → Milo celebrates with confetti | "A verified human approves every action. Nothing happens without her yes." |
| 2:30–2:45 | Receipts | Receipts panel: every step with mode chip, confidence, evidence, model, live sponsor chips | "And every decision has a receipt — what she meant, what Milo understood, and why it acted." |
| 2:45–3:00 | Close | Milo waves; tagline + sponsor logos row (only the ones actually used live) | "Milo. A personal agent for every body." |

If sign mode is ready, add a 10 s beat after 2:10: fingerspelling **Y-E-S** to confirm filing.

**Honesty rule for the video:** on-screen data is fictional and labelled "demo data". Don't show a sponsor logo unless that integration actually ran live.

---

## 18. Submission checklist (from the event page)
- [ ] Team of 2–4 registered (solo builders must join a team via the Discord before submitting)
- [ ] **GitHub repo** that the reviewers can access
- [ ] **Demo video** with a shareable link (YouTube unlisted or Loom)
- [ ] **Description** of what we built + the tools used → README sections: Problem · What Milo does · The 4 input modes · Tools · Sponsor tech used (live vs mock, honestly) · How to run · Demo data notice · Limitations (sign is beta; not medical/legal advice) · Team
- [ ] Team names + contact emails
- [ ] Optional: deployed URL (Vercel for web; Render/Fly for the API) + screenshot (Home with Milo + HeadBoard open)

---

## 19. Guardrails (put them in the UI and the README)
- "Milo helps with paperwork and everyday communication. It is not medical or legal advice. Appeal letters are drafts for your clinician to review and sign."
- No diagnoses stored; profiles hold functional measurements only.
- All demo data is fictional; no real insurer integration; filing and checkout are sandboxed.
- Confirmation is always required before filing, paying, or messaging someone.
- Camera frames never leave the browser (MediaPipe runs on-device); only letters/phrases are sent to the API. **Say this in the video.** It's a strong privacy point.

---

## 20. Definition of done
- [ ] From a fresh load in demo mode, a judge can: calibrate head mode in < 20 s → produce "I want water" with ≤ 4 head selections → hear it spoken.
- [ ] `W W A` gives a top-4 that contains the appeal-status question, which answers correctly from the case data.
- [ ] Fit Check shows exactly 2 passing chairs with numeric explanations.
- [ ] The appeal draft cites the profile, catalogue, policy and denial evidence; the reviewer sim → v2 works; filing requires verification + confirmation.
- [ ] Every action appears in Receipts with mode, confidence, evidence, model and live/mock.
- [ ] The whole flow works with **MOCK_ALL=1** and no internet except the CDN (for safety on stage).
- [ ] Lighthouse accessibility score ≥ 95 on Home.
- [ ] Video recorded, repo pushed, submission sent before 4:30 PM.