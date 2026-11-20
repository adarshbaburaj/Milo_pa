"use client";
import { milo, useMiloStore } from "@/components/milo/useMilo";
import { useApp } from "@/lib/store";
import { API_URL } from "@/lib/api";

/** Who is talking: "user" = Milo speaking FOR the person (AAC), "milo" = Milo's own voice. */
export type Who = "user" | "milo";

let audio: HTMLAudioElement | null = null;
let elevenDown = false; // after a failure, skip ElevenLabs for a while

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
  if (audio) {
    audio.pause();
    audio = null;
  }
  if (!ttsAvailable()) return;
  window.speechSynthesis.cancel();
  milo.set("speaking", false);
  useMiloStore.getState().setMouth(false);
}

type SpeakOpts = { rate?: number; volume?: number; who?: Who };

/**
 * Human voice via ElevenLabs (streamed from our API). Resolves true once playback finished,
 * false if it never started — the caller then uses the browser voice.
 */
function speakEleven(text: string, opts: SpeakOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || elevenDown) return resolve(false);
    if (audio) audio.pause();
    if (ttsAvailable()) window.speechSynthesis.cancel();
    const a = new Audio(`${API_URL}/api/tts?who=${opts.who ?? "milo"}&text=${encodeURIComponent(text)}`);
    audio = a;
    a.volume = opts.volume ?? 1;
    a.playbackRate = opts.rate ?? useApp.getState().settings.voiceRate ?? 1;
    const mouth = useMiloStore.getState().setMouth;
    let started = false;
    let flap: ReturnType<typeof setInterval> | null = null;
    const finish = (ok: boolean) => {
      clearTimeout(startTimer);
      if (flap) clearInterval(flap);
      mouth(false);
      milo.set("speaking", false);
      if (audio === a) audio = null;
      resolve(ok);
    };
    const fail = () => {
      if (started) return finish(true); // played partly; don't repeat it in another voice
      elevenDown = true;
      setTimeout(() => (elevenDown = false), 60_000);
      a.pause();
      finish(false);
    };
    const startTimer = setTimeout(fail, 4000);
    a.onplaying = () => {
      if (started) return;
      started = true;
      clearTimeout(startTimer);
      milo.set("speaking", true);
      flap = setInterval(() => mouth(!useMiloStore.getState().mouthOpen), 160);
    };
    a.onended = () => finish(true);
    a.onpause = () => started && finish(true); // stopSpeaking()
    a.onerror = fail;
    a.play().catch(fail);
  });
}

/** Speak text in a human voice (ElevenLabs), falling back to the browser voice. Resolves when finished. */
export async function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  if (!text) return;
  const cap = { text, who: opts.who ?? "milo" } as const;
  useApp.getState().setCaption(cap);
  try {
    if (await speakEleven(text, opts)) return;
    return await speakBrowser(text, opts);
  } finally {
    setTimeout(() => {
      if (useApp.getState().caption === cap) useApp.getState().setCaption(null);
    }, 1200);
  }
}

/** Browser voice; Milo's mouth moves on word boundaries. Resolves when finished. */
function speakBrowser(text: string, opts: SpeakOpts = {}): Promise<void> {
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
