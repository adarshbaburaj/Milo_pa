// Functional needs → what Milo turns on / off. Plain words, never diagnoses.
import type { Settings } from "./store";
import type { InputMode } from "./types";

export type NeedId = "hands" | "speech" | "deaf" | "vision" | "cognitive" | "motion" | "fatigue";

export const NEEDS: { id: NeedId; emoji: string; title: string; sub: string; say: RegExp }[] = [
  { id: "hands", emoji: "✋", title: "Using my hands is hard", sub: "Clicking, typing or touching", say: /\b(hand|hands|click|typing|touch)\b/ },
  { id: "speech", emoji: "💬", title: "Speaking is hard", sub: "Talking is tiring or not possible", say: /\b(speak|speaking|talk|talking|speech)\b/ },
  { id: "deaf", emoji: "🧏", title: "I’m Deaf or hard of hearing", sub: "Sound and voice don’t work well for me", say: /\b(deaf|hearing|hear)\b/ },
  { id: "vision", emoji: "👁️", title: "I’m blind or have low vision", sub: "Reading the screen is hard", say: /\b(blind|vision|see|seeing|sight)\b/ },
  { id: "cognitive", emoji: "🧩", title: "Reading or remembering is hard", sub: "I want fewer choices and plain words", say: /\b(read|reading|remember|memory|simple)\b/ },
  { id: "motion", emoji: "🌙", title: "Movement or flashing bothers me", sub: "Keep the screen calm", say: /\b(motion|flash|flashing|calm|dizzy)\b/ },
  { id: "fatigue", emoji: "🔋", title: "I get tired quickly", sub: "Fewer steps, slower timing", say: /\b(tired|tire|fatigue|energy)\b/ },
];

export type Plan = { settings: Partial<Settings>; modes: InputMode[]; on: string[]; off: string[] };

/** Build the setup for a set of needs. `on` / `off` are plain-language lines shown to the person. */
export function planFor(needs: string[]): Plan {
  const has = (n: NeedId) => needs.includes(n);
  const s: Partial<Settings> = { needs, captions: true };
  const modes = new Set<InputMode>(["text", "voice"]);
  const on: string[] = [];
  const off: string[] = [];

  if (has("hands")) {
    modes.add("head");
    modes.delete("text");
    Object.assign(s, { hoverDwell: true, scanning: true, dwellMs: 1000 });
    on.push("Head mode — point with your nose, hold still to choose", "Switch scanning — options light up; any key or switch picks", "Hover to choose — works with eye-gaze and trackballs");
    off.push("No double-clicks, dragging or small buttons");
  }
  if (has("speech")) {
    modes.delete("voice");
    on.push("Quick phrases and first-letter prediction — Milo speaks for you");
    off.push("Nothing needs your voice");
  }
  if (has("deaf")) {
    modes.delete("voice");
    modes.add("sign");
    Object.assign(s, { captions: true, visualAlerts: true, voiceOutput: false });
    on.push("Captions for everything", "Visual flashes instead of sounds", "Sign input (beta)", "“Listen to someone” — live captions of people talking to you");
    off.push("No sound-only alerts", "Milo won’t talk to you out loud (it still speaks for you to others)");
  }
  if (has("vision")) {
    modes.add("voice");
    Object.assign(s, { largeText: true, highContrast: true, voiceOutput: true, readEverything: true });
    on.push("Milo reads everything out loud", "Bigger text and stronger contrast", "Hold Space to talk");
    if (!has("deaf")) off.push("Nothing depends on seeing small details");
  }
  if (has("cognitive")) {
    Object.assign(s, { simpleMode: true, readEverything: !has("deaf") });
    on.push("Simple mode — one thing at a time, plain words");
    off.push("Fewer menus and choices");
  }
  if (has("motion")) {
    Object.assign(s, { reducedMotion: "on" });
    on.push("Calm screen — no bouncing or flashing");
    if (has("deaf")) s.visualAlerts = true; // gentle border glow only, no flash (see VisualAlert)
  }
  if (has("fatigue")) {
    Object.assign(s, { dwellMs: Math.max((s.dwellMs as number) || 800, 1200), scanMs: 2200, voiceRate: 0.9 });
    on.push("Slower timing — more time to choose");
  }
  if (!needs.length) on.push("Type or talk — you can change anything later in Settings");
  if (modes.size === 0) modes.add("text");
  s.inputModes = Array.from(modes);
  return { settings: s, modes: Array.from(modes), on, off };
}
