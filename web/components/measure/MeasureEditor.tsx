"use client";
import { Camera, Copy, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CURRENT_CHAIRS, MEASURES, MeasureDef, Source, SOURCE_LABEL, TRUSTED } from "@/lib/measurements";
import type { Profile } from "@/lib/types";
import { Button, Chip } from "@/components/ui";

function fmt(v: number, unit: string) {
  return unit === "in" ? `${v}″` : `${v} ft`;
}

/**
 * Every measurement can be filled without typing and without being an expert:
 * big −/+ buttons · use my current chair · photo estimate · ask a helper · not sure (flagged).
 */
export function MeasureEditor({ helperMode = false, onChange }: { helperMode?: boolean; onChange?: (p: Profile) => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<Profile>("/api/profile").then(setP).catch(() => {});
  }, []);

  const save = async (def: MeasureDef, v: number, source: Source) => {
    if (!p) return;
    const next = def.set(p, v);
    next.measured = { ...(p.measured || {}), [def.key]: source };
    setP(next);
    try {
      const saved = await api<Profile>("/api/profile", { method: "PUT", json: next });
      setP(saved);
      onChange?.(saved);
    } catch {}
    setOpen(null);
  };

  if (!p) return <p className="text-muted">Loading your measurements…</p>;
  return (
    <div className="flex flex-col gap-3">
      {MEASURES.map((def) => {
        const v = def.get(p);
        const src = (p.measured?.[def.key] as Source) || "demo";
        const trusted = TRUSTED.includes(src);
        return (
          <div key={def.key} className="rounded-lg border-2 border-border bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">{def.label}</div>
                <div className="text-[15px] text-muted">{def.why}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums">{fmt(v, def.unit)}</div>
                <Chip tone={trusted ? "neutral" : "warning"}>{SOURCE_LABEL[src]}</Chip>
              </div>
              <Button onClick={() => setOpen(open === def.key ? null : def.key)} label={`Change ${def.label}`}>
                {open === def.key ? "Close" : "Change"}
              </Button>
            </div>
            {open === def.key && <Panel def={def} value={v} helperMode={helperMode} onSave={(val, s) => save(def, val, s)} />}
          </div>
        );
      })}
    </div>
  );
}

function Panel({ def, value, helperMode, onSave }: { def: MeasureDef; value: number; helperMode: boolean; onSave: (v: number, s: Source) => void }) {
  const [v, setV] = useState(value);
  const [ref, setRef] = useState("card");
  const [photo, setPhoto] = useState<{ busy?: boolean; inches?: number; confidence?: string; note?: string; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const clamp = (x: number) => Math.max(def.min, Math.min(def.max, Math.round(x / def.step) * def.step));

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      setPhoto({ busy: true });
      try {
        const out = await api("/api/measure/photo", { json: { image: r.result, target: def.photo, reference: ref }, timeoutMs: 70000 });
        setPhoto(out.ok ? { inches: out.inches, confidence: out.confidence, note: out.note } : { message: out.message });
      } catch {
        setPhoto({ message: "Couldn't reach Milo. Try again or use the buttons." });
      }
    };
    r.readAsDataURL(f);
  };

  const helperLink = typeof window !== "undefined" ? `${window.location.origin}/measure` : "/measure";

  return (
    <div className="mt-4 grid gap-4 border-t border-border pt-4">
      {/* Big stepper — no typing needed */}
      <div className="flex items-center gap-3">
        <button data-head-target aria-label={`Less ${def.label}`} onClick={() => setV(clamp(v - def.step))} className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-border bg-surface hover:bg-surface-hover data-[head-hover=true]:ring-[3px] data-[head-hover=true]:ring-accent">
          <Minus size={30} />
        </button>
        <div className="min-w-[140px] text-center text-4xl font-semibold tabular-nums" aria-live="polite">{fmt(v, def.unit)}</div>
        <button data-head-target aria-label={`More ${def.label}`} onClick={() => setV(clamp(v + def.step))} className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-border bg-surface hover:bg-surface-hover data-[head-hover=true]:ring-[3px] data-[head-hover=true]:ring-accent">
          <Plus size={30} />
        </button>
        <Button variant="primary" size="lg" onClick={() => onSave(v, helperMode ? "helper" : "self")} className="ml-auto">
          Save {fmt(v, def.unit)}
        </Button>
      </div>

      {helperMode && (
        <ol className="list-decimal space-y-1 pl-6 text-[17px]">
          {def.how.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      )}

      {def.key === "hipWidthIn" && !helperMode && (
        <div>
          <div className="mb-2 font-medium">Use my current chair</div>
          <div className="flex flex-wrap gap-2">
            {CURRENT_CHAIRS.map((c) => (
              <Button key={c.seat} onClick={() => onSave(c.seat - 2, "current_chair")}>{c.label}</Button>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">If your current seat fits well, your hips are about 2″ narrower than it.</p>
        </div>
      )}

      {def.photo && (
        <div>
          <div className="mb-2 font-medium">Estimate from a photo</div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Reference object in the photo" value={ref} onChange={(e) => setRef(e.target.value)} className="min-h-[52px] rounded-full border-2 border-border bg-surface px-4">
              <option value="card">with a bank card in the photo</option>
              <option value="a4">with an A4 sheet in the photo</option>
              <option value="letter">with a Letter sheet in the photo</option>
            </select>
            <label data-head-target className="inline-flex min-h-[52px] cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-surface px-5 font-semibold hover:bg-surface-hover">
              <Camera size={20} aria-hidden /> Take or choose photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </div>
          <p className="mt-1 text-sm text-muted">Tape the card or paper flat on the thing you’re measuring. It’s an estimate — a helper or clinician should confirm.</p>
          {photo?.busy && <p className="mt-2">Measuring…</p>}
          {photo?.message && <p className="mt-2 text-danger">{photo.message}</p>}
          {photo?.inches != null && (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded bg-warning-soft px-4 py-3">
              <span className="text-xl font-semibold">≈ {photo.inches}″</span>
              <Chip tone="warning">{photo.confidence} confidence</Chip>
              <span className="text-[15px]">{photo.note}</span>
              <Button variant="primary" onClick={() => onSave(clamp(photo.inches!), "photo")}>Use this estimate</Button>
            </div>
          )}
        </div>
      )}

      {!helperMode && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(helperLink);
              setCopied(true);
            }}
          >
            <Copy size={18} aria-hidden /> {copied ? "Link copied — send it to your helper" : "Ask a helper to measure"}
          </Button>
          <Button variant="ghost" onClick={() => onSave(def.typical, "estimated")}>Not sure — use a typical value</Button>
        </div>
      )}
    </div>
  );
}
