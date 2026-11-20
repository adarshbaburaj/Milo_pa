"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { act } from "@/lib/agent";
import type { FitResult } from "@/lib/types";
import { Button, Callout, Chip, PageTitle, PropertyRow, Section } from "@/components/ui";

export default function FitDetail({ params }: { params: { id: string } }) {
  const [r, setR] = useState<FitResult | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api(`/api/catalog/${params.id}`).then((d) => setR(d.item)).catch(() => setErr(true));
  }, [params.id]);
  if (err) return <p className="text-muted">Chair not found. <Link href="/fit" className="text-accent">Back to Fit Check</Link></p>;
  if (!r) return <p className="text-muted">Loading…</p>;
  const c = r.chair;
  const useForAppeal = () =>
    act(
      { question: "", tool: "appeal", args: { action: "draft", item: c.id }, kind: "task", utterance: `Use the ${c.name} for my appeal`, inputMode: "text", raw: `Use the ${c.name} for my appeal`, partial: false },
      true,
      "text"
    );
  return (
    <div>
      <Link href="/fit" className="text-sm text-muted hover:underline" data-head-target>← Fit Check</Link>
      <div className="mt-4" />
      <PageTitle emoji={c.emoji} title={c.name} subtitle={r.fits ? "Fits your home and body measurements." : "Doesn’t fit — see the checks below."} />
      <div className="border-y border-border py-2">
        <PropertyRow label="Fits?">{r.fits ? <Chip tone="success">✅ Fits</Chip> : <Chip tone="danger">❌ {r.failed.join(", ")}</Chip>}</PropertyRow>
        <PropertyRow label="Type">{c.type === "power" ? "Power" : "Manual"}</PropertyRow>
        <PropertyRow label="Overall width">{c.overallWidthIn}″</PropertyRow>
        <PropertyRow label="Seat width">{c.seatWidthIn}″</PropertyRow>
        <PropertyRow label="Seat-to-floor">{c.seatToFloorIn}″</PropertyRow>
        <PropertyRow label="Turning radius">{c.turningRadiusIn ? `${c.turningRadiusIn}″` : "—"}</PropertyRow>
        <PropertyRow label="Price">${c.priceUsd.toLocaleString()}</PropertyRow>
        {c.insurerDefault && <PropertyRow label="Insurer">Acme’s default covered chair</PropertyRow>}
      </div>
      <Section title="Checks">
        <ul className="flex flex-col gap-2">
          {r.checks.map((ch) => (
            <li key={ch.rule}>
              <Callout emoji={ch.pass ? "✅" : "❌"} tone={ch.pass ? "neutral" : "danger"}>
                <div className="font-medium">{ch.rule}</div>
                <div className="tabular-nums text-[15px]">{ch.detail}</div>
              </Callout>
            </li>
          ))}
        </ul>
      </Section>
      {r.fits && (
        <div className="mt-8">
          <Button variant="primary" onClick={useForAppeal}>📄 Use this chair for my appeal</Button>
        </div>
      )}
    </div>
  );
}
