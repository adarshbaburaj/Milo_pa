"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { quick } from "@/lib/agent";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui";

/** Demo "Director" panel (press D in demo mode): jump to each scene's starting state. Never fakes inputs or model output. */
export function DirectorPanel() {
  const demo = useApp((s) => s.settings.demoMode);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey && !e.altKey && useApp.getState().settings.demoMode) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!demo || !open) return null;

  const reset = async () => {
    await api("/api/demo/reset", { method: "POST" });
    const s = useApp.getState();
    s.clearMessages();
    s.setConfirm(null);
    s.setLetters([]);
    s.setSuggestions([], "local");
    useApp.setState({ lastSaving: null });
    s.bumpData();
    s.bumpReceipts();
  };
  const scenes: [string, () => void | Promise<void>][] = [
    ["Reset demo state", reset],
    ["1 · Onboarding", async () => { await reset(); useApp.getState().setSettings({ onboarded: false }); router.push("/welcome"); }],
    ["2 · Head mode (Home)", async () => { router.push("/"); useApp.getState().setMode("head"); }],
    ["3 · Fit check", () => router.push("/fit")],
    ["4 · Appeal (draft ready)", async () => { await reset(); router.push("/appeal"); await quick("Draft my appeal"); }],
    ["5 · Receipts", () => useApp.getState().setReceiptsOpen(true)],
  ];
  return (
    <div className="fixed bottom-24 left-64 z-[85] w-64 rounded-lg border border-border bg-bg p-3 shadow-soft" role="dialog" aria-label="Director panel">
      <div className="mb-2 text-sm font-semibold">🎬 Director <span className="font-normal text-muted">(D to close)</span></div>
      <div className="flex flex-col gap-1.5">
        {scenes.map(([label, fn]) => (
          <Button key={label} onClick={() => fn()} className="justify-start text-sm">
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
