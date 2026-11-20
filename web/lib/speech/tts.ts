"use client";
import { milo, useMiloStore } from "@/components/milo/useMilo";
import { useApp } from "@/lib/store";

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const vs = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const pref = ["Samantha", "Google US English", "Ava", "Allison", "Karen", "Daniel", "Google UK English Female"];
  for (const p of pref) {
    const v = vs.find((x) => x.name.includes(p));
    if (v) return v;
  }
  return vs.find((v) => v.lang === "en-US") || vs[0] || null;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voice = pickVoice();
  };
}

export function ttsAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking() {
  if (!ttsAvailable()) return;
  window.speechSynthesis.cancel();
  milo.set("speaking", false);
  useMiloStore.getState().setMouth(false);
}

/** Speak text; Milo's mouth moves on word boundaries. Resolves when finished. */
export function speak(text: string, opts: { rate?: number; volume?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsAvailable() || !text) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice = voice || pickVoice();
    if (voice) u.voice = voice;
    u.lang = "en-US";
    u.rate = opts.rate ?? useApp.getState().settings.voiceRate ?? 1;
    u.volume = opts.volume ?? 1;
    const mouth = useMiloStore.getState().setMouth;
    let mouthTimer: ReturnType<typeof setTimeout> | null = null;
    // fallback mouth flapping for voices that don't emit boundary events
    let flap: ReturnType<typeof setInterval> | null = null;
    let gotBoundary = false;
    u.onstart = () => {
      milo.set("speaking", true);
      flap = setInterval(() => {
        if (!gotBoundary) mouth(!useMiloStore.getState().mouthOpen);
      }, 180);
    };
    u.onboundary = () => {
      gotBoundary = true;
      mouth(true);
      if (mouthTimer) clearTimeout(mouthTimer);
      mouthTimer = setTimeout(() => mouth(false), 140);
    };
    const done = () => {
      if (flap) clearInterval(flap);
      mouth(false);
      milo.set("speaking", false);
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
    // Chrome sometimes never fires onend for long text
    setTimeout(done, Math.min(30000, 1500 + text.length * 90));
  });
}
