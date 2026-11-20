"use client";
// Web Speech API STT (Chrome). interimResults on, en-US.
type Handlers = { onInterim?: (t: string) => void; onFinal: (t: string) => void; onEnd?: () => void; onError?: (e: string) => void };

export function sttAvailable() {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export class STT {
  private rec: any = null;
  private active = false;
  constructor(private h: Handlers, private continuous = false) {}

  start() {
    if (!sttAvailable() || this.active) return;
    const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new R();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = this.continuous;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.h.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim) this.h.onInterim?.(interim);
    };
    rec.onerror = (e: any) => this.h.onError?.(e.error);
    rec.onend = () => {
      this.active = false;
      this.h.onEnd?.();
    };
    this.rec = rec;
    this.active = true;
    try {
      rec.start();
    } catch {
      this.active = false;
    }
  }

  stop() {
    try {
      this.rec?.stop();
    } catch {}
  }

  get listening() {
    return this.active;
  }
}
