"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import { Milo } from "@/components/milo/Milo";
import { Button, Chip, EASE } from "./index";

/** speak(): phrase in very large type for people nearby. */
export function SpeakOverlay() {
  const spoken = useApp((s) => s.spoken);
  const setSpoken = useApp((s) => s.setSpoken);
  return (
    <AnimatePresence>
      {spoken && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-bg/95 px-8"
          onClick={() => setSpoken(null)}
          role="status"
        >
          <Milo size={96} />
          <p className="mt-8 max-w-4xl text-center text-[64px] font-semibold leading-tight tracking-tight">{spoken}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LiveRegion() {
  const a = useApp((s) => s.announcement);
  return (
    <div aria-live="polite" role="status" className="sr-only">
      {a}
    </div>
  );
}

/** Persona verification — sandbox modal when no live keys. */
export function VerifyModal() {
  const v = useApp((s) => s.verify);
  const [busy, setBusy] = useState(false);
  if (!v) return null;
  const done = async (ok: boolean) => {
    if (ok) {
      setBusy(true);
      try {
        await api(`/api/verify/${v.id}/complete`, { method: "POST" });
      } catch {}
      setBusy(false);
    }
    v.resolve(ok);
  };
  return (
    <div data-scan-scope className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true" aria-labelledby="verify-title">
      <div className="w-full max-w-md rounded-lg bg-bg p-6 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={20} strokeWidth={1.75} className="text-success" aria-hidden />
          <h2 id="verify-title" className="text-xl font-semibold">Verify it’s you</h2>
          <Chip tone="warning" className="ml-auto">Sandbox verification</Chip>
        </div>
        <p className="text-muted">
          Before Milo {v.purpose === "shop.checkout" ? "places this order" : "files this appeal"}, a verified human has to authorise it.
          This demo uses Persona’s sandbox flow; no real ID is collected.
        </p>
        <div className="mt-4 rounded bg-surface px-4 py-3 text-sm">
          <div>Name: Maria Alvarez (demo)</div>
          <div className="text-muted">Inquiry: {v.id}</div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => done(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => done(true)} disabled={busy}>
            {busy ? "Verifying…" : "Verify (sandbox)"}
          </Button>
        </div>
      </div>
    </div>
  );
}
