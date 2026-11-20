"use client";
// Amplitude + Statsig wrapper. Without keys: console + in-memory (feeds the Impact panel).
type Ev = { event: string; props: Record<string, unknown>; ts: number };
export const events: Ev[] = [];

export function track(event: string, props: Record<string, unknown> = {}) {
  events.push({ event, props, ts: Date.now() });
  if (process.env.NODE_ENV !== "production") console.debug("[track]", event, props);
  const amp = (globalThis as any).__miloAmplitude;
  if (amp?.track) {
    try {
      amp.track(event, props);
    } catch {}
  }
}
