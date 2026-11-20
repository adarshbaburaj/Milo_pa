"use client";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { openConfirm } from "@/lib/agent";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { FitResult } from "@/lib/types";
import { Button, Callout, Chip, PageTitle, Section } from "@/components/ui";

export default function ShopPage() {
  const [items, setItems] = useState<FitResult[] | null>(null);
  const v = useApp((s) => s.dataVersion);
  useEffect(() => {
    api("/api/catalog").then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [v]);
  const fitting = items?.filter((i) => i.fits) ?? [];
  const checkout = (r: FitResult) =>
    openConfirm({
      question: `Start checkout for the ${r.name} ($${r.chair.priceUsd.toLocaleString()})?`,
      tool: "shop",
      args: { item: r.id, action: "checkout" },
      kind: "task",
      utterance: `Order the ${r.name}`,
      inputMode: "text",
      raw: `Order the ${r.name}`,
      partial: false,
    });
  return (
    <div>
      <PageTitle emoji="🛒" title="Shop" subtitle="MobilityMart (demo store) · chairs that fit your home" />
      <Callout emoji="ℹ️">
        Milo does the checkout for you: it fills shipping from your profile, reads the total aloud, asks Alex to approve anything over $500, and
        verifies it’s you before paying. Demo store — nothing is charged.
      </Callout>
      <Section title="Fits your home">
        <div className="grid grid-cols-2 gap-3">
          {fitting.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <div className="text-3xl" aria-hidden>
                {r.chair.emoji}
              </div>
              <div className="mt-2 font-semibold">{r.name}</div>
              <div className="text-sm text-muted">
                {r.chair.type} · {r.chair.overallWidthIn}″ wide · turns in {r.chair.turningRadiusIn}″
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">${r.chair.priceUsd.toLocaleString()}</span>
                <Chip tone="success">✅ Fits</Chip>
              </div>
              <div className="text-sm text-muted">≈ ${(r.chair.priceUsd * 0.2).toLocaleString()} your share if the appeal is approved</div>
              <Button variant="primary" className="mt-3" onClick={() => checkout(r)}>
                <ShoppingCart size={16} strokeWidth={1.75} aria-hidden /> Checkout with Milo
              </Button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
