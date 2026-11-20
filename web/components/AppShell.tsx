"use client";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { HeadBoard } from "@/components/input/HeadBoard";
import { SignInput } from "@/components/input/SignInput";
import { milo } from "@/components/milo/useMilo";
import { ReceiptsPanel } from "@/components/receipts/ReceiptsPanel";
import { ConfirmBar } from "@/components/ui/ConfirmBar";
import { LiveRegion, SpeakOverlay, VerifyModal } from "@/components/ui/Overlays";
import { Sidebar } from "@/components/ui/Sidebar";
import { Dock } from "@/components/input/Dock";
import { DirectorPanel } from "@/components/DirectorPanel";
import { onCaregiverDecision, registerNavigate } from "@/lib/agent";
import { API_URL, api } from "@/lib/api";
import { setPhrases } from "@/lib/phrasesLocal";
import { useApp } from "@/lib/store";

const NO_CHROME = ["/welcome", "/caregiver"];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const hydrate = useApp((s) => s.hydrate);
  const settings = useApp((s) => s.settings);
  const hydrated = useApp((s) => s.hydrated);
  const mode = useApp((s) => s.mode);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => registerNavigate((h) => router.push(h)), [router]);

  // onboarding redirect + ?demo=1
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      api("/api/demo/reset", { method: "POST" })
        .then(() => {
          useApp.getState().clearMessages();
          useApp.getState().setSettings({ demoMode: true });
          useApp.getState().bumpReceipts();
          useApp.getState().bumpData();
        })
        .catch(() => {});
      return;
    }
    if (!settings.onboarded && !NO_CHROME.some((p) => path.startsWith(p))) router.replace("/welcome");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // settings → html classes
  useEffect(() => {
    const h = document.documentElement;
    h.classList.toggle("large-text", settings.largeText);
    h.classList.toggle("hc", settings.highContrast);
  }, [settings.largeText, settings.highContrast]);

  // phrase memory for instant local prediction
  useEffect(() => {
    api("/api/memory/phrases").then(setPhrases).catch(() => {});
  }, []);

  // SSE: receipts + caregiver decisions
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_URL}/api/events`);
      es.addEventListener("receipt", () => useApp.getState().bumpReceipts());
      es.addEventListener("caregiver", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        useApp.getState().bumpData();
        if (d.status !== "pending") onCaregiverDecision(d);
      });
      es.addEventListener("reset", () => {
        useApp.getState().bumpData();
        useApp.getState().bumpReceipts();
      });
    } catch {}
    return () => es?.close();
  }, []);

  // idle > 2 min → Milo sleeps
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      milo.set("sleep", false);
      clearTimeout(t);
      t = setTimeout(() => milo.set("sleep", true), 120000);
    };
    wake();
    ["keydown", "pointermove", "pointerdown"].forEach((ev) => window.addEventListener(ev, wake));
    return () => ["keydown", "pointermove", "pointerdown"].forEach((ev) => window.removeEventListener(ev, wake));
  }, []);

  if (NO_CHROME.some((p) => path.startsWith(p))) {
    return (
      <>
        {children}
        <LiveRegion />
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-bg focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ReceiptsToggle />
        <main id="main" className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-8 pt-14">
          <div className="flex-1 pb-6">{children}</div>
          <Dock />
        </main>
      </div>
      <ReceiptsPanel />
      {mode === "head" && <HeadBoard />}
      {mode === "sign" && <SignInput />}
      <ConfirmBar />
      <SpeakOverlay />
      <VerifyModal />
      <DirectorPanel />
      <LiveRegion />
    </div>
  );
}

function ReceiptsToggle() {
  const open = useApp((s) => s.receiptsOpen);
  const setOpen = useApp((s) => s.setReceiptsOpen);
  return (
    <div className="no-print fixed right-5 top-4 z-40">
      <button
        data-head-target
        aria-label={open ? "Close receipts" : "Open receipts"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="min-h-[48px] rounded-full border-2 border-border bg-surface px-5 text-[15px] font-semibold shadow-soft hover:border-accent/40 data-[head-hover=true]:ring-[3px] data-[head-hover=true]:ring-accent"
      >
        🧾 Receipts
      </button>
    </div>
  );
}
