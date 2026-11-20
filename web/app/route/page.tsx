"use client";
import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { Button, Callout, Chip, PageTitle, Section } from "@/components/ui";

type Plan = {
  origin: string;
  destination: string;
  mapsLink: string;
  checklist: string[];
  live: boolean;
  note?: string;
  summary: string;
  place?: { name: string; address: string; access: Record<string, boolean | null | undefined> };
  minutes?: number;
  rollingMeters?: number;
  pushLimitMeters?: number;
  overPushLimit?: boolean;
  steps?: { kind: string; text: string; meters: number }[];
  polyline?: string;
};

const ACCESS_LABEL: Record<string, string> = { entrance: "Entrance", parking: "Parking", restroom: "Restroom", seating: "Seating" };

function AccessChip({ v, label }: { v: boolean | null | undefined; label: string }) {
  if (v === true) return <Chip tone="success">✅ {label}</Chip>;
  if (v === false) return <Chip tone="danger">❌ {label}</Chip>;
  return <Chip>❔ {label}: no info</Chip>;
}

function RouteInner() {
  const params = useSearchParams();
  const [dest, setDest] = useState(params.get("to") || "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async (d = dest) => {
    if (!d.trim()) return;
    setBusy(true);
    try {
      setPlan(await api<Plan>("/api/directions", { json: { destination: d }, timeoutMs: 40000 }));
    } catch {
      setPlan(null);
    }
    setBusy(false);
  };
  useEffect(() => {
    if (params.get("to")) go(params.get("to")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SUGGEST = ["Oakland Public Library Main Library", "Highland Hospital Oakland", "Lake Merritt BART"];
  return (
    <div>
      <PageTitle emoji="🗺️" title="Get there" subtitle="An accessible way from home to where you need to go — with the entrance checked first." />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <label htmlFor="dest" className="sr-only">Where to?</label>
        <input id="dest" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Where to? e.g. the main library" className="min-h-[64px] flex-1 rounded-full border-2 border-border bg-surface px-6 text-xl outline-none focus:border-accent" />
        <Button variant="primary" size="lg" type="submit" disabled={busy}>
          <Navigation size={22} aria-hidden /> {busy ? "Planning…" : "Plan route"}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGEST.map((s) => (
          <Button key={s} onClick={() => { setDest(s); go(s); }}>
            <MapPin size={18} aria-hidden /> {s}
          </Button>
        ))}
      </div>

      {plan && (
        <>
          <Callout emoji={plan.overPushLimit ? "⚠️" : "🧭"} tone={plan.overPushLimit ? "warning" : "info"} className="mt-8">
            <div className="text-lg font-semibold">{plan.summary}</div>
            {plan.note && <div className="text-[15px] text-muted">{plan.note}</div>}
          </Callout>

          {plan.place && (
            <Section title={plan.place.name}>
              <p className="mb-3 text-muted">{plan.place.address}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(plan.place.access).map(([k, v]) => (
                  <AccessChip key={k} v={v} label={ACCESS_LABEL[k] ?? k} />
                ))}
              </div>
            </Section>
          )}

          {plan.live && (
            <div className="mt-6 overflow-hidden rounded-lg border-2 border-border">
              {/* key stays on the server: the API proxies the static map */}
              <img
                alt={`Map of the route from ${plan.origin} to ${plan.destination}`}
                className="w-full"
                src={`${API_URL}/api/directions/map?origin=${encodeURIComponent(plan.origin)}&destination=${encodeURIComponent(plan.place?.address || plan.destination)}&polyline=${encodeURIComponent(plan.polyline || "")}`}
              />
            </div>
          )}

          {plan.steps && plan.steps.length > 0 && (
            <Section title={`Steps · about ${plan.minutes} min`}>
              <ol className="flex flex-col gap-2">
                {plan.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 rounded border border-border bg-surface px-4 py-3 text-[17px]">
                    <span aria-hidden className="text-xl">{s.kind === "transit" ? "🚌" : "🦽"}</span>
                    <span className="flex-1">{s.text}</span>
                    {s.kind === "roll" && <span className="tabular-nums text-muted">{s.meters} m</span>}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[15px] text-muted">
                Rolling in total: {plan.rollingMeters} m · you can push about {plan.pushLimitMeters} m in a manual chair.
              </p>
            </Section>
          )}

          <Section title="Before you go">
            <ul className="flex flex-col gap-2 text-[17px]">
              {plan.checklist.map((c) => (
                <li key={c} className="flex gap-2"><span aria-hidden>☐</span>{c}</li>
              ))}
            </ul>
          </Section>

          <div className="mt-6">
            <a href={plan.mapsLink} target="_blank" rel="noreferrer" data-head-target className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-accent px-6 text-lg font-semibold text-white hover:bg-accent-hover">
              <ExternalLink size={20} aria-hidden /> Open in Google Maps
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export default function RoutePage() {
  return (
    <Suspense fallback={null}>
      <RouteInner />
    </Suspense>
  );
}
