"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Armchair, Ear, FileText, MessageCircle, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Milo } from "@/components/milo/Milo";
import { api } from "@/lib/api";
import { openConfirm, quick } from "@/lib/agent";
import { useApp } from "@/lib/store";
import { Block, EASE } from "@/components/ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type Phrase = { text: string; kind: string; count: number };

export default function Home() {
  const router = useRouter();
  const messages = useApp((s) => s.messages);
  const dataVersion = useApp((s) => s.dataVersion);
  const mode = useApp((s) => s.mode);
  const [name, setName] = useState("Maria");
  const [cards, setCards] = useState<{ appeal: string; appealTone: "warning" | "success"; fits: string }>({ appeal: "", appealTone: "warning", fits: "" });
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api("/api/profile").then((p) => setName(p.name.split(" ")[0])).catch(() => {});
    api<Phrase[]>("/api/memory/phrases")
      .then((ps) => setPhrases(ps.filter((p) => p.kind === "say").slice(0, 8)))
      .catch(() => {});
    Promise.all([api("/api/case"), api("/api/catalog")])
      .then(([c, cat]) => {
        const filed = c.case.status === "appeal_filed";
        setCards({
          appeal: filed ? `Filed · decision by ${new Date(c.case.decisionDue + "T12:00").toLocaleDateString([], { month: "short", day: "numeric" })}` : `${c.daysLeft} days left to appeal`,
          appealTone: filed ? "success" : "warning",
          fits: `${cat.items.filter((i: any) => i.fits).length} chairs fit your home`,
        });
      })
      .catch(() => {});
  }, [dataVersion]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const lastMilo = [...messages].reverse().find((m) => m.role === "milo");
  const bubble = lastMilo?.text ?? `${greeting()}, ${name}. What would you like to do?`;

  const sayPhrase = (text: string) =>
    openConfirm({ question: `Say “${text}” out loud?`, tool: "speak", args: { text }, kind: "say", utterance: text, inputMode: mode, raw: text, partial: false });

  const ACTIONS = [
    { icon: MessageCircle, title: "Say something", sub: "Spell first letters, Milo speaks for you", tone: "bg-accent-soft text-accent", on: () => useApp.getState().setMode("head") },
    { icon: Armchair, title: "Chairs that fit", sub: cards.fits || "Check against your home", tone: "bg-info-soft text-info", on: () => quick("Which chairs fit my home?") },
    { icon: FileText, title: "My appeal", sub: cards.appeal || "Acme’s decision", tone: cards.appealTone === "success" ? "bg-success-soft text-success" : "bg-warning-soft text-warning", on: () => quick("Where's my wheelchair appeal?") },
    { icon: ShoppingBag, title: "Shop", sub: "Checkout done for you", tone: "bg-surface-alt text-ink", on: () => router.push("/shop") },
  ];

  const settings = useApp((s) => s.settings);
  const deaf = settings.needs?.includes("deaf");
  let actions = ACTIONS;
  if (deaf) actions = [actions[0], { icon: Ear, title: "Listen to someone", sub: "Live captions of people talking to you", tone: "bg-info-soft text-info", on: () => router.push("/listen") }, ...actions.slice(1)];
  if (settings.simpleMode) actions = actions.filter((a) => ["Say something", "My appeal", "Listen to someone"].includes(a.title));
  if (!settings.inputModes.includes("head")) actions = actions.map((a) => (a.title === "Say something" ? { ...a, on: () => useApp.getState().setMode(settings.inputModes.includes("sign") ? "sign" : "text"), sub: "Type or tap phrases — Milo says it out loud" } : a));

  return (
    <div>
      {/* Milo + speech bubble */}
      <section className="mb-10 flex items-end gap-5" aria-label="Milo">
        <Milo size={112} />
        <AnimatePresence mode="wait">
          <motion.div
            key={bubble}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="relative mb-6 max-w-[520px] rounded-lg rounded-bl-sm border border-border bg-surface px-6 py-4 text-xl leading-snug shadow-soft"
          >
            {bubble}
            {lastMilo?.link && (
              <Link href={lastMilo.link} className="mt-2 block text-base font-semibold text-accent hover:underline" data-head-target>
                {lastMilo.linkLabel ?? "Open"} →
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Big action cards */}
      <section aria-label="What would you like to do" className="grid grid-cols-2 gap-4">
        {actions.map(({ icon: Icon, title, sub, tone, on }) => (
          <button
            key={title}
            onClick={on}
            data-head-target
            className="group flex min-h-[132px] items-center gap-4 rounded-lg border-2 border-border bg-surface p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lift data-[head-hover=true]:-translate-y-0.5 data-[head-hover=true]:border-accent data-[head-hover=true]:bg-accent-soft"
          >
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon size={30} strokeWidth={2} aria-hidden />
            </span>
            <span>
              <span className="block text-xl font-semibold">{title}</span>
              <span className="block text-[15px] text-muted">{sub}</span>
            </span>
          </button>
        ))}
      </section>

      {/* Quick phrases (AAC) */}
      {phrases.length > 0 && (
        <section className="mt-10" aria-label="Quick phrases">
          <h2 className="mb-3 text-lg font-semibold">Quick phrases <span className="text-base font-normal text-muted">· one tap, Milo says it out loud</span></h2>
          <div className="flex flex-wrap gap-2.5">
            {phrases.map((p) => (
              <button
                key={p.text}
                onClick={() => sayPhrase(p.text)}
                data-head-target
                className="min-h-[56px] rounded-full border-2 border-border bg-surface px-5 text-lg font-medium shadow-soft transition-all hover:border-accent/40 hover:bg-surface-hover data-[head-hover=true]:border-accent data-[head-hover=true]:bg-accent-soft"
              >
                {p.text}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Conversation */}
      {messages.length > 0 && (
        <section className="mt-12" aria-label="Conversation">
          <h2 className="mb-4 text-lg font-semibold">Today</h2>
          <div className="flex flex-col gap-4" role="log">
            {messages.map((m) =>
              m.role === "user" ? (
                <Block key={m.id} align="right">
                  <div className="max-w-[80%] rounded-lg rounded-br-sm bg-accent px-5 py-3 text-lg text-white shadow-soft">
                    <div>{m.text}</div>
                    <div className="mt-1 flex items-center justify-end gap-2 text-[13px] text-white/85">
                      {m.letters && <span className="font-mono">{m.letters.toUpperCase()} →</span>}
                      <span>{{ head: "🙂 head", voice: "🎙 voice", text: "⌨️ typed", sign: "🤟 sign" }[m.mode ?? "text"]}</span>
                    </div>
                  </div>
                </Block>
              ) : (
                <Block key={m.id}>
                  <div className="flex max-w-[85%] items-end gap-3">
                    <div className="shrink-0">
                      <Milo size={36} label={false} />
                    </div>
                    <div className="rounded-lg rounded-bl-sm border border-border bg-surface px-5 py-3 text-lg shadow-soft">
                      <div>{m.text}</div>
                      <div className="mt-1 flex gap-4 text-[15px]">
                        {m.link && (
                          <Link href={m.link} className="font-semibold text-accent hover:underline" data-head-target>
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
        </section>
      )}
    </div>
  );
}
