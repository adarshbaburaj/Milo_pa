"use client";
// Statsig: make agent settings configurable without a redeploy.
//  dynamic config "milo_agent_settings": { dwellMs, predictionStrategy, suggestionCount }
//  gate "sign_mode_beta": hide Sign mode when explicitly turned off (an unknown gate leaves it on)
import { DEFAULT_SETTINGS, useApp } from "./store";

export const remote = { predictionStrategy: "context" as "context" | "frequency", suggestionCount: 4, signBeta: true };

export function applyRemoteConfig(client: any) {
  try {
    const cfg = client.getDynamicConfig("milo_agent_settings");
    const v = cfg?.value || {};
    if (v.predictionStrategy === "frequency" || v.predictionStrategy === "context") remote.predictionStrategy = v.predictionStrategy;
    if (typeof v.suggestionCount === "number") remote.suggestionCount = Math.max(2, Math.min(6, v.suggestionCount));
    const s = useApp.getState().settings;
    // remote dwell is a default only — never override a value the person chose
    if (typeof v.dwellMs === "number" && s.dwellMs === DEFAULT_SETTINGS.dwellMs) useApp.getState().setSettings({ dwellMs: v.dwellMs });
    const gate = client.getFeatureGate("sign_mode_beta");
    const unknown = String(gate?.details?.reason || "").includes("Unrecognized") || String(gate?.details?.reason || "").includes("NoValues");
    remote.signBeta = unknown ? true : !!gate.value;
    useApp.setState({ remoteVersion: (useApp.getState() as any).remoteVersion + 1 } as any);
  } catch {}
}
