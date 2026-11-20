"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, Ear, FileText, Home, LifeBuoy, Map as MapIcon, PanelLeftClose, PanelLeftOpen, Receipt, Settings, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { openConfirm } from "@/lib/agent";
import { useApp } from "@/lib/store";
import { Chip } from "./index";

const NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/listen", icon: Ear, label: "Listen to someone" },
  { href: "/fit", icon: Armchair, label: "Chairs that fit" },
  { href: "/appeal", icon: FileText, label: "My appeal" },
  { href: "/shop", icon: ShoppingBag, label: "Shop" },
  { href: "/route", icon: MapIcon, label: "Get there" },
  { href: "/receipts", icon: Receipt, label: "Receipts" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function askForHelp() {
  openConfirm({
    question: "Say “I need help” out loud?",
    tool: "speak",
    args: { text: "I need help" },
    kind: "say",
    utterance: "I need help",
    inputMode: useApp.getState().mode,
    raw: "HELP",
    partial: false,
  });
}

export function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const demo = useApp((s) => s.settings.demoMode);
  const simple = useApp((s) => s.settings.simpleMode);
  const deaf = useApp((s) => s.settings.needs?.includes("deaf"));
  // Simple mode: only the essentials. "Listen" shows for Deaf / hard-of-hearing users (and in full mode).
  const nav = NAV.filter((n) => (simple ? ["/", "/appeal", "/settings"].includes(n.href) || (deaf && n.href === "/listen") : true));
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <aside className={`no-print sticky top-0 flex h-screen shrink-0 flex-col gap-2 border-r border-border bg-surface-alt/60 py-5 ${collapsed ? "w-[88px] items-center px-3" : "w-[272px] px-4"}`}>
      <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-2"} pb-4`}>
        <Link href="/" className="flex items-center gap-3 text-xl font-bold" data-head-target aria-label="Milo home">
          <Milo size={36} label={false} />
          {!collapsed && <span>Milo</span>}
          {!collapsed && demo && <Chip tone="warning">Demo</Chip>}
        </Link>
        <button
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          data-head-target
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <nav className="flex flex-col gap-1.5" aria-label="Main">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              data-head-target
              aria-label={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] items-center gap-3 rounded-full px-3 text-[17px] transition-colors data-[head-hover=true]:ring-[3px] data-[head-hover=true]:ring-accent ${
                active ? "bg-surface font-semibold text-ink shadow-soft" : "text-ink/80 hover:bg-surface/70"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? "bg-accent text-white" : "bg-surface text-muted"}`}>
                <Icon size={19} strokeWidth={2} aria-hidden />
              </span>
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={askForHelp}
          data-head-target
          aria-label="I need help — say it out loud"
          className={`flex min-h-[64px] items-center justify-center gap-2 rounded-full bg-danger-soft font-semibold text-danger hover:brightness-95 data-[head-hover=true]:ring-[3px] data-[head-hover=true]:ring-danger ${collapsed ? "w-16" : "w-full"}`}
        >
          <LifeBuoy size={22} aria-hidden />
          {!collapsed && "I need help"}
        </button>
        {!collapsed && (
          <p className="px-2 text-[13px] leading-5 text-muted">Milo helps with paperwork and everyday talk. Not medical or legal advice.</p>
        )}
      </div>
    </aside>
  );
}
