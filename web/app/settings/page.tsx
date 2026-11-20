"use client";
import { useEffect, useState } from "react";
import { Calibrate } from "@/components/input/Calibrate";
import { MeasureEditor } from "@/components/measure/MeasureEditor";
import { api } from "@/lib/api";
import { events } from "@/lib/analytics";
import { DEFAULT_SETTINGS, useApp } from "@/lib/store";
import type { InputMode } from "@/lib/types";
import { Button, Chip, PageTitle, PropertyRow, Section } from "@/components/ui";

const MODE_LABEL: Record<InputMode, string> = { text: "Aa Type", voice: "🎙 Speak", head: "🙂 Head", sign: "🤟 Sign (beta)" };

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-head-target
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 rounded-full transition-colors ${checked ? "bg-accent" : "bg-border"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function Range({ value, min, max, step, onChange, label, fmt }: { value: number; min: number; max: number; step: number; onChange: (n: number) => void; label: string; fmt: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-56 accent-[var(--accent)]" />
      <span className="tabular-nums text-sm text-muted">{fmt(value)}</span>
    </div>
  );
}

export default function SettingsPage() {
  const s = useApp((x) => x.settings);
  const set = useApp((x) => x.setSettings);
  const [health, setHealth] = useState<Record<string, string> | null>(null);
  const [impact, setImpact] = useState<any>(null);
  const [cal, setCal] = useState(false);
  const rv = useApp((x) => x.receiptsVersion);

  useEffect(() => {
    api("/api/health").then((h) => setHealth(h.sponsors)).catch(() => setHealth(null));
  }, []);
  useEffect(() => {
    api("/api/impact").then(setImpact).catch(() => {});
  }, [rv]);

  if (cal) return <Calibrate onDone={() => setCal(false)} onCancel={() => setCal(false)} />;

  const toggleMode = (m: InputMode) => set({ inputModes: s.inputModes.includes(m) ? s.inputModes.filter((x) => x !== m) : [...s.inputModes, m] });
  const resetDemo = async () => {
    await api("/api/demo/reset", { method: "POST" });
    useApp.getState().clearMessages();
    useApp.getState().bumpData();
    useApp.getState().bumpReceipts();
  };

  return (
    <div>
      <PageTitle emoji="⚙️" title="Settings" />

      <Section title="Accessibility">
        <PropertyRow label="My needs">
          <div className="flex flex-wrap items-center gap-2">
            {(s.needs?.length ? s.needs : ["none picked"]).map((n) => <Chip key={n}>{n}</Chip>)}
            <Button onClick={() => { set({ onboarded: false }); location.assign("/welcome"); }}>Redo setup</Button>
          </div>
        </PropertyRow>
        <PropertyRow label="Captions"><Switch label="Captions" checked={s.captions} onChange={(b) => set({ captions: b })} /></PropertyRow>
        <PropertyRow label="Visual alerts"><Switch label="Visual alerts" checked={s.visualAlerts} onChange={(b) => set({ visualAlerts: b })} /></PropertyRow>
        <PropertyRow label="Read everything aloud"><Switch label="Read everything aloud" checked={s.readEverything} onChange={(b) => set({ readEverything: b })} /></PropertyRow>
        <PropertyRow label="Simple mode"><Switch label="Simple mode" checked={s.simpleMode} onChange={(b) => set({ simpleMode: b })} /></PropertyRow>
        <PropertyRow label="Switch scanning"><Switch label="Switch scanning" checked={s.scanning} onChange={(b) => set({ scanning: b })} /></PropertyRow>
        <PropertyRow label="Scan speed"><Range label="Scan speed" value={s.scanMs} min={800} max={4000} step={100} onChange={(n) => set({ scanMs: n })} fmt={(n) => `${(n / 1000).toFixed(1)} s per option`} /></PropertyRow>
        <PropertyRow label="Hover to choose"><Switch label="Hover to choose (eye-gaze, trackball)" checked={s.hoverDwell} onChange={(b) => set({ hoverDwell: b })} /></PropertyRow>
      </Section>

      <Section title="Measurements">
        <MeasureEditor />
      </Section>

      <Section title="Input modes">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODE_LABEL) as InputMode[]).map((m) => (
            <button
              key={m}
              data-head-target
              aria-pressed={s.inputModes.includes(m)}
              onClick={() => toggleMode(m)}
              className={`rounded px-3 py-2 text-[15px] ${s.inputModes.includes(m) ? "bg-accent-soft ring-2 ring-accent" : "bg-surface"}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Head mode">
        <PropertyRow label="Dwell time"><Range label="Dwell time" value={s.dwellMs} min={500} max={1500} step={50} onChange={(n) => set({ dwellMs: n })} fmt={(n) => `${n} ms`} /></PropertyRow>
        <PropertyRow label="Sensitivity"><Range label="Head sensitivity" value={s.headSensitivity} min={0.5} max={2} step={0.05} onChange={(n) => set({ headSensitivity: n })} fmt={(n) => `${n.toFixed(2)}×`} /></PropertyRow>
        <PropertyRow label="Invert left/right"><Switch label="Invert X" checked={s.invertX} onChange={(b) => set({ invertX: b })} /></PropertyRow>
        <PropertyRow label="Invert up/down"><Switch label="Invert Y" checked={s.invertY} onChange={(b) => set({ invertY: b })} /></PropertyRow>
        <PropertyRow label="Calibration"><Button onClick={() => setCal(true)}>Recalibrate</Button></PropertyRow>
      </Section>

      <Section title="Voice">
        <PropertyRow label="Read replies aloud"><Switch label="Voice output" checked={s.voiceOutput} onChange={(b) => set({ voiceOutput: b })} /></PropertyRow>
        <PropertyRow label="Voice rate"><Range label="Voice rate" value={s.voiceRate} min={0.6} max={1.5} step={0.05} onChange={(n) => set({ voiceRate: n })} fmt={(n) => `${n.toFixed(2)}×`} /></PropertyRow>
      </Section>

      <Section title="Display">
        <PropertyRow label="Large text"><Switch label="Large text" checked={s.largeText} onChange={(b) => set({ largeText: b })} /></PropertyRow>
        <PropertyRow label="High contrast"><Switch label="High contrast" checked={s.highContrast} onChange={(b) => set({ highContrast: b })} /></PropertyRow>
        <PropertyRow label="Reduced motion">
          <select aria-label="Reduced motion" value={s.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.value as any })} className="rounded bg-surface px-2 py-1.5 text-[15px]">
            <option value="system">Follow system</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </PropertyRow>
      </Section>

      <Section title="People">
        <PropertyRow label="Caregiver contact">
          <input aria-label="Caregiver contact" value={s.caregiverContact} onChange={(e) => set({ caregiverContact: e.target.value })} className="w-64 rounded bg-surface px-2 py-1.5 text-[15px]" />
        </PropertyRow>
      </Section>

      <Section title="Demo">
        <PropertyRow label="Demo mode"><Switch label="Demo mode" checked={s.demoMode} onChange={(b) => set({ demoMode: b })} /></PropertyRow>
        <PropertyRow label="Reset">
          <div className="flex gap-2">
            <Button onClick={resetDemo}>Reset demo data</Button>
            <Button variant="ghost" onClick={() => set({ ...DEFAULT_SETTINGS, demoMode: s.demoMode })}>Reset settings</Button>
          </div>
        </PropertyRow>
        <p className="mt-1 text-sm text-muted">In demo mode press D for the Director panel. Head tracking, voice and model output are always live.</p>
      </Section>

      <Section title="Impact">
        {impact && impact.sentences > 0 ? (
          <p className="text-[15px]">
            Average moves per sentence: <strong>{impact.avgMovesPerSentence}</strong> · Letters saved: <strong>{impact.lettersSavedPct}%</strong> · Prediction top-1 accuracy:{" "}
            <strong>{impact.top1AccuracyPct}%</strong> <span className="text-muted">({impact.sentences} sentences this session, {events.length} events)</span>
          </p>
        ) : (
          <p className="text-muted">No sentences yet — numbers appear after you use head mode or first letters. Real session numbers only.</p>
        )}
      </Section>

      <Section title="API status">
        {health ? (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px]">
            {Object.entries(health).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <span aria-hidden className={`h-2 w-2 rounded-full ${v === "live" ? "bg-success" : v === "mock" ? "bg-border" : "bg-warning"}`} />
                <span className="capitalize">{k}</span>
                <Chip tone={v === "live" ? "success" : "neutral"}>{v}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">API not reachable.</p>
        )}
      </Section>
    </div>
  );
}
