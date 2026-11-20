"use client";
import { useEffect, useRef, useState } from "react";
import { milo } from "@/components/milo/useMilo";
import { Gestures } from "@/lib/head/gestures";
import { faceTracker, HeadFrame } from "@/lib/head/faceTracker";
import { useApp } from "@/lib/store";
import { chime, soften } from "@/lib/sounds";

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
      chime();
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
        soften();
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

/**
 * Mirrored self-view with a live overlay: face-mesh dots, the nose tip (the pointer),
 * and a 6×5 grid showing which cell of the board the nose is pointing at.
 */
export function SelfView({ className = "", width = 240, height = 180 }: { className?: string; width?: number; height?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
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
    const unsub = faceTracker?.subscribe((f) => {
      const c = canvas.current;
      if (!c) return;
      const g = c.getContext("2d")!;
      const W = c.width, H = c.height;
      g.clearRect(0, 0, W, H);
      // grid matrix (6 × 5, like the letter board)
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = 1;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((i * W) / 6, 0); g.lineTo((i * W) / 6, H); g.stroke(); }
      for (let j = 1; j < 5; j++) { g.beginPath(); g.moveTo(0, (j * H) / 5); g.lineTo(W, (j * H) / 5); g.stroke(); }
      if (!f.face || !f.landmarks) return;
      // highlighted cell = where the cursor is on screen
      const cx = Math.max(0, Math.min(5, Math.floor(f.nx * 6)));
      const cy = Math.max(0, Math.min(4, Math.floor(f.ny * 5)));
      g.fillStyle = "rgba(194,65,12,.28)";
      g.fillRect((cx * W) / 6, (cy * H) / 5, W / 6, H / 5);
      // face mesh (sparse)
      g.fillStyle = "rgba(255,255,255,.75)";
      for (let i = 0; i < f.landmarks.length; i += 6) {
        const p = f.landmarks[i];
        g.fillRect((1 - p.x) * W - 1, p.y * H - 1, 2, 2);
      }
      // nose tip = pointer
      const n = f.landmarks[1];
      const nx = (1 - n.x) * W, ny = n.y * H;
      g.fillStyle = "#c2410c";
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.beginPath(); g.arc(nx, ny, 6, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);
  return (
    <div
      className={`relative overflow-hidden rounded-lg border-2 border-surface bg-ink shadow-lift ${className}`}
      style={{ width, height }}
      aria-label="Camera self-view with nose pointer (video stays on this device)"
      role="img"
    >
      <video ref={ref} muted playsInline className="h-full w-full -scale-x-100 object-cover opacity-80" />
      <canvas ref={canvas} width={width} height={height} className="absolute inset-0" aria-hidden />
    </div>
  );
}
