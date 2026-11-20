"use client";
import { create } from "zustand";
import type { Evidence, InputMode, ModelCall, Suggestion, ToolName } from "./types";

// ---------------------------------------------------------------------------
// Settings (persisted)
// ---------------------------------------------------------------------------

export interface Settings {
  inputModes: InputMode[];
  dwellMs: number;
  headSensitivity: number; // multiplier on calibrated gain
  invertX: boolean;
  invertY: boolean;
  voiceRate: number;
  voiceOutput: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: "system" | "on" | "off";
  caregiverContact: string;
  demoMode: boolean;
  onboarded: boolean;
  /** functional needs picked in onboarding (never diagnoses) */
  needs: string[];
  captions: boolean; // show what Milo says as on-screen captions
  visualAlerts: boolean; // flash instead of relying on sound
  simpleMode: boolean; // fewer options, plain words, one thing at a time
  scanning: boolean; // switch scanning: options light up in turn; any key/switch selects
  scanMs: number;
  hoverDwell: boolean; // pointer / eye-gaze hover selects after dwellMs
  readEverything: boolean; // speak replies in every mode, incl. typing
}

export const DEFAULT_SETTINGS: Settings = {
  inputModes: ["text", "voice", "head"],
  dwellMs: 800,
  headSensitivity: 1,
  invertX: false,
  invertY: false,
  voiceRate: 1,
  voiceOutput: true,
  largeText: false,
  highContrast: false,
  reducedMotion: "system",
  caregiverContact: "Alex (brother)",
  demoMode: false,
  onboarded: false,
  needs: [],
  captions: true,
  visualAlerts: false,
  simpleMode: false,
  scanning: false,
  scanMs: 1600,
  hoverDwell: false,
  readEverything: false,
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("milo.settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ---------------------------------------------------------------------------
// App store
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: "user" | "milo";
  text: string;
  mode?: InputMode;
  letters?: string;
  link?: string | null;
  linkLabel?: string;
  receiptId?: string;
  evidence?: Evidence[];
  pending?: boolean;
}

export interface PendingConfirm {
  question: string;
  tool: ToolName;
  args: Record<string, any>;
  kind: "say" | "task" | "chat";
  utterance: string;
  inputMode: InputMode;
  raw: string;
  partial: boolean;
  meta?: Record<string, any>;
  alternatives?: Suggestion[];
  confidence?: number;
  predictModel?: ModelCall | null;
  routeModel?: ModelCall | null;
}

interface AppState {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  hydrated: boolean;
  hydrate: () => void;

  mode: InputMode;
  setMode: (m: InputMode) => void;

  messages: Message[];
  addMessage: (m: Message) => void;
  updateMessage: (id: string, p: Partial<Message>) => void;
  clearMessages: () => void;

  // composer (head / sign / short text letters)
  letters: string[]; // each entry is a letter or "_" (word break)
  setLetters: (l: string[]) => void;
  suggestions: Suggestion[];
  suggestionsSource: "local" | "live" | null;
  predictModel: ModelCall | null;
  setSuggestions: (s: Suggestion[], source: "local" | "live", model?: ModelCall | null) => void;

  confirm: PendingConfirm | null;
  setConfirm: (c: PendingConfirm | null) => void;

  receiptsOpen: boolean;
  setReceiptsOpen: (b: boolean) => void;
  receiptsVersion: number;
  bumpReceipts: () => void;

  spoken: string | null; // large-type overlay for speak()
  setSpoken: (s: string | null) => void;

  interim: string; // voice interim text
  setInterim: (s: string) => void;

  verify: { id: string; purpose: string; resolve: (ok: boolean) => void } | null;
  setVerify: (v: AppState["verify"]) => void;

  headReady: boolean;
  setHeadReady: (b: boolean) => void;

  announcement: string;
  announce: (s: string) => void;

  lastSaving: { moves: number; saved: number; text: string } | null;

  caption: { text: string; who: "user" | "milo" } | null;
  setCaption: (c: { text: string; who: "user" | "milo" } | null) => void;

  dataVersion: number; // bump to make pages refetch (case/appeal changed)
  bumpData: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const s = loadSettings();
    set({ settings: s, hydrated: true, mode: s.inputModes.includes("text") ? "text" : s.inputModes[0] || "text" });
  },
  setSettings: (p) => {
    const s = { ...get().settings, ...p };
    try {
      localStorage.setItem("milo.settings", JSON.stringify(s));
    } catch {}
    set({ settings: s });
  },

  mode: "text",
  setMode: (m) => set({ mode: m }),

  messages: [],
  addMessage: (m) => set({ messages: [...get().messages, m] }),
  updateMessage: (id, p) => set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...p } : m)) }),
  clearMessages: () => set({ messages: [] }),

  letters: [],
  setLetters: (l) => set({ letters: l }),
  suggestions: [],
  suggestionsSource: null,
  predictModel: null,
  setSuggestions: (s, source, model = null) => set({ suggestions: s, suggestionsSource: source, predictModel: model }),

  confirm: null,
  setConfirm: (c) => set({ confirm: c }),

  receiptsOpen: false,
  setReceiptsOpen: (b) => set({ receiptsOpen: b }),
  receiptsVersion: 0,
  bumpReceipts: () => set({ receiptsVersion: get().receiptsVersion + 1 }),

  spoken: null,
  setSpoken: (s) => set({ spoken: s }),

  interim: "",
  setInterim: (s) => set({ interim: s }),

  verify: null,
  setVerify: (v) => set({ verify: v }),

  headReady: false,
  setHeadReady: (b) => set({ headReady: b }),

  announcement: "",
  announce: (s) => set({ announcement: s }),

  lastSaving: null,

  caption: null,
  setCaption: (c) => set({ caption: c }),

  dataVersion: 0,
  bumpData: () => set({ dataVersion: get().dataVersion + 1 }),
}));
