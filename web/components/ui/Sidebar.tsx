"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { useApp } from "@/lib/store";
import { Chip } from "./index";

const NAV = [
  { href: "/", emoji: "🏠", label: "Home" },
  { href: "/fit", emoji: "🪑", label: "Fit Check" },
  { href: "/appeal", emoji: "📄", label: "Coverage & Appeal" },
  { href: "/shop", emoji: "🛒", label: "Shop" },
  { href: "/receipts", emoji: "🧾", label: "Receipts" },
  { href: "/settings", emoji: "⚙️", label: "Settings" },
];

export function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const demo = useApp((s) => s.settings.demoMode);
  if (collapsed)
    return (
      <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col items-center border-r border-border bg-surface py-3">
        <button aria-label="Expand sidebar" data-head-target onClick={() => setCollapsed(false)} className="rounded p-2 text-muted hover:bg-surface-hover">
          <PanelLeftOpen size={18} strokeWidth={1.75} />
        </button>
        <nav className="mt-4 flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-label={n.label} data-head-target className={`rounded p-2 text-lg hover:bg-surface-hover ${path === n.href ? "bg-surface-hover" : ""}`}>
              <span aria-hidden>{n.emoji}</span>
            </Link>
          ))}
        </nav>
      </aside>
    );
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface px-2 py-3">
      <div className="flex items-center justify-between px-2 pb-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" data-head-target aria-label="Milo home">
          <Milo size={22} label={false} />
          <span>Milo</span>
          {demo && <Chip tone="warning">Demo</Chip>}
        </Link>
        <button aria-label="Collapse sidebar" data-head-target onClick={() => setCollapsed(true)} className="rounded p-1.5 text-muted hover:bg-surface-hover">
          <PanelLeftClose size={18} strokeWidth={1.75} />
        </button>
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              data-head-target
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-[15px] hover:bg-surface-hover ${active ? "bg-surface-hover font-medium" : "text-ink"}`}
            >
              <span aria-hidden className="w-5 text-center">{n.emoji}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 text-xs leading-5 text-muted">
        Milo helps with paperwork and everyday communication. It is not medical or legal advice.
      </div>
    </aside>
  );
}
