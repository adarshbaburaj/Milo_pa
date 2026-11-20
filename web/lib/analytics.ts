"use client";
import { track as ampTrack } from "@amplitude/unified";
import { remote } from "./remoteConfig";
// Amplitude + Statsig wrapper. Without keys: console + in-memory (feeds the Impact panel).
type Ev = { event: string; props: Record<string, unknown>; ts: number };
export const events: Ev[] = [];

export function track(event: string, props: Record<string, unknown> = {}) {
  events.push({ event, props, ts: Date.now() });
  if (process.env.NODE_ENV !== "production") console.debug("[track]", event, props);
  // Amplitude (task steps + outcomes) and Statsig (same events, for experiment metrics)
  try {
    ampTrack(event, props);
  } catch {}
  const sg = (globalThis as any).__miloStatsig;
  if (sg?.logEvent) {
    try {
      const meta: Record<string, string> = {};
      Object.entries(props).forEach(([k, v]) => (meta[k] = String(v)));
      sg.logEvent(event, typeof props.value === "number" ? props.value : undefined, meta);
    } catch {}
  }
}

/** Experiment arm for prediction (Statsig dynamic config), logged on every prediction event. */
export function predictionStrategy() {
  return remote.predictionStrategy;
}
