"use client";
import { useEffect, useRef, useState } from "react";
import { milo } from "@/components/milo/useMilo";
import { Gestures } from "@/lib/head/gestures";
import { faceTracker, HeadFrame } from "@/lib/head/faceTracker";
import { useApp } from "@/lib/store";

const RING = 40;
const R = RING / 2 - 3;
const C = 2 * Math.PI * R;

/**
 * Head cursor: hit-tests [data-head-target] under the cursor, dwell = select,
 * nod = select now, shake = "not this"/back. Works on any element on the page.
 */
export function HeadPointer({
  onShake,
  onNodNoTarget,
  onFace,
  enabled = true,
}: {
  onShake?: () => void;
  onNodNoTarget?: () => void;
  onFace?: (visible: boolean) => void;
  enabled?: boolean;
}) {
  const cursor = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const dwellMs = useApp((s) => s.settings.dwellMs);
  const settings = useApp((s) => s.settings);
  const handlers = useRef({ onShake, onNodNoTarget, onFace });
  handlers.current = { onShake, onNodNoTarget, onFace };
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!faceTracker) return;
    faceTracker.sensitivity = settings.headSensitivity;
    faceTracker.invertX = settings.invertX;
    faceTracker.invertY = settings.invertY;
  }, [settings.headSensitivity, settings.invertX, settings.invertY]);

  useEffect(() => {
    if (!enabled || !faceTracker) return;
    const g = new Gestures();
    let cur: HTMLElement | null = null;
    let dwellStart = 0;
    let cooldownUntil = 0;
    let noFaceSince: number | null = null;
    let faceShown = true;

    const setHover = (el: HTMLElement | null, t: number) => {
      if (el === cur) return;
      cur?.removeAttribute("data-head-hover");
      cur = el;
      cur?.setAttribute("data-head-hover", "true");
      dwellStart = t;
    };
    const select = (el: HTMLElement, t: number) => {
      cooldownUntil = t + 400;
      dwellStart = t + 400;
      el.click();
    };

    const unsub = faceTracker.subscribe((f: HeadFrame) => {
      if (!f.face) {
        noFaceSince ??= f.t;
        if (faceShown && f.t - noFaceSince > 2000) {
          faceShown = false;
          setVisible(false);
          handlers.current.onFace?.(false);
          milo.set("sleep", true);
          useApp.getState().announce("I can't see you — move into the camera view.");
        }
        return;
      }
      noFaceSince = null;
      if (!faceShown) {
        faceShown = true;
        setVisible(true);
        handlers.current.onFace?.(true);
        milo.set("sleep", false);
      }
      const W = window.innerWidth, H = window.innerHeight;
      const x = Math.max(4, Math.min(W - 4, f.nx * W));
      const y = Math.max(4, Math.min(H - 4, f.ny * H));
      if (cursor.current) cursor.current.style.transform = `translate(${x - RING / 2}px, ${y - RING / 2}px)`;

      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest("[data-head-target]") as HTMLElement | null;
      const usable = el && !(el as HTMLButtonElement).disabled ? el : null;
      setHover(usable, f.t);

      const progress = cur && f.t > cooldownUntil ? (f.t - dwellStart) / (useApp.getState().settings.dwellMs || dwellMs) : 0;
      if (ring.current) ring.current.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, progress))));
      if (cur && progress >= 1) select(cur, f.t);

      const gesture = g.update(f.rx, f.ry, f.t);
      if (gesture === "nod") {
        if (cur && f.t > cooldownUntil) select(cur, f.t);
        else handlers.current.onNodNoTarget?.();
      } else if (gesture === "shake") {
        cooldownUntil = f.t + 600;
        handlers.current.onShake?.();
      }
    });
    return () => {
      unsub();
      cur?.removeAttribute("data-head-hover");
    };
  }, [enabled, dwellMs]);

  if (!enabled) return null;
  return (
    <div
      ref={cursor}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[95]"
      style={{ width: RING, height: RING, transform: "translate(-100px,-100px)", opacity: visible ? 1 : 0.2, transition: "opacity 200ms" }}
    >
      <svg width={RING} height={RING} className="absolute inset-0">
        <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="rgba(35,131,226,.18)" strokeWidth={3} />
        <circle
          ref={ring}
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeDasharray={C}
          strokeDashoffset={C}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </svg>
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-soft" />
    </div>
  );
}

/** Small mirrored self-view (120×90) with a face outline. */
export function SelfView({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let alive = true;
    const attach = () => {
      const src = faceTracker?.getVideo()?.srcObject;
      if (src && ref.current && ref.current.srcObject !== src) {
        ref.current.srcObject = src;
        ref.current.play().catch(() => {});
      }
      if (alive && !src) setTimeout(attach, 300);
    };
    attach();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className={`relative h-[90px] w-[120px] overflow-hidden rounded bg-surface ${className}`} aria-label="Camera self-view (stays on this device)" role="img">
      <video ref={ref} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
      <svg viewBox="0 0 120 90" className="absolute inset-0" aria-hidden>
        <ellipse cx="60" cy="44" rx="24" ry="31" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
    </div>
  );
}
