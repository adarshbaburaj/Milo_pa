"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { ReactNode, useId, useState } from "react";

export const EASE = [0.2, 0.8, 0.2, 1] as const;

export function Block({ children, className = "", align = "left" }: { children: ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={`group relative flex ${align === "right" ? "justify-end" : "justify-start"} ${className}`}
    >
      {children}
    </motion.div>
  );
}

const CALLOUT_BG = { neutral: "bg-surface", warning: "bg-warning-soft", success: "bg-success-soft", accent: "bg-accent-soft", danger: "bg-danger-soft" };

export function Callout({ emoji, children, tone = "neutral", className = "" }: { emoji?: string; children: ReactNode; tone?: keyof typeof CALLOUT_BG; className?: string }) {
  return (
    <div className={`flex gap-3 rounded px-4 py-3 ${CALLOUT_BG[tone]} ${className}`}>
      {emoji && <span aria-hidden className="text-lg leading-6">{emoji}</span>}
      <div className="min-w-0 flex-1 leading-6">{children}</div>
    </div>
  );
}

export function Toggle({ summary, children, defaultOpen = false, className = "" }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        data-head-target
        className="flex w-full items-start gap-1.5 rounded-sm px-1 py-1 text-left hover:bg-surface"
      >
        <ChevronRight size={16} strokeWidth={1.75} className={`mt-1 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        <span className="min-w-0 flex-1">{summary}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pb-2 pl-7 pr-1 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PropertyRow({ label, children, icon, hint }: { label: string; children: ReactNode; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-3 py-1.5 text-[15px]">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0">
        {children}
        {hint}
      </div>
    </div>
  );
}

export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-left text-sm text-muted">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const CHIP_TONE = {
  neutral: "bg-surface text-muted",
  accent: "bg-accent-soft text-[#0b5cad]",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-[#b42323]",
  warning: "bg-warning-soft text-[#8a5d12]",
};

export function Chip({ children, tone = "neutral", className = "", title }: { children: ReactNode; tone?: keyof typeof CHIP_TONE; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-5 ${CHIP_TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

const MODE_CHIP: Record<string, string> = { head: "🙂 head", voice: "🎙 voice", text: "Aa text", sign: "🤟 sign" };
export function ModeChip({ mode }: { mode?: string }) {
  if (!mode) return null;
  return <Chip>{MODE_CHIP[mode] ?? mode}</Chip>;
}

export function SourceChip({ live, label }: { live: boolean; label?: string }) {
  return <Chip tone={live ? "success" : "neutral"}>{label ? `${label} · ` : ""}{live ? "live" : "mock"}</Chip>;
}

export function Tile({
  children,
  selected,
  onSelect,
  label,
  className = "",
  size = "md",
  disabled,
}: {
  children: ReactNode;
  selected?: boolean;
  onSelect: () => void;
  label: string;
  className?: string;
  size?: "md" | "lg";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      data-head-target
      onClick={onSelect}
      className={`relative flex min-h-[88px] min-w-[88px] select-none items-center justify-center rounded-lg bg-surface text-ink transition-colors hover:bg-surface-hover disabled:opacity-40 data-[head-hover=true]:bg-accent-soft data-[head-hover=true]:ring-2 data-[head-hover=true]:ring-accent ${
        selected ? "bg-accent-soft ring-2 ring-accent" : ""
      } ${size === "lg" ? "text-[40px] font-semibold" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  className = "",
  label,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  label?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const v =
    variant === "primary"
      ? "bg-accent text-white hover:bg-[#1a73c9]"
      : variant === "ghost"
      ? "text-muted hover:bg-surface"
      : "bg-surface text-ink hover:bg-surface-hover";
  return (
    <button
      type={type}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      data-head-target
      className={`inline-flex min-h-[40px] items-center gap-2 rounded px-3.5 py-2 text-[15px] font-medium transition-colors disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function PageTitle({ emoji, title, subtitle }: { emoji?: string; title: string; subtitle?: ReactNode }) {
  return (
    <header className="mb-8">
      {emoji && <div aria-hidden className="mb-3 text-5xl">{emoji}</div>}
      <h1 className="text-[32px] font-semibold leading-10 tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </header>
  );
}

export function Section({ title, children, className = "" }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-10 ${className}`}>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function DwellRing({ progress, size = 36 }: { progress: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} aria-hidden className="pointer-events-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={3}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
