"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { FitResult, Profile } from "@/lib/types";
import { Chip, PageTitle, Table } from "@/components/ui";

export default function FitPage() {
  const [data, setData] = useState<{ profile: Profile; items: FitResult[] } | null>(null);
  const [err, setErr] = useState(false);
  const v = useApp((s) => s.dataVersion);
  const router = useRouter();
  useEffect(() => {
    api("/api/catalog").then(setData).catch(() => setErr(true));
  }, [v]);
  const p = data?.profile;
  return (
    <div>
      <PageTitle
        emoji="🪑"
        title="Fit Check"
        subtitle={
          p ? `Checked against your measurements: ${p.home.narrowestDoorwayName} ${p.home.narrowestDoorwayIn}″, hips ${p.hipWidthIn}″, hallway ${p.home.hallwayTurnSpaceIn}″.` : "Checked against your measurements."
        }
      />
      {err && <p className="text-muted">Can’t reach Milo’s API. Is it running on port 8000?</p>}
      {data && (
        <Table head={["Name", "Fits?", "Why", "Price"]} caption="Wheelchairs checked against your measurements">
          {data.items.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer border-b border-border align-top hover:bg-surface"
              onClick={() => router.push(`/fit/${r.id}`)}
            >
              <td className="px-3 py-2.5">
                <a
                  href={`/fit/${r.id}`}
                  data-head-target
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(`/fit/${r.id}`);
                  }}
                  className="font-medium hover:underline"
                >
                  <span aria-hidden className="mr-1.5">{r.chair.emoji}</span>
                  {r.name}
                </a>
                {r.chair.insurerDefault && <div className="text-xs text-muted">Insurer’s default</div>}
              </td>
              <td className="px-3 py-2.5">{r.fits ? <Chip tone="success">✅ Fits</Chip> : <Chip tone="danger">❌ No</Chip>}</td>
              <td className="px-3 py-2.5 text-[14px] text-muted">{r.one_liner}</td>
              <td className="px-3 py-2.5 tabular-nums">${r.chair.priceUsd.toLocaleString()}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
