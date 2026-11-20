# Milo — demo film plan (v3, your storyline)

**Length** ~2:30 · 1920×1080 · 30 fps · light, warm background (Milo cream `#FBF7F0`, yellow Milo, terracotta accent)
**Tool** HyperFrames (HTML → video). 3D is built with Three.js inside HyperFrames: no Blender needed, and every frame renders identically.
**Voice** ElevenLabs "Sarah" (Milo's own voice), calm and warm. **Captions** are burned in on every line, because Deaf viewers are part of the audience.
**Music** soft, hopeful piano/pluck bed, ducked under the voice. **Sound** gentle UI ticks on every on-screen tap/selection (Milo's own earcons).

| # | Time | Scene | What you see | Voice (draft) |
|---|------|-------|--------------|---------------|
| 1 | 0:00–0:12 | **The question** | Kinetic type on cream: "AI is for everyone." The word *everyone* wobbles, then a soft "…is it?" | "AI is supposed to be for everyone. But is it, really?" |
| 2 | 0:12–0:24 | **Who it leaves out** | One number builds: **1.3 billion** people live with a disability (WHO). Small icons: can't type, can't speak, can't hear, can't click. | "Most apps assume you can type, click, talk and hear. One in six people can't do all of those." |
| 3 | 0:24–0:36 | **Meet Milo** | Milo hops in (the new mascot) with a squash landing and a "boop". Four input chips fly around Milo: Type, Speak, Head, Sign. | "Meet Milo. A personal agent you can use with your keyboard, your voice, your head, or your hands." |
| 4 | 0:36–0:50 | **It asks what you need** | Real app: onboarding needs screen → tailored plan. Camera pushes in on the chosen needs. | "First, Milo asks what's hard for you, and reshapes itself around you." |
| 5 | 0:50–1:05 | **A few letters is enough** | Real app: W · W · A → "When will my appeal be decided?" Letters pop in one by one. | "Spell just the first letters. Milo predicts the rest, and asks before it acts." |
| 6 | 1:05–1:25 | **It knows your chair** (3D) | 3D: a standard 18″ manual wheelchair (24.5″ wide) rolls to a 28″ doorway and fits; a 29″ power chair stops at the frame, which turns red. Labels show the real numbers. Then cut to the real "Chairs that fit" page. | "Milo knows your body, your chair and your home. It checks every chair against your narrowest door before you ever buy it." |
| 7 | 1:25–1:45 | **It fights the paperwork** | Real app: denial → appeal drafted → reviewed → filed. A Receipt card slides out with evidence chips. | "Denied by insurance? Milo drafts the appeal, cites your policy, and files it, with a receipt for every step." |
| 8 | 1:45–2:00 | **Safe shopping, with family** | Real app: shop refuses a chair that won't fit → caregiver Alex approves → order placed → Milo celebrates. | "It won't let you buy a chair that won't fit, and anything big goes to your caregiver first." |
| 9 | 2:00–2:15 | **It gets you there** (3D) | 3D city block from above, tilting down: the route avoids stairs and a high curb, takes a ramp and an elevator. The path glows and a dot rolls along it. Labels: "stairs, avoided", "curb ramp", "elevator". | "And when you go out, Milo plans a route your wheelchair can actually take." |
| 10 | 2:15–2:35 | **The real thing** | **Your screen recording**: your face on camera, steering with your nose across the letter grid, then signing. Picture-in-picture over a soft frame. | "This is Milo, live. No hands, no voice. Just a nose, and a nod." |
| 11 | 2:35–2:45 | **Close** | Milo waves; logo; line: "AI that's actually for everyone." Built-with strip (Claude, Qwen/SIE, ElevenLabs, Senso, Cognee, Airbyte, Amplitude, Statsig, Superlinked). | "Milo. AI that's actually for everyone." |

## Who does what
- **I build:** every scene, the 3D chair and route scenes, all the app clips (I record the app myself in a scripted browser), the voiceover, captions, music, sound and render.
- **You record:** only scene 10, because it needs a real face and real head and hand movement (shot list below).

## Your recording (scene 10): about 5 minutes of your time
Record the screen with **Cmd + Shift + 5 → Record Entire Screen**, browser full screen at `localhost:3000`, in good front light.
1. **Head (~30 s):** Home → **Head** → let the camera find you → steer with your nose to **W**, **W**, **A** → pick *"When will my appeal be decided?"* → **nod** for yes.
2. **Sign (~15 s):** **Sign** → sign a couple of letters or "yes" → Exit.
3. Save both to `Milo_agent/video/recordings/` (any names) and tell me.
The app already shows your camera with the nose dot and grid on screen, so one screen recording captures your face too.
