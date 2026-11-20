"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { confirmNo, confirmYes } from "@/lib/agent";
import { useApp } from "@/lib/store";
import { EASE } from "./index";
import { Milo } from "@/components/milo/Milo";

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
          data-scan-scope
          aria-modal="false"
          aria-label="Confirm action"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed bottom-32 left-1/2 z-[60] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 rounded-[32px] border-2 border-border bg-surface p-6 shadow-lift"
        >
          <div className="mb-5 flex items-center justify-center gap-4"><Milo size={56} /><p className="text-2xl font-semibold leading-snug" aria-live="assertive">{confirm.question}</p></div>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              autoFocus
              data-head-target
              aria-label="Yes, do it"
              onClick={() => confirmYes(mode === "head" ? "head" : mode === "sign" ? "sign" : "text")}
              className="flex h-[104px] flex-1 items-center justify-center gap-3 rounded-[24px] bg-success text-2xl font-semibold text-white shadow-soft hover:brightness-110 data-[head-hover=true]:ring-[4px] data-[head-hover=true]:ring-accent data-[head-hover=true]:ring-offset-2"
            >
              <Check size={34} strokeWidth={2.5} aria-hidden /> Yes
            </button>
            <button
              type="button"
              data-head-target
              aria-label="No, cancel"
              onClick={() => confirmNo(mode === "head" ? "head" : mode === "sign" ? "sign" : "text")}
              className="flex h-[104px] flex-1 items-center justify-center gap-3 rounded-[24px] border-2 border-border bg-surface text-2xl font-semibold text-ink hover:bg-surface-hover data-[head-hover=true]:ring-[4px] data-[head-hover=true]:ring-accent data-[head-hover=true]:ring-offset-2"
            >
              <X size={34} strokeWidth={2.5} aria-hidden /> No
            </button>
          </div>
          <p className="mt-3 text-center text-sm text-muted">Enter = yes · Esc = no · say “yes” / “no” · nod = yes · shake = no</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
