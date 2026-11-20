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

let lastEarcon = 0;
let bus: GainNode | null = null;
/** One soft master bus: a gentle low-pass takes the edge off every tone, so nothing ever sounds harsh. */
function out(c: AudioContext) {
  if (bus) return bus;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;
  lp.Q.value = 0.4;
  bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(lp).connect(c.destination);
  return bus;
}

function tone(freq: number, at: number, dur: number, vol: number, glideTo?: number, type: OscillatorType = "sine") {
  const c = ac();
  if (!c) return;
  lastEarcon = performance.now();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t = c.currentTime + at;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + Math.min(dur * 0.6, 0.25));
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03); // soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // long gentle fade
  o.connect(g).connect(out(c));
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

/**
 * Milo's own little voice for reactions — quiet, rounded, never startling.
 * Skipped if another earcon just played (e.g. the confirm chime), so sounds never pile up.
 */
export function miloSound(kind: "happy" | "celebrate" | "confused" | "wake" | "listen") {
  if (!soundsOn() || performance.now() - lastEarcon < 300) return;
  switch (kind) {
    case "happy": // a soft little "boop!" that rises
      tone(520, 0, 0.22, 0.045, 760);
      tone(780, 0.11, 0.3, 0.03);
      break;
    case "celebrate": // gentle sparkle: C–E–G–C, triangle for a music-box feel
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.085, 0.5, 0.032, undefined, "triangle"));
      break;
    case "confused": // a curious "hm?" that lifts at the end
      tone(330, 0, 0.18, 0.04, 300);
      tone(350, 0.16, 0.3, 0.04, 470);
      break;
    case "wake": // waking up: a slow soft yawn upward
      tone(392, 0, 0.5, 0.03, 523.25);
      break;
    case "listen": // ears open: one tiny warm blip
      tone(660, 0, 0.16, 0.025, 720);
      break;
  }
}
