"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { api } from "@/lib/api";
import { quick } from "@/lib/agent";
import { useApp } from "@/lib/store";
import { Block, Button, Callout, ModeChip } from "@/components/ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const QUICK = [
  ["🪑", "Check a chair fits", "Which chairs fit my home?"],
  ["📄", "Where’s my appeal?", "Where's my wheelchair appeal?"],
  ["🗣", "Say something for me", "__head__"],
  ["🛒", "Shop", "__shop__"],
] as const;

export default function Home() {
  const messages = useApp((s) => s.messages);
  const dataVersion = useApp((s) => s.dataVersion);
  const [name, setName] = useState("Maria");
  const [nudges, setNudges] = useState<{ emoji: string; text: string; href: string; tone: "warning" | "success" | "neutral" }[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api("/api/profile").then((p) => setName(p.name.split(" ")[0])).catch(() => {});
    Promise.all([api("/api/case"), api("/api/catalog")])
      .then(([c, cat]) => {
        const n: typeof nudges = [];
        if (c.case.status === "appeal_filed") n.push({ emoji: "📄", text: `Appeal filed · Acme should decide by ${new Date(c.case.decisionDue + "T12:00").toLocaleDateString([], { month: "short", day: "numeric" })}`, href: "/appeal", tone: "success" });
        else n.push({ emoji: "📄", text: `Your appeal deadline is in ${c.daysLeft} days`, href: "/appeal", tone: "warning" });
        const fits = cat.items.filter((i: any) => i.fits).length;
        n.push({ emoji: "🪑", text: `${fits} chairs fit your home`, href: "/fit", tone: "neutral" });
        setNudges(n);
      })
      .catch(() => {});
  }, [dataVersion]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const date = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div>
      <header className="mb-8 flex items-center gap-4">
        <Milo size={48} />
        <div>
          <h1 className="text-[32px] font-semibold leading-10 tracking-tight">
            {greeting()}, {name}
          </h1>
          <p className="text-muted">{date}</p>
        </div>
      </header>

      {nudges.length > 0 && (
        <div className="mb-8 flex flex-col gap-2">
          {nudges.slice(0, 2).map((n) => (
            <Link key={n.text} href={n.href} data-head-target className="block rounded hover:brightness-[0.98]">
              <Callout emoji={n.emoji} tone={n.tone}>{n.text}</Callout>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4" aria-label="Conversation" role="log">
        {messages.map((m) =>
          m.role === "user" ? (
            <Block key={m.id} align="right">
              <div className="max-w-[80%] rounded-lg bg-surface px-4 py-2.5">
                <div className="mb-1 flex items-center justify-end gap-2">
                  {m.letters && <span className="font-mono text-xs text-muted">{m.letters.toUpperCase()} →</span>}
                  <ModeChip mode={m.mode} />
                </div>
                <div>{m.text}</div>
              </div>
            </Block>
          ) : (
            <Block key={m.id}>
              <div className="flex max-w-[85%] gap-3">
                <div className="mt-0.5 shrink-0"><Milo size={28} label={false} /></div>
                <div className="pt-0.5">
                  <div>{m.text}</div>
                  <div className="mt-1 flex gap-3 text-sm">
                    {m.link && (
                      <Link href={m.link} className="text-accent hover:underline" data-head-target>
                        {m.linkLabel ?? "Open"} →
                      </Link>
                    )}
                    {m.receiptId && (
                      <button className="text-muted hover:underline" onClick={() => useApp.getState().setReceiptsOpen(true)} data-head-target>
                        🧾 Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Block>
          )
        )}
        <div ref={end} />
      </div>

      {messages.length === 0 && (
        <div className="mt-10">
          <p className="mb-3 text-sm text-muted">Try</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK.map(([emoji, label, q]) => (
              <Button
                key={label}
                className="justify-start py-3"
                onClick={() => {
                  if (q === "__head__") useApp.getState().setMode("head");
                  else if (q === "__shop__") location.assign("/shop");
                  else quick(q);
                }}
              >
                <span aria-hidden>{emoji}</span> {label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
