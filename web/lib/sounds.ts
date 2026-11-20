"use client";
// Soft, caring UI sounds made with WebAudio (no files): gentle sine tones, slow attack, long fade.
import { useApp } from "./store";

let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function soundsOn() {
  const s = useApp.getState().settings;
  return s.uiSounds !== false && !s.needs?.includes("deaf");
}

function tone(freq: number, at: number, dur: number, vol: number) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03); // soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // long gentle fade
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Chosen / confirmed: a warm rising major third. */
export function chime() {
  if (!soundsOn()) return;
  tone(523.25, 0, 0.45, 0.06); // C5
  tone(659.25, 0.09, 0.6, 0.05); // E5
}

/** Scanner moved to the next option: barely-there tick. */
export function tick() {
  if (!soundsOn()) return;
  tone(880, 0, 0.12, 0.015);
}

/** Back / cancelled: soft falling tone. */
export function soften() {
  if (!soundsOn()) return;
  tone(440, 0, 0.35, 0.04);
  tone(349.23, 0.08, 0.5, 0.035);
}

/** Milo has something new to say. */
export function notify() {
  if (!soundsOn()) return;
  tone(587.33, 0, 0.4, 0.04);
  tone(783.99, 0.12, 0.55, 0.035);
}
