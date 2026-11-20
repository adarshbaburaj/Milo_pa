"use client";
import { create } from "zustand";

export type MiloState =
  | "idle"
  | "listening"
  | "thinking"
  | "happy"
  | "speaking"
  | "confused"
  | "celebrate"
  | "waiting"
  | "sleep";

type Flag = "listening" | "thinking" | "speaking" | "waiting" | "sleep";

const TRANSIENT_MS: Partial<Record<MiloState, number>> = { happy: 700, confused: 1400, celebrate: 1500 };
const PRIORITY: Flag[] = ["speaking", "waiting", "thinking", "listening", "sleep"];

const LABEL: Record<MiloState, string> = {
  idle: "Milo is ready",
  listening: "Milo is listening",
  thinking: "Milo is thinking",
  happy: "Milo is happy",
  speaking: "Milo is speaking",
  confused: "Milo isn't sure",
  celebrate: "Milo is celebrating",
  waiting: "Milo is waiting for your answer",
  sleep: "Milo is resting",
};

interface MiloStore {
  flags: Record<Flag, boolean>;
  transient: MiloState | null;
  transientKey: number;
  mouthOpen: boolean;
  set: (f: Flag, on: boolean) => void;
  react: (s: MiloState) => void;
  setMouth: (open: boolean) => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useMiloStore = create<MiloStore>((set, get) => ({
  flags: { listening: false, thinking: false, speaking: false, waiting: false, sleep: false },
  transient: null,
  transientKey: 0,
  mouthOpen: false,
  set: (f, on) => {
    if (get().flags[f] === on) return;
    set({ flags: { ...get().flags, [f]: on } });
  },
  react: (s) => {
    const ms = TRANSIENT_MS[s];
    if (!ms) {
      // non-transient state requested directly → treat as a flag where possible
      if (s === "idle") set({ transient: null });
      else if ((PRIORITY as string[]).includes(s)) get().set(s as Flag, true);
      return;
    }
    if (timer) clearTimeout(timer);
    set({ transient: s, transientKey: get().transientKey + 1 });
    timer = setTimeout(() => set({ transient: null }), ms);
  },
  setMouth: (open) => set({ mouthOpen: open }),
}));

export function currentMiloState(s: Pick<MiloStore, "flags" | "transient">): MiloState {
  if (s.transient) return s.transient;
  for (const f of PRIORITY) if (s.flags[f]) return f;
  return "idle";
}

export function useMiloState(): MiloState {
  return useMiloStore((s) => currentMiloState(s));
}

export function miloLabel(s: MiloState) {
  return LABEL[s];
}

/** Imperative handle usable from anywhere: milo.react('happy') */
export const milo = {
  react: (s: MiloState) => useMiloStore.getState().react(s),
  set: (f: Flag, on: boolean) => useMiloStore.getState().set(f, on),
};

export function useMilo() {
  return milo;
}
