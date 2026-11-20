"use client";
import { chooseSuggestion, noneOfThese } from "@/lib/agent";
import { useApp } from "@/lib/store";
import type { InputMode } from "@/lib/types";
import { Chip, Tile } from "@/components/ui";

const TOOL_EMOJI: Record<string, string> = { fit_check: "🪑", coverage: "📄", appeal: "📄", shop: "🛒", caregiver: "🤝", status: "📌" };

/** 4 large suggestion tiles + "None of these". */
export function Suggestions({ mode, compact = false }: { mode: InputMode; compact?: boolean }) {
  const sugg = useApp((s) => s.suggestions);
  const source = useApp((s) => s.suggestionsSource);
  const model = useApp((s) => s.predictModel);
  if (!sugg.length) return null;
  return (
    <div>
      <div className={`grid gap-3 ${compact ? "grid-cols-5" : "grid-cols-5"}`} role="group" aria-label="Suggestions">
        {sugg.slice(0, 4).map((s, i) => (
          <Tile
            key={s.text + i}
            label={`Suggestion ${i + 1}: ${s.text}${s.kind === "task" ? " (task)" : ""}`}
            onSelect={() => chooseSuggestion(s, i + 1, mode)}
            className={`flex-col !items-start !justify-between px-4 py-3 text-left ${compact ? "min-h-[72px]" : "min-h-[100px]"}`}
          >
            <span className={`${compact ? "text-base" : "text-lg"} font-medium leading-snug`}>
              {s.tool && <span aria-hidden className="mr-1">{TOOL_EMOJI[s.tool] ?? ""}</span>}
              {s.text}
            </span>
            <span className="mt-1 text-xs text-muted">{Math.round(s.confidence * 100)}%</span>
          </Tile>
        ))}
        <Tile label="None of these" onSelect={noneOfThese} className={`px-3 text-base text-muted ${compact ? "min-h-[72px]" : "min-h-[100px]"}`}>
          None of these
        </Tile>
      </div>
      <div className="mt-1.5 flex justify-end">
        <Chip tone={source === "live" ? "accent" : "neutral"}>
          {source === "live" && model ? `⚡ ${model.tier ?? "small"} model · ${model.latencyMs} ms` : "instant · local memory"}
        </Chip>
      </div>
    </div>
  );
}
