"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { EASE } from "@/components/ui";
import { ReceiptsList } from "./ReceiptsList";

export function ReceiptsPanel() {
  const open = useApp((s) => s.receiptsOpen);
  const setOpen = useApp((s) => s.setReceiptsOpen);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          aria-label="Receipts"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed right-0 top-0 z-50 h-screen w-[400px] max-w-full overflow-y-auto border-l border-border bg-bg px-5 py-5 shadow-soft"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">🧾 Receipts</h2>
            <button aria-label="Close receipts" data-head-target onClick={() => setOpen(false)} className="rounded p-1.5 text-muted hover:bg-surface">
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
          <ReceiptsList />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
