"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ReactNode, useId, useState } from "react";

export const EASE = [0.2, 0.8, 0.2, 1] as const;

export function Block({ children, className = "", align = "left" }: { children: ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
      className={`relative flex ${align === "right" ? "justify-end" : "justify-start"} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Card({ children, className = "", as: As = "div" }: { children: ReactNode; className?: string; as?: any }) {
  return <As className={`rounded-lg border border-border bg-surface p-6 shadow-soft ${className}`}>{children}</As>;
}

const TONE_BG = {
  neutral: "bg-surface border-border",
  warning: "bg-warning-soft border-transparent",
  success: "bg-success-soft border-transparent",
  accent: "bg-accent-soft border-transparent",
  danger: "bg-danger-soft border-transparent",
  info: "bg-info-soft border-transparent",
};

export function Callout({ emoji, children, tone = "neutral", className = "" }: { emoji?: string; children: ReactNode; tone?: keyof typeof TONE_BG; className?: string }) {
  return (
    <div className={`flex gap-4 rounded border px-5 py-4 ${TONE_BG[tone]} ${className}`}>
      {emoji && (
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface/70 text-xl">
          {emoji}
        </span>
      )}
      <div className="min-w-0 flex-1 self-center leading-relaxed">{children}</div>
    </div>
  );
}

export function IconBubble({ children, tone = "accent", size = 48 }: { children: ReactNode; tone?: "accent" | "success" | "warning" | "info" | "neutral" | "danger"; size?: number }) {
  const bg = { accent: "bg-accent-soft text-accent", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", info: "bg-info-soft text-info", neutral: "bg-surface-alt text-ink", danger: "bg-danger-soft text-danger" }[tone];
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full ${bg}`} style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {children}
    </span>
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
        className="flex min-h-[44px] w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-surface-hover"
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDown size={20} strokeWidth={2} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PropertyRow({ label, children, icon, hint }: { label: string; children: ReactNode; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(160px,220px)_1fr] items-start gap-4 border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0 font-medium">
        {children}
        {hint}
      </div>
    </div>
  );
}

export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded border border-border bg-surface">
      <table className="w-full border-collapse">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border bg-surface-alt text-left text-sm text-muted">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 font-medium">
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
  neutral: "bg-surface-alt text-muted",
  accent: "bg-accent-soft text-accent-hover",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

export function Chip({ children, tone = "neutral", className = "", title }: { children: ReactNode; tone?: keyof typeof CHIP_TONE; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-6 ${CHIP_TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

const MODE_CHIP: Record<string, string> = { head: "🙂 head", voice: "🎙 voice", text: "⌨️ typed", sign: "🤟 sign" };
export function ModeChip({ mode }: { mode?: string }) {
  if (!mode) return null;
  return <Chip>{MODE_CHIP[mode] ?? mode}</Chip>;
}

export function SourceChip({ live, label }: { live: boolean; label?: string }) {
  return (
    <Chip tone={live ? "success" : "neutral"}>
      {label ? `${label} · ` : ""}
      {live ? "live" : "mock"}
    </Chip>
  );
}

/** Big selectable card for head / sign / touch. Min 96×96. */
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
      className={`relative flex min-h-[96px] min-w-[96px] select-none items-center justify-center rounded-lg border-2 bg-surface text-ink shadow-soft transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none data-[head-hover=true]:-translate-y-0.5 data-[head-hover=true]:border-accent data-[head-hover=true]:bg-accent-soft ${
        selected ? "border-accent bg-accent-soft" : "border-border"
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
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  label?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "md" | "lg";
}) {
  const v =
    variant === "primary"
      ? "bg-accent text-white shadow-soft hover:bg-accent-hover"
      : variant === "danger"
      ? "bg-danger text-white hover:brightness-95"
      : variant === "ghost"
      ? "text-muted hover:bg-surface-alt"
      : "border-2 border-border bg-surface text-ink hover:border-accent/40 hover:bg-surface-hover";
  const sz = size === "lg" ? "min-h-[64px] px-7 text-lg" : "min-h-[52px] px-5 text-base";
  return (
    <button
      type={type}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      data-head-target
      className={`inline-flex items-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-40 data-[head-hover=true]:ring-[3px] data-[head-hover=true]:ring-accent ${sz} ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function PageTitle({ emoji, title, subtitle }: { emoji?: string; title: string; subtitle?: ReactNode }) {
  return (
    <header className="mb-10 flex items-start gap-5">
      {emoji && <IconBubble size={64}>{emoji}</IconBubble>}
      <div>
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-muted">{subtitle}</p>}
      </div>
    </header>
  );
}

export function Section({ title, children, className = "" }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-12 ${className}`}>
      <h2 className="mb-4 text-[22px] font-semibold">{title}</h2>
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
