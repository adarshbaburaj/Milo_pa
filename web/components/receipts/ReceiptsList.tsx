"use client";
import { Download, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { speak } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import type { Receipt } from "@/lib/types";
import { Button } from "@/components/ui";
import { ReceiptItem } from "./ReceiptItem";

function day(ts: string) {
  return new Date(ts).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function ReceiptsList() {
  const v = useApp((s) => s.receiptsVersion);
  const [rs, setRs] = useState<Receipt[] | null>(null);
  useEffect(() => {
    api<Receipt[]>("/api/receipts").then(setRs).catch(() => setRs([]));
  }, [v]);
  if (!rs) return <p className="text-muted">Loading…</p>;
  if (!rs.length) return <p className="text-muted">No receipts yet. Everything Milo does will show up here.</p>;
  const groups: Record<string, Receipt[]> = {};
  rs.forEach((r) => (groups[day(r.ts)] ||= []).push(r));
  const readAloud = () => {
    const r = rs[0];
    speak(`Latest: you ${r.input.mode === "head" ? "chose" : "said"} ${r.interpretedAs}. ${r.summary ?? ""}`);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "milo-receipts.json";
    a.click();
  };
  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button onClick={readAloud}><Volume2 size={16} strokeWidth={1.75} aria-hidden /> Read aloud</Button>
        <Button onClick={exportJson}><Download size={16} strokeWidth={1.75} aria-hidden /> Export JSON</Button>
      </div>
      {Object.entries(groups).map(([d, items]) => (
        <section key={d} className="mb-6">
          <h3 className="mb-1 text-sm font-medium text-muted">{d}</h3>
          {items.map((r) => (
            <ReceiptItem key={r.id} r={r} />
          ))}
        </section>
      ))}
    </div>
  );
}
