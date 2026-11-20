"use client";
import type { Receipt } from "@/lib/types";
import { Chip, ModeChip, SourceChip, Toggle } from "@/components/ui";

const TOOL_EMOJI: Record<string, string> = { fit_check: "🪑", coverage: "📄", appeal: "📄", shop: "🛒", caregiver: "🤝", status: "📌", speak: "🗣" };

function time(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ReceiptItem({ r }: { r: Receipt }) {
  const conf = typeof r.confidence === "number" ? r.confidence.toFixed(2) : null;
  const status = r.confirmed === true ? "✓ confirmed" : r.confirmed === false ? "✕ cancelled" : "read-only";
  const raw = r.input.partial ? `“${r.input.raw.toUpperCase()}”` : null;
  const m = r.model || (r.models && r.models[r.models.length - 1]);
  return (
    <Toggle
      className="border-b border-border py-1 last:border-0"
      summary={
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-6">
          <span className="tabular-nums text-muted">{time(r.ts)}</span>
          <ModeChip mode={r.input.mode} />
          {raw && <span className="font-mono text-sm text-muted">{raw} →</span>}
          <span className="min-w-0">“{r.interpretedAs}”</span>
          {conf && <span className="text-sm text-muted">({conf})</span>}
          <span className={`text-sm ${r.confirmed === false ? "text-[#b42323]" : "text-success"}`}>{status}</span>
        </div>
      }
    >
      <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">Understood as</dt>
        <dd>{r.interpretedAs}</dd>
        {r.alternatives && r.alternatives.length > 0 && (
          <>
            <dt className="text-muted">Alternatives</dt>
            <dd className="text-muted">{r.alternatives.map((a) => `${a.text} (${a.confidence.toFixed(2)})`).join(" · ")}</dd>
          </>
        )}
        <dt className="text-muted">Tool</dt>
        <dd>
          {TOOL_EMOJI[r.tool || ""] ?? "•"} {r.tool}
          {r.toolArgs && Object.keys(r.toolArgs).length > 0 && <span className="ml-1 font-mono text-xs text-muted">{JSON.stringify(r.toolArgs)}</span>}
        </dd>
        {r.confirmMode && (
          <>
            <dt className="text-muted">Confirmed by</dt>
            <dd><ModeChip mode={r.confirmMode} /></dd>
          </>
        )}
        <dt className="text-muted">Result</dt>
        <dd>{r.summary}</dd>
        <dt className="text-muted">Model</dt>
        <dd className="flex flex-wrap gap-1">
          {r.models && r.models.length > 0 ? (
            r.models.map((mm, i) => (
              <Chip key={i} tone="accent">⚡ {mm.tier ?? "model"} · {mm.name} · {mm.latencyMs} ms</Chip>
            ))
          ) : (
            <Chip>local rules · {r.latencyMs ?? 0} ms</Chip>
          )}
          {!m && null}
        </dd>
        <dt className="text-muted">Sponsors</dt>
        <dd className="flex flex-wrap gap-1">
          {r.sponsorCalls.length ? r.sponsorCalls.map((c, i) => <SourceChip key={i} live={c.live} label={`${c.sponsor}.${c.op}`} />) : <span className="text-muted">none</span>}
          <Chip tone={r.source === "live" ? "success" : "neutral"}>source: {r.source}</Chip>
        </dd>
      </dl>
      {r.evidence.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-sm font-medium">Evidence</div>
          <ul className="space-y-1 text-sm">
            {r.evidence.map((e, i) => (
              <li key={i} className="grid grid-cols-[130px_1fr_auto] gap-2">
                <span className="text-muted">{e.label}</span>
                <span>{e.value}</span>
                <span className="text-xs text-muted">{e.source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Toggle>
  );
}
