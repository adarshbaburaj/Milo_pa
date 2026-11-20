"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { MILO_IMAGES } from "./images";
import { MiloState, miloLabel, useMiloState, useMiloStore } from "./useMilo";

/**
 * Milo — an original 8-bit blob drawn on a 12×12 pixel grid (pure SVG, no assets).
 * viewBox has 3px of margin around the 12×12 body for waves, dots, "?", "z" and confetti.
 */

const INK = "var(--milo-ink)";
const BODY = "var(--milo)";
const SHADE = "var(--milo-shade)";

function Px({ x, y, w = 1, h = 1, fill = INK, opacity }: { x: number; y: number; w?: number; h?: number; fill?: string; opacity?: number }) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} opacity={opacity} />;
}

// body rows (x0, x1 inclusive) for y = 0..11 — a soft rounded square with little feet
const BODY_ROWS: [number, number][] = [
  [3, 8], [2, 9], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [2, 9],
];

function Body() {
  return (
    <g>
      {BODY_ROWS.map(([a, b], y) => (
        <rect key={y} x={a} y={y} width={b - a + 1} height={1} fill={y === BODY_ROWS.length - 1 ? SHADE : BODY} />
      ))}
      {/* pixel feet */}
      <Px x={3} y={10} w={2} fill={SHADE} />
      <Px x={7} y={10} w={2} fill={SHADE} />
      {/* cheek blush */}
      <Px x={2} y={6} fill="#F7A9A0" opacity={0.7} />
      <Px x={9} y={6} fill="#F7A9A0" opacity={0.7} />
    </g>
  );
}

function Eyes({ state, blink }: { state: MiloState; blink: boolean }) {
  if (state === "sleep" || blink) {
    return (
      <g>
        <Px x={3} y={4} w={2} />
        <Px x={7} y={4} w={2} />
      </g>
    );
  }
  if (state === "listening") {
    return (
      <g>
        <Px x={2} y={2} w={3} h={3} />
        <Px x={7} y={2} w={3} h={3} />
        <Px x={3} y={2} fill="#fff" />
        <Px x={8} y={2} fill="#fff" />
      </g>
    );
  }
  let dx = 0, dy = 0;
  if (state === "thinking") { dx = 1; dy = -1; }
  if (state === "waiting") dy = 1;
  if (state === "happy" || state === "celebrate") {
    // ^ ^ eyes
    return (
      <g>
        <Px x={3} y={3} /><Px x={4} y={2} /><Px x={5} y={3} />
        <Px x={6} y={3} /><Px x={7} y={2} /><Px x={8} y={3} />
      </g>
    );
  }
  return (
    <g>
      <Px x={3 + dx} y={3 + dy} w={2} h={2} />
      <Px x={7 + dx} y={3 + dy} w={2} h={2} />
    </g>
  );
}

function Mouth({ state, open }: { state: MiloState; open: boolean }) {
  if (state === "speaking" && open) return <Px x={5} y={6} w={2} h={2} fill="#B5473A" />;
  if (state === "happy" || state === "celebrate")
    return (
      <g>
        <Px x={4} y={6} /><Px x={5} y={7} w={2} /><Px x={7} y={6} />
      </g>
    );
  if (state === "confused") return <Px x={6} y={7} w={2} />;
  if (state === "sleep") return <Px x={5} y={7} w={2} opacity={0.6} />;
  return <Px x={5} y={7} w={2} />;
}

const CONFETTI = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { dx: Math.cos(a) * 9, dy: Math.sin(a) * 8 - 3, c: i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? BODY : "var(--success)" };
});

export function Milo({ size = 48, state: forced, className = "", label = true }: { size?: number; state?: MiloState; className?: string; label?: boolean }) {
  const live = useMiloState();
  const state = forced ?? live;
  const mouthOpen = useMiloStore((s) => s.mouthOpen);
  const transientKey = useMiloStore((s) => s.transientKey);
  const sysReduced = useReducedMotion();
  const pref = useApp((s) => s.settings.reducedMotion);
  const reduced = pref === "on" || (pref === "system" && !!sysReduced);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        loop();
      }, 4000 + Math.random() * 2000);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  const bodyAnim = useMemo((): { animate: any; transition: any } => {
    if (reduced) return { animate: { y: 0, scaleY: 1, scale: 1, rotate: state === "confused" ? 8 : 0 }, transition: { duration: 0.15 } };
    switch (state) {
      case "idle":
      case "sleep":
        return { animate: { scale: [1, 1.03, 1], y: 0, rotate: 0 }, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } };
      case "happy":
        return { animate: { y: [0, -14, 0, 0], scaleY: [1, 1.05, 0.9, 1], rotate: 0 }, transition: { duration: 0.4, times: [0, 0.45, 0.8, 1] } };
      case "celebrate":
        return { animate: { y: [0, -14, 0, -10, 0], scaleY: [1, 1.05, 0.9, 1.04, 1], rotate: 0 }, transition: { duration: 0.9 } };
      case "confused":
        return { animate: { rotate: 8, y: 0 }, transition: { type: "spring", stiffness: 300, damping: 12 } };
      case "thinking":
        return { animate: { rotate: [0, -2, 0], y: 0 }, transition: { duration: 1.6, repeat: Infinity } };
      default:
        return { animate: { y: 0, rotate: 0, scale: 1 }, transition: { duration: 0.2 } };
    }
  }, [state, reduced]);

  // viewBox: body occupies 0..12 x 0..11; margins for effects
  const vb = "-4 -5 20 18";
  const px = size / 12; // css px per grid unit (approx, body width)
  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label ? miloLabel(state) : undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg
        viewBox={vb}
        width={size * (20 / 12)}
        height={size * (18 / 12)}
        style={{ position: "absolute", left: -4 * px, top: -5 * px, overflow: "visible" }}
        shapeRendering="crispEdges"
      >
        <motion.g
          key={state === "happy" || state === "celebrate" ? `${state}-${transientKey}` : "body"}
          style={{ originX: 0.5, originY: 1 }}
          initial={false}
          {...bodyAnim}
        >
          {(() => {
            const img =
              (state === "speaking" && mouthOpen && MILO_IMAGES.speakingOpen) || MILO_IMAGES[state] || MILO_IMAGES.idle;
            if (img) return <image href={img} x={0} y={-1} width={12} height={12} preserveAspectRatio="xMidYMid meet" style={{ imageRendering: "pixelated" }} />;
            return (
              <>
                <Body />
                <Eyes state={state} blink={blink && state !== "listening"} />
                <Mouth state={state} open={mouthOpen} />
              </>
            );
          })()}
        </motion.g>

        {state === "listening" &&
          [0, 1].map((i) => (
            <motion.g key={i} animate={reduced ? { opacity: 1 } : { opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}>
              <Px x={-1 - i * 2} y={3 - i} h={3 + i * 2} fill="var(--accent)" />
              <Px x={12 + i * 2} y={3 - i} h={3 + i * 2} fill="var(--accent)" />
            </motion.g>
          ))}

        {state === "thinking" &&
          [0, 1, 2].map((i) => (
            <motion.rect
              key={i}
              x={3 + i * 2.5}
              y={-3}
              width={1}
              height={1}
              fill="var(--text-muted)"
              animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
            />
          ))}

        {state === "confused" && (
          <g fill="var(--text-muted)">
            <Px x={10} y={-5} w={2} fill="var(--text-muted)" />
            <Px x={12} y={-4} fill="var(--text-muted)" />
            <Px x={11} y={-3} fill="var(--text-muted)" />
            <Px x={11} y={-1} fill="var(--text-muted)" />
          </g>
        )}

        {state === "sleep" && (
          <motion.g animate={reduced ? {} : { y: [0, -1, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.4, repeat: Infinity }}>
            <Px x={11} y={-4} w={3} fill="var(--text-muted)" />
            <Px x={12} y={-3} fill="var(--text-muted)" />
            <Px x={11} y={-2} w={3} fill="var(--text-muted)" />
          </motion.g>
        )}

        {state === "happy" && !reduced && (
          <motion.g key={`sp-${transientKey}`} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 1] }} transition={{ duration: 0.6 }}>
            <Px x={12} y={-2} fill="var(--milo-shade)" />
            <Px x={13} y={-3} fill="var(--accent)" />
            <Px x={11} y={-3} fill="var(--milo-shade)" />
          </motion.g>
        )}

        {state === "celebrate" && !reduced &&
          CONFETTI.map((c, i) => (
            <motion.rect
              key={`${transientKey}-${i}`}
              x={5.5}
              y={4}
              width={1}
              height={1}
              fill={c.c}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: c.dx, y: c.dy + 6, opacity: [1, 1, 0] }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ))}
      </svg>
    </div>
  );
}

export default Milo;
