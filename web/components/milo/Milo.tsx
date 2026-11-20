"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { BODY, CONFETTI, FRAMES, FX, Frame, THINK_DOTS } from "./images";
import { MiloState, miloLabel, useMiloState, useMiloStore } from "./useMilo";

/**
 * Milo, the soft yellow mascot. Every frame shares one canvas, so swapping frames never shifts the body.
 *  - frames cross-fade (new frame fades in over the old one, so the body never goes see-through),
 *  - mouth and blink swaps are near-instant so talking looks crisp,
 *  - the whole body breathes / hops / tilts with squash-and-stretch from the feet,
 *  - effects (?, z, waves, dots, confetti) move on their own layers,
 *  - reduced motion → frames still change, nothing moves.
 */

const FRAME_OF: Record<MiloState, Frame> = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  happy: "happy",
  speaking: "idle",
  confused: "confused",
  celebrate: "celebrate",
  waiting: "waiting",
  sleep: "sleep",
};
const FAST: Frame[] = ["idle", "talk", "blink", "waiting"]; // same face shape → instant swap
const CAN_BLINK: MiloState[] = ["idle", "waiting", "speaking"];
const ALL_FRAMES = Object.keys(FRAMES) as Frame[];
const SOFT = [0.45, 0, 0.55, 1] as const; // gentle in-out

function useBlink(enabled: boolean) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let t: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        t2 = setTimeout(() => setBlink(false), 130);
        // now and then a double blink, like people do
        if (Math.random() < 0.2) setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 110); }, 260);
        loop();
      }, 3200 + Math.random() * 3000);
    };
    loop();
    return () => { clearTimeout(t); clearTimeout(t2); setBlink(false); };
  }, [enabled]);
  return blink;
}

export function Milo({ size = 48, state: forced, className = "", label = true }: { size?: number; state?: MiloState; className?: string; label?: boolean }) {
  const live = useMiloState();
  const state = forced ?? live;
  const mouthOpen = useMiloStore((s) => s.mouthOpen) && !forced;
  const transientKey = useMiloStore((s) => s.transientKey);
  const sysReduced = useReducedMotion();
  const pref = useApp((s) => s.settings.reducedMotion);
  const reduced = pref === "on" || (pref === "system" && !!sysReduced);
  const blink = useBlink(CAN_BLINK.includes(state));

  const frame: Frame = state === "speaking" && mouthOpen ? "talk" : blink && CAN_BLINK.includes(state) ? "blink" : FRAME_OF[state];

  // keep the previous frame fully visible underneath while the new one fades in
  const [under, setUnder] = useState<Frame>(frame);
  const prev = useRef<Frame>(frame);
  const fast = FAST.includes(frame) && FAST.includes(prev.current);
  useEffect(() => {
    if (prev.current === frame) return;
    setUnder(prev.current);
    prev.current = frame;
    const t = setTimeout(() => setUnder(frame), 220);
    return () => clearTimeout(t);
  }, [frame]);

  // canvas is bigger than the body: scale it so the body fills `size` and sits on the bottom edge
  const canvas = (size * 100) / BODY.width;
  const left = -(BODY.left / 100) * canvas;
  const top = size - (BODY.bottom / 100) * canvas;
  const hop = size * 0.16;

  const body = useMemo((): { animate: any; transition: any } => {
    if (reduced) return { animate: { y: 0, scaleX: 1, scaleY: 1, rotate: state === "confused" ? 6 : 0 }, transition: { duration: 0.2 } };
    switch (state) {
      case "idle":
        return { animate: { scaleY: [1, 1.022, 1], scaleX: [1, 0.992, 1], y: 0, rotate: 0 }, transition: { duration: 3.6, repeat: Infinity, ease: SOFT } };
      case "sleep":
        return { animate: { scaleY: [1, 1.035, 1], scaleX: [1, 0.988, 1], y: 0, rotate: 0 }, transition: { duration: 4.8, repeat: Infinity, ease: SOFT } };
      case "waiting":
        return { animate: { y: [0, -size * 0.03, 0], scaleY: 1, scaleX: 1, rotate: 0 }, transition: { duration: 1.8, repeat: Infinity, ease: SOFT } };
      case "listening":
        return { animate: { rotate: [-2.5, 2.5, -2.5], y: 0, scaleY: [1, 1.015, 1], scaleX: 1 }, transition: { duration: 2.4, repeat: Infinity, ease: SOFT } };
      case "thinking":
        return { animate: { rotate: [0, -4, 0], y: 0, scaleY: 1, scaleX: 1 }, transition: { duration: 2.6, repeat: Infinity, ease: SOFT } };
      case "speaking":
        return { animate: { scaleY: [1, 1.025, 0.99, 1], scaleX: [1, 0.99, 1.008, 1], y: 0, rotate: 0 }, transition: { duration: 0.5, repeat: Infinity, ease: SOFT } };
      case "happy":
        // anticipation squash → hop with stretch → soft landing squash → settle
        return {
          animate: { y: [0, 0, -hop, 0, 0], scaleY: [1, 0.9, 1.06, 0.93, 1], scaleX: [1, 1.07, 0.96, 1.05, 1], rotate: 0 },
          transition: { duration: 0.62, times: [0, 0.14, 0.5, 0.78, 1], ease: "easeOut" },
        };
      case "celebrate":
        return {
          animate: {
            y: [0, 0, -hop * 1.2, 0, -hop * 0.7, 0, 0],
            scaleY: [1, 0.88, 1.07, 0.92, 1.04, 0.96, 1],
            scaleX: [1, 1.08, 0.95, 1.06, 0.97, 1.03, 1],
            rotate: [0, 0, -3, 0, 3, 0, 0],
          },
          transition: { duration: 1.1, times: [0, 0.1, 0.32, 0.5, 0.68, 0.84, 1], ease: "easeOut" },
        };
      case "confused":
        return { animate: { rotate: 7, y: 0, scaleY: 1, scaleX: 1 }, transition: { type: "spring", stiffness: 260, damping: 14 } };
      default:
        return { animate: { y: 0, rotate: 0, scaleY: 1, scaleX: 1 }, transition: { duration: 0.25 } };
    }
  }, [state, reduced, hop, size]);

  const bodyKey = state === "happy" || state === "celebrate" ? `${state}-${transientKey}` : state;
  const pct = (v: number) => `${v}%`;

  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label ? miloLabel(state) : undefined}
      aria-hidden={label ? undefined : true}
    >
      <div className="pointer-events-none absolute" style={{ left, top, width: canvas, height: canvas }}>
        {/* soft ground shadow — shrinks while Milo is in the air */}
        <motion.div
          className="absolute rounded-[50%]"
          style={{ left: pct(26), width: pct(48), top: pct(86.5), height: pct(3.5), background: "rgba(120, 80, 20, .16)", filter: "blur(2px)" }}
          key={`sh-${bodyKey}`}
          animate={
            reduced
              ? {}
              : state === "happy"
                ? { scaleX: [1, 1, 0.7, 1, 1], opacity: [1, 1, 0.55, 1, 1] }
                : state === "celebrate"
                  ? { scaleX: [1, 1, 0.65, 1, 0.8, 1, 1], opacity: [1, 1, 0.5, 1, 0.7, 1, 1] }
                  : { scaleX: 1, opacity: 1 }
          }
          transition={body.transition.times ? { duration: body.transition.duration, times: body.transition.times } : { duration: 0.3 }}
        />

        {/* body frames, all preloaded and stacked */}
        <motion.div
          key={bodyKey}
          className="absolute inset-0"
          style={{ originX: 0.5, originY: BODY.bottom / 100 }}
          initial={false}
          {...body}
        >
          {ALL_FRAMES.map((f) => {
            const on = f === frame;
            const visible = on || f === under;
            return (
              <img
                key={f}
                src={FRAMES[f]}
                alt=""
                draggable={false}
                decoding="async"
                className="absolute inset-0 h-full w-full"
                style={{
                  opacity: visible ? 1 : 0,
                  zIndex: on ? 2 : 1,
                  transition: on && !reduced ? `opacity ${fast ? 50 : 180}ms ease-out` : "none",
                }}
              />
            );
          })}
        </motion.div>

        {/* effects */}
        <AnimatePresence>
          {state === "listening" && (
            <motion.div key="waves" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {(["wavesLeft", "wavesRight"] as const).map((w, i) => (
                <motion.img
                  key={w}
                  src={FX[w]}
                  alt=""
                  className="absolute inset-0 h-full w-full"
                  animate={reduced ? {} : { x: [0, (i ? 1 : -1) * size * 0.05, 0], opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: SOFT, delay: i * 0.12 }}
                />
              ))}
            </motion.div>
          )}

          {state === "thinking" && (
            <motion.div key="dots" className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {THINK_DOTS.map((d, i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-full"
                  style={{ left: pct(d.x - d.d / 2), top: pct(d.y - d.d / 2), width: pct(d.d), height: pct(d.d), background: d.color }}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={reduced ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.6], y: [0, -size * 0.02, 0, 0] }}
                  transition={reduced ? { duration: 0.2 } : { duration: 1.5, repeat: Infinity, delay: i * 0.22, times: [0, 0.25, 0.7, 1], ease: SOFT }}
                />
              ))}
            </motion.div>
          )}

          {state === "confused" && (
            <motion.img
              key="q"
              src={FX.question}
              alt=""
              className="absolute inset-0 h-full w-full"
              style={{ originX: 0.5, originY: 0.22 }}
              initial={{ opacity: 0, scale: 0.3, y: size * 0.06 }}
              animate={reduced ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, scale: 1, y: [0, -size * 0.03, 0], rotate: [0, 8, -4, 0] }}
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 380, damping: 16, y: { duration: 1.4, repeat: Infinity, ease: SOFT, delay: 0.3 }, rotate: { duration: 0.6, delay: 0.1 } }}
            />
          )}

          {state === "sleep" && (
            <motion.div key="z" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0, 1].map((i) =>
                reduced ? (
                  i === 0 && <img key={i} src={FX.z} alt="" className="absolute inset-0 h-full w-full" />
                ) : (
                  <motion.img
                    key={i}
                    src={FX.z}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    style={{ originX: 0.5, originY: 0.2 }}
                    animate={{ y: [size * 0.08, -size * 0.12], x: [0, size * (0.06 + i * 0.05)], opacity: [0, 1, 0], scale: [0.6, i ? 0.8 : 1.15] }}
                    transition={{ duration: 3.2, repeat: Infinity, delay: i * 1.6, ease: "easeOut", times: [0, 0.35, 1] } as any}
                  />
                ),
              )}
            </motion.div>
          )}

          {state === "celebrate" &&
            CONFETTI.map((c, i) => (
              <motion.span
                key={`${transientKey}-${i}`}
                className="absolute rounded-[3px]"
                style={{ left: pct(c.x - c.s / 2), top: pct(c.y - c.s / 2), width: pct(c.s), height: pct(c.s), background: c.color }}
                initial={reduced ? { opacity: 1, rotate: c.r } : { opacity: 0, x: ((50 - c.x) / 100) * canvas, y: ((45 - c.y) / 100) * canvas, scale: 0.2, rotate: 0 }}
                animate={
                  reduced
                    ? { opacity: 1, rotate: c.r }
                    : { opacity: [0, 1, 1, 0], x: 0, y: [((45 - c.y) / 100) * canvas, 0, size * 0.04, size * 0.12], scale: 1, rotate: c.r + (i % 2 ? -200 : 200) }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, ease: [0.16, 0.9, 0.3, 1], times: [0, 0.3, 0.7, 1] } as any}
              />
            ))}

          {state === "happy" && !reduced &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={`${transientKey}-sp${i}`}
                className="absolute rounded-full"
                style={{ left: pct(22 + i * 26), top: pct(24 - (i === 1 ? 6 : 0)), width: pct(2.6), height: pct(2.6), background: i === 1 ? "#f7c336" : "#f4a48f" }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0.8], y: [0, -size * 0.1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.05, ease: "easeOut" }}
              />
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Milo;
