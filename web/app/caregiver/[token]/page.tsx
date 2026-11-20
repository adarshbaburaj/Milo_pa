"use client";
import { useEffect, useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { milo } from "@/components/milo/useMilo";
import { api } from "@/lib/api";
import { Button, Callout } from "@/components/ui";

/** Minimal approve/decline page for the caregiver (open on a phone). */
export default function CaregiverPage({ params }: { params: { token: string } }) {
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api(`/api/caregiver/${params.token}`).then(setR).catch(() => setErr(true));
  }, [params.token]);
  const decide = async (approve: boolean) => {
    const out = await api(`/api/caregiver/${params.token}/decision`, { json: { approve } });
    setR(out);
    milo.react(approve ? "celebrate" : "confused");
  };
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col items-center px-6 pt-16 text-center">
      <Milo size={96} />
      {err && <p className="mt-6 text-muted">This approval link isn’t valid.</p>}
      {r && (
        <>
          <h1 className="mt-6 text-2xl font-semibold">{r.from} asks for your approval</h1>
          <p className="mt-2 text-lg">
            {r.itemName} · <strong>${Number(r.amountUsd).toLocaleString()}</strong>
          </p>
          <p className="text-sm text-muted">MobilityMart (demo store) · {r.note}</p>
          {r.status === "pending" ? (
            <div className="mt-8 flex w-full gap-3">
              <Button variant="primary" className="h-[88px] flex-1 justify-center text-xl" onClick={() => decide(true)}>
                ✓ Approve
              </Button>
              <Button className="h-[88px] flex-1 justify-center text-xl" onClick={() => decide(false)}>
                ✕ Decline
              </Button>
            </div>
          ) : (
            <Callout emoji={r.status === "approved" ? "✅" : "✕"} tone={r.status === "approved" ? "success" : "neutral"} className="mt-8 w-full text-left">
              You {r.status} this request. {r.from}’s Milo has been told.
            </Callout>
          )}
          <p className="mt-10 text-xs text-muted">Demo data · fictional people and store.</p>
        </>
      )}
    </main>
  );
}
