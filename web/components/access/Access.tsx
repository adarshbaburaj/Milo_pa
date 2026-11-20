"use client";
// Universal access layer: works on every screen, for people who can't click, can't speak, or can't hear.
//  • Scanner     — options light up one by one; ANY single switch (Space / Enter / a click on empty space) picks it
//  • HoverDwell  — resting a pointer (mouse, trackball, eye-gaze device) on a button picks it
//  • Captions    — everything Milo says out loud is also shown as text
//  • VisualAlert — a screen-edge flash/glow instead of sound when Milo replies
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";

const TARGET = "[data-head-target]";

function visible(el: HTMLElement) {
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.closest("[aria-hidden='true']")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
}

/** The current scan scope: topmost [data-scan-scope] (dialogs, confirm bar), else the whole page. */
function scanItems(): HTMLElement[] {
  const scopes = Array.from(document.querySelectorAll<HTMLElement>("[data-scan-scope]")).filter((s) => s.getBoundingClientRect().height > 0);
  const scope = scopes.length ? scopes[scopes.length - 1] : document.body;
  return Array.from(scope.querySelectorAll<HTMLElement>(TARGET)).filter(visible);
}

function isTextField(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function Scanner({ force = false }: { force?: boolean }) {
  const enabled = useApp((s) => s.settings.scanning);
  const scanMs = useApp((s) => s.settings.scanMs);
  const mode = useApp((s) => s.mode);
  const on = (force || enabled) && mode !== "head" && mode !== "sign";
  const [rect, setRect] = useState<DOMRect | null>(null);
  const idx = useRef(-1);
  const cur = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!on) {
      setRect(null);
      return;
    }
    const highlight = (el: HTMLElement | null) => {
      cur.current?.removeAttribute("data-head-hover");
      cur.current = el;
      if (el) {
        el.setAttribute("data-head-hover", "true");
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setRect(el.getBoundingClientRect());
      } else setRect(null);
    };
    const step = () => {
      const items = scanItems();
      if (!items.length) return highlight(null);
      const at = cur.current ? items.indexOf(cur.current) : -1;
      idx.current = (at + 1) % items.length;
      highlight(items[idx.current]);
    };
    let timer = setInterval(step, scanMs);
    const restart = () => {
      clearInterval(timer);
      timer = setInterval(step, scanMs);
    };
    const pick = () => {
      const el = cur.current;
      if (!el || !document.contains(el)) return step();
      el.click();
      // after a pick the screen usually changes — start again from the top of the new scope
      setTimeout(() => {
        highlight(null);
        restart();
        step();
      }, 350);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTextField(e.target) || e.repeat) return;
      // Enter on a button the person tabbed to keeps its normal meaning
      const active = document.activeElement as HTMLElement | null;
      if (e.key === "Enter" && active && active !== document.body && active.matches(TARGET)) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        pick();
      }
    };
    // a click/tap on empty space is also a "switch" press
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(TARGET) || isTextField(t) || t.closest("input,select,textarea,a,button,label")) return;
      e.preventDefault();
      pick();
    };
    const onResize = () => cur.current && setRect(cur.current.getBoundingClientRect());
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onResize, true);
    step();
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onResize, true);
      cur.current?.removeAttribute("data-head-hover");
      cur.current = null;
    };
  }, [on, scanMs]);

  if (!on || !rect) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[96] rounded-[22px] border-[4px] border-accent transition-all duration-200"
      style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 6px rgba(194,65,12,.18)" }}
    />
  );
}

export function HoverDwell({ force = false }: { force?: boolean }) {
  const enabled = useApp((s) => s.settings.hoverDwell);
  const dwellMs = useApp((s) => s.settings.dwellMs);
  const mode = useApp((s) => s.mode);
  const on = (force || enabled) && mode !== "head";
  const ring = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!on) return;
    let target: HTMLElement | null = null;
    let start = 0;
    let raf = 0;
    let x = -100, y = -100;
    let cooldown = 0;
    const C = 2 * Math.PI * 17;
    const tick = () => {
      const now = performance.now();
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest(TARGET) as HTMLElement | null;
      const usable = el && !(el as HTMLButtonElement).disabled ? el : null;
      if (usable !== target) {
        target = usable;
        start = now;
      }
      const p = target && now > cooldown ? Math.min(1, (now - start) / dwellMs) : 0;
      if (ring.current) {
        ring.current.style.transform = `translate(${x - 20}px, ${y - 20}px)`;
        ring.current.style.opacity = target ? "1" : "0";
      }
      if (arc.current) arc.current.style.strokeDashoffset = String(C * (1 - p));
      if (target && p >= 1) {
        target.click();
        cooldown = now + 900;
        start = now + 900;
      }
      raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    window.addEventListener("pointermove", move);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, [on, dwellMs]);

  if (!on) return null;
  return (
    <div ref={ring} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[97] h-10 w-10 opacity-0 transition-opacity">
      <svg width={40} height={40}>
        <circle cx={20} cy={20} r={17} fill="none" stroke="rgba(194,65,12,.2)" strokeWidth={4} />
        <circle
          ref={arc}
          cx={20}
          cy={20}
          r={17}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 17}
          strokeDashoffset={2 * Math.PI * 17}
          transform="rotate(-90 20 20)"
        />
      </svg>
    </div>
  );
}

/** Live captions of everything Milo says out loud (and of what it says for you). */
export function Captions() {
  const on = useApp((s) => s.settings.captions);
  const caption = useApp((s) => s.caption);
  if (!on) return null;
  return (
    <AnimatePresence>
      {caption && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed bottom-[132px] left-1/2 z-[65] max-w-[min(900px,calc(100vw-2rem))] -translate-x-1/2 rounded-[20px] bg-ink/90 px-6 py-3 text-center text-xl font-medium leading-snug text-white shadow-lift"
          role="status"
          aria-live="polite"
        >
          <span className="mr-2 text-sm font-semibold uppercase tracking-wide text-white/70">{caption.who === "user" ? "Said for you" : "Milo"}</span>
          {caption.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Screen-edge flash when Milo replies (gentle glow if motion should be calm). */
export function VisualAlert() {
  const on = useApp((s) => s.settings.visualAlerts);
  const calm = useApp((s) => s.settings.reducedMotion === "on");
  const n = useApp((s) => s.messages.filter((m) => m.role === "milo").length);
  const [key, setKey] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (on) setKey((k) => k + 1);
  }, [n, on]);
  if (!on || key === 0) return null;
  return (
    <motion.div
      key={key}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[94]"
      style={{ boxShadow: "inset 0 0 0 10px var(--accent)" }}
      initial={{ opacity: calm ? 0.6 : 1 }}
      animate={{ opacity: calm ? [0.6, 0.6, 0] : [1, 0.2, 1, 0] }}
      transition={{ duration: calm ? 1.6 : 1.1 }}
    />
  );
}
