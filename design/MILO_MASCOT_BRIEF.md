# Milo — mascot brief (for image generation)

Use this to generate Milo with an image model. Generate **one character**, then the **same character** in each state. Consistency matters more than any single image.

## Who Milo is

Milo is a small, gentle helper who lives inside the app. It helps people who can't easily type, click or speak, and it should feel **safe, patient and kind** — like a calm friend sitting beside you, never a cartoon mascot shouting at you. It is not a person, not an animal, not a robot.

- **Personality:** warm, quiet, attentive, a little playful. Celebrates *with* you, never *at* you.
- **Age feel:** timeless, soft — not babyish, not childish (adults with disabilities use this every day).
- **Never:** scary, sarcastic, sexy, medical (no stethoscope, no wheelchair *on* Milo), human-like hands, teeth, angry brows.

## Body

- A **soft, rounded square blob** (like a marshmallow or a mochi), slightly wider than tall, sitting on **two tiny stubby feet**.
- **Colour:** warm sunflower yellow `#FFD84D`, with a slightly deeper base `#F2C230` (a soft shadow at the bottom).
- **Face:** two **simple dark oval eyes** (`#2B2A26`), widely spaced; a **tiny, small mouth**; two **soft pink cheek blushes** (`#F7A9A0`, ~60% opacity).
- **No** arms needed (optional: two tiny nubs for waving/celebrating).
- Silhouette must read clearly at **28 px** (it appears next to every chat message) and at **120 px**.

## Style

Pick ONE and keep it for every state:

1. **Soft 3D clay** (recommended for "cuter"): matte clay / vinyl-toy look, gentle studio light from top-left, soft contact shadow, no harsh specular, no texture noise.
2. **Flat vector**: clean shapes, 2 tones max per area, no outlines or a very soft 2 px darker outline.
3. **Refined pixel art**: 32×32 grid, limited palette (the 5 colours above + white), crisp edges.

The app is warm cream (`#FBF7F1`) with white cards and a burnt-orange accent (`#C2410C`) — Milo must look good on cream and on white.

## States to generate (same Milo, same angle, same size, centred)

| File name | State | What changes |
|---|---|---|
| `idle.png` | Ready | Relaxed, eyes open, tiny smile |
| `listening.png` | Listening (mic/camera on) | Eyes a bit wider, slight lean forward, small sound-wave arcs on both sides (optional) |
| `thinking.png` | Working on it | Eyes looking up-right, mouth small "o" or flat, three small dots above (optional) |
| `happy.png` | You answered / picked something | Eyes closed as happy arcs (^ ^), open smile, slight bounce pose |
| `speaking.png` | Speaking (mouth closed frame) | Same as idle, mouth gently closed |
| `speakingOpen.png` | Speaking (mouth open frame) | Same as idle, mouth softly open (small rounded shape) — alternates with `speaking.png` |
| `confused.png` | Not sure / "none of these" | Head tilted ~8°, one eye slightly smaller, small "?" above (optional) |
| `celebrate.png` | Appeal filed / order placed | Big happy face, little nubs up (if used), a few small confetti squares in yellow, orange `#C2410C` and green `#15803D` |
| `waiting.png` | Waiting for your yes/no | Eyes looking down (toward the Yes/No buttons below), calm |
| `sleep.png` | Camera off / idle | Eyes closed (flat lines), small "z" above |

## Technical specs

- **Transparent PNG**, **1024 × 1024**, Milo centred, body filling ~70% of the width, same scale and position in every file (so swapping states doesn't make Milo jump).
- Front view, very slight 3/4 is OK — but the **same angle** in every state.
- No text, no background, no ground plane except an optional soft shadow.
- Keep effects (waves, dots, ?, z, confetti) **inside** the canvas.

## Prompt to start from (adapt to your model)

> A cute, gentle mascot character named Milo: a soft rounded-square blob, like a marshmallow, warm sunflower yellow (#FFD84D) with a slightly deeper yellow base, two tiny stubby feet, two simple dark oval eyes widely spaced, a tiny small smile, soft pink cheek blush. Soft 3D clay / vinyl toy style, matte, gentle studio light from the top-left, soft contact shadow. Friendly, calm and kind — for an accessibility app used by adults. Front view, centred, transparent background, no text. State: **[idle / listening with small sound-wave arcs / thinking, eyes looking up-right / happy, eyes closed as arcs, open smile / confused, head tilted, small question mark / celebrating with small yellow, orange and green confetti / waiting, eyes looking down / sleeping, eyes closed, small z]**.

Tip: generate `idle` first, then feed it back as the **reference image** ("same character as the reference") for every other state.

## Where the files go

Put the PNGs in `web/public/milo/` and list them in `web/components/milo/images.ts`, e.g.

```ts
export const MILO_IMAGES = {
  idle: "/milo/idle.png", listening: "/milo/listening.png", thinking: "/milo/thinking.png",
  happy: "/milo/happy.png", speaking: "/milo/speaking.png", speakingOpen: "/milo/speakingOpen.png",
  confused: "/milo/confused.png", celebrate: "/milo/celebrate.png", waiting: "/milo/waiting.png", sleep: "/milo/sleep.png",
};
```

Any state you skip falls back to `idle`; with no images at all, the built-in pixel Milo is used. Jumps, confetti and the listening/thinking effects still animate on top of the images.
