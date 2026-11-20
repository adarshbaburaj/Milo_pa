"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { confirmNo, confirmYes } from "@/lib/agent";
import { useApp } from "@/lib/store";
import { EASE } from "./index";

/** "Do this?" with ✓ / ✕ — always bottom centre, works in every mode. */
export function ConfirmBar() {
  const confirm = useApp((s) => s.confirm);
  const mode = useApp((s) => s.mode);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") {
        if (!(e.target as HTMLInputElement).value && (e.key === "Enter" || e.key === "Escape")) {
          // fall through: empty input, treat as confirm keys
        } else return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        confirmYes("text");
      } else if (e.key === "Escape") {
        e.preventDefault();
        confirmNo("text");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm]);

  return (
    <AnimatePresence>
      {confirm && (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-label="Confirm action"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed bottom-28 left-1/2 z-[60] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-bg p-4 shadow-soft"
        >
          <p className="mb-3 text-center text-lg font-medium" aria-live="assertive">{confirm.question}</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              autoFocus
              data-head-target
              aria-label="Yes, do it"
              onClick={() => confirmYes(mode === "head" ? "head" : mode === "sign" ? "sign" : "text")}
              className="flex h-[88px] w-40 items-center justify-center gap-2 rounded-lg bg-success-soft text-xl font-semibold text-success hover:brightness-95 data-[head-hover=true]:ring-2 data-[head-hover=true]:ring-accent"
            >
              <Check size={28} strokeWidth={2.25} aria-hidden /> Yes
            </button>
            <button
              type="button"
              data-head-target
              aria-label="No, cancel"
              onClick={() => confirmNo(mode === "head" ? "head" : mode === "sign" ? "sign" : "text")}
              className="flex h-[88px] w-40 items-center justify-center gap-2 rounded-lg bg-surface text-xl font-semibold text-ink hover:bg-surface-hover data-[head-hover=true]:ring-2 data-[head-hover=true]:ring-accent"
            >
              <X size={28} strokeWidth={2.25} aria-hidden /> No
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted">Enter = yes · Esc = no · say “yes” / “no” · nod = yes · shake = no</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
