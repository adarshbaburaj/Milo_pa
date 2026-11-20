"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { useApp } from "@/lib/store";
import { EASE } from "./index";

/** Milo's latest reply, on every page except Home (where the conversation lives). */
export function MiloToast() {
  const path = usePathname();
  const last = useApp((s) => [...s.messages].reverse().find((m) => m.role === "milo"));
  const [shownId, setShownId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (last && last.id !== shownId) setShownId(last.id);
  }, [last, shownId]);

  const mode = useApp((s) => s.mode);
  // head / sign boards show Milo's reply inside the board, so the card never covers their controls
  const visible = path !== "/" && mode !== "head" && mode !== "sign" && last && last.id === shownId && dismissed !== last.id;
  return (
    <AnimatePresence>
      {visible && last && (
        <motion.div
          key={last.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: EASE }}
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-[120px] right-6 z-[58] flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 rounded-[24px] border-2 border-border bg-surface p-4 shadow-lift"
        >
          <Milo size={40} label={false} />
          <div className="min-w-0 flex-1 text-[17px] leading-snug">
            {last.text}
            {last.link && last.link !== path && (
              <Link href={last.link} data-head-target className="mt-1 block font-semibold text-accent hover:underline">
                {last.linkLabel ?? "Open"} →
              </Link>
            )}
          </div>
          <button data-head-target aria-label="Dismiss" onClick={() => setDismissed(last.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-alt">
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
