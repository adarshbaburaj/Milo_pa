"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { milo } from "@/components/milo/useMilo";
import { computeCalibration, saveCalibration } from "@/lib/head/calibration";
import { faceTracker, HeadFrame } from "@/lib/head/faceTracker";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui";
import { HeadPointer } from "./HeadPointer";

type P = { yaw: number; pitch: number };
const CORNERS = [
  { key: "tl", x: 0.1, y: 0.1 },
  { key: "tr", x: 0.9, y: 0.1 },
  { key: "br", x: 0.9, y: 0.9 },
  { key: "bl", x: 0.1, y: 0.9 },
] as const;

function avg(ps: P[]): P {
  const n = Math.max(1, ps.length);
  return { yaw: ps.reduce((a, p) => a + p.yaw, 0) / n, pitch: ps.reduce((a, p) => a + p.pitch, 0) / n };
}

/**
 * 1. look at Milo in the middle (1.5 s) → neutral
 * 2. Milo hops to 4 corners (1.2 s each) → range → gains
 * 3. choose the star ⭐ (missed twice → reduce sensitivity)
 */
export function Calibrate({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [step, setStep] = useState<"start" | "neutral" | "corners" | "test" | "done" | "error">("start");
  const [corner, setCorner] = useState(0);
  const [msg, setMsg] = useState("");
  const [starPos, setStarPos] = useState({ x: 0.7, y: 0.35 });
  const samples = useRef<P[]>([]);
  const latest = useRef<HeadFrame | null>(null);
  const misses = useRef(0);

  useEffect(() => {
    if (!faceTracker) return;
    const unsub = faceTracker.subscribe((f) => {
      latest.current = f;
      if (f.face && f.raw) samples.current.push({ yaw: f.raw.yaw, pitch: f.raw.pitch });
    });
    return () => {
      unsub();
    };
  }, []);

  const begin = async () => {
    try {
      milo.set("listening", true);
      await faceTracker.start();
      useApp.getState().setHeadReady(true);
    } catch {
      setStep("error");
      setMsg(faceTracker?.error || "Couldn't start the camera.");
      return;
    }
    faceTracker.setCalibration(null);
    setStep("neutral");
    useApp.getState().announce("Look at Milo in the middle and hold still.");
    await new Promise((r) => setTimeout(r, 500));
    samples.current = [];
    await new Promise((r) => setTimeout(r, 1500));
    const neutral = avg(samples.current);
    setStep("corners");
    const pts: Record<string, P> = {};
    for (let i = 0; i < CORNERS.length; i++) {
      setCorner(i);
      milo.react("happy");
      await new Promise((r) => setTimeout(r, 600));
      samples.current = [];
      await new Promise((r) => setTimeout(r, 600));
      pts[CORNERS[i].key] = avg(samples.current);
    }
    const src = latest.current?.raw?.source ?? "matrix";
    const c = computeCalibration(src, neutral, pts as any);
    faceTracker.setCalibration(c);
    saveCalibration(c);
    setStep("test");
    useApp.getState().announce("Try it: choose the star.");
  };

  // test target timeout → miss
  useEffect(() => {
    if (step !== "test") return;
    const t = setTimeout(() => {
      misses.current += 1;
      if (misses.current >= 2) {
        const s = useApp.getState().settings.headSensitivity;
        useApp.getState().setSettings({ headSensitivity: Math.max(0.5, +(s * 0.8).toFixed(2)) });
        setMsg("I made the cursor a little calmer for you.");
        misses.current = 0;
      }
      setStarPos({ x: 0.25 + Math.random() * 0.5, y: 0.25 + Math.random() * 0.4 });
    }, 7000);
    return () => clearTimeout(t);
  }, [step, starPos]);

  const hit = () => {
    milo.react("celebrate");
    setStep("done");
    useApp.getState().announce("Calibrated. Nice!");
    setTimeout(onDone, 900);
  };

  const c = CORNERS[corner];
  return (
    <div className="fixed inset-0 z-[90] bg-bg" role="dialog" aria-modal="true" aria-label="Head calibration">
      {step === "start" && (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
          <Milo size={96} />
          <h2 className="text-[32px] font-semibold">Let’s calibrate head mode</h2>
          <p className="max-w-md text-muted">Sit comfortably. Milo follows your nose. Look at me in the middle, then point your nose at me in each corner. Video stays on this device.</p>
          <div className="flex gap-3">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Not now</Button>}
            <Button variant="primary" onClick={begin}>Start camera</Button>
          </div>
        </div>
      )}
      {step === "error" && (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <Milo size={96} state="confused" />
          <p className="text-lg">{msg}</p>
          <p className="text-muted">Allow camera access in Chrome’s address bar, then try again.</p>
          <div className="flex gap-3">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Close</Button>}
            <Button variant="primary" onClick={begin}>Try again</Button>
          </div>
        </div>
      )}
      {step === "neutral" && (
        <div className="flex h-full flex-col items-center justify-center gap-6">
          <Milo size={96} state="listening" />
          <p className="text-xl">Look at Milo in the middle and hold still.</p>
        </div>
      )}
      {step === "corners" && (
        <>
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl">Point your nose at Milo — move your head gently.</p>
          <motion.div
            className="absolute"
            animate={{ left: `calc(${c.x * 100}% - 48px)`, top: `calc(${c.y * 100}% - 48px)` }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Milo size={96} />
          </motion.div>
        </>
      )}
      {(step === "test" || step === "done") && (
        <>
          <div className="absolute left-1/2 top-16 -translate-x-1/2 text-center">
            <p className="text-xl">Try it: choose the star ⭐</p>
            <p className="text-sm text-muted">Hold the cursor on it, or nod. {msg}</p>
          </div>
          <button
            data-head-target
            aria-label="Star target"
            onClick={hit}
            className="absolute flex h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-surface text-6xl data-[head-hover=true]:bg-accent-soft data-[head-hover=true]:ring-2 data-[head-hover=true]:ring-accent"
            style={{ left: `${starPos.x * 100}%`, top: `${starPos.y * 100}%` }}
          >
            ⭐
          </button>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <Milo size={64} />
          </div>
          <HeadPointer />
        </>
      )}
      {onCancel && step !== "start" && step !== "error" && (
        <button onClick={onCancel} className="absolute right-4 top-4 rounded px-3 py-1.5 text-sm text-muted hover:bg-surface">
          Skip
        </button>
      )}
    </div>
  );
}
