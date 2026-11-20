# Milo — progress

### P0 — must work
- [x] P0.1 Scaffold both apps, design tokens, Inter, Sidebar, empty pages, `/api/health`, mock data loaded
- [x] P0.2 Milo component with all states + `useMilo` store + demo page
- [x] P0.3 Text input → `/api/route` → `/api/act` → reply blocks → Receipts panel
- [x] P0.4 `fit_check` + unit test (§11.2) + Fit Check table and detail pages
- [~] P0.5 Head mode (built; needs live webcam test): FaceLandmarker, pose, One Euro, calibration, cursor, dwell, HeadBoard, nod/shake
- [x] P0.6 `/api/predict` (LLM + local fallback), suggestion tiles, ConfirmBar, `speak` with large text
- [~] P0.7 Voice (built; needs mic test): STT, TTS, voice confirmation, Milo `speaking`

### P1 — the story
- [x] P1.1 Coverage + appeal draft page with evidence citations
- [x] P1.2 Reviewer simulation → revise → v2 diff
- [x] P1.3 Persona verify (sandbox) → file → confirmation → deadline → Milo celebrate
- [~] P1.4 SIE + Claude + ElevenLabs live; analytics events + Impact panel ✅; Cognee/Senso/Airbyte/SingleStore/Persona live pending keys

### Demo + submit
- [x] Demo mode (§17.1) — `?demo=1`, Demo chip, Director panel (D)
- [ ] Record the video (§17.2)
- [ ] README, push to GitHub, submit

### P2
- [x] Shop + caregiver approval page
- [~] Sign input (beta) — built; needs team samples in public/signs/default.json
- [ ] Statsig experiment, Guild eval run, tokens& checks
- [ ] Dark mode
