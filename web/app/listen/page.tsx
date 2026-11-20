"use client";
import { Ear, EarOff, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { milo } from "@/components/milo/useMilo";
import { api } from "@/lib/api";
import { STT, sttAvailable } from "@/lib/speech/stt";
import { speak } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import { Button, PageTitle } from "@/components/ui";

type Line = { id: number; who: "them" | "me"; text: string };

/**
 * For Deaf / hard-of-hearing users: Milo captions what the hearing person says (big text),
 * and speaks your typed / tapped / signed reply out loud for them.
 */
export default function ListenPage() {
  const [on, setOn] = useState(false);
  const [interim, setInterim] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [reply, setReply] = useState("");
  const [phrases, setPhrases] = useState<string[]>(["Yes", "No", "Thank you", "Please wait", "Can you write it down?", "Please speak slowly"]);
  const stt = useRef<STT | null>(null);
  const n = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(true); // decided after mount (avoids a server/client mismatch)
  useEffect(() => setAvailable(sttAvailable()), []);
  const largeText = useApp((s) => s.settings.largeText);

  useEffect(() => {
    api<{ text: string; kind: string }[]>("/api/memory/phrases")
      .then((ps) => setPhrases((cur) => Array.from(new Set([...cur, ...ps.filter((p) => p.kind === "say").slice(0, 6).map((p) => p.text)]))))
      .catch(() => {});
    return () => {
      stt.current?.stop();
      milo.set("listening", false);
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, interim]);

  const start = () => {
    stt.current = new STT(
      {
        onInterim: setInterim,
        onFinal: (t) => {
          setInterim("");
          if (t) setLines((ls) => [...ls, { id: n.current++, who: "them", text: t }]);
        },
        onEnd: () => {
          // keep listening until the person turns it off
          if (stt.current && onRef.current) setTimeout(() => stt.current?.start(), 200);
        },
      },
      true
    );
    stt.current.start();
    setOn(true);
    onRef.current = true;
    milo.set("listening", true);
  };
  const onRef = useRef(false);
  const stop = () => {
    onRef.current = false;
    stt.current?.stop();
    setOn(false);
    milo.set("listening", false);
  };
  const say = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setLines((ls) => [...ls, { id: n.current++, who: "me", text: t }]);
    setReply("");
    useApp.getState().setSpoken(t);
    await speak(t, { who: "user" });
    setTimeout(() => useApp.getState().setSpoken(null), 800);
  };

  return (
    <div>
      <PageTitle emoji="🧏" title="Listen to someone" subtitle="Milo shows what people say to you as big captions, and says your replies out loud." />

      <div className="mb-6 flex items-center gap-3">
        {available ? (
          on ? (
            <Button variant="danger" size="lg" onClick={stop}>
              <EarOff size={24} aria-hidden /> Stop listening
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={start}>
              <Ear size={24} aria-hidden /> Start listening
            </Button>
          )
        ) : (
          <p className="text-muted">Live captions need Chrome.</p>
        )}
        {on && <span className="flex items-center gap-2 text-muted"><span className="h-3 w-3 animate-pulse rounded-full bg-danger" aria-hidden /> Listening — hand the screen to the other person or turn it toward them</span>}
      </div>

      <section aria-label="Conversation captions" aria-live="polite" className="flex min-h-[260px] flex-col gap-3 rounded-lg border-2 border-border bg-surface p-5 shadow-soft">
        {lines.length === 0 && !interim && <p className="text-lg text-muted">Captions appear here.</p>}
        {lines.map((l) => (
          <div key={l.id} className={`max-w-[85%] rounded-lg px-5 py-3 ${l.who === "them" ? "self-start bg-surface-alt" : "self-end bg-accent text-white"} ${largeText ? "text-4xl" : "text-3xl"} font-medium leading-snug`}>
            <span className={`mb-1 block text-sm font-semibold uppercase tracking-wide ${l.who === "them" ? "text-muted" : "text-white/80"}`}>{l.who === "them" ? "They said" : "You said"}</span>
            {l.text}
          </div>
        ))}
        {interim && <div className="max-w-[85%] self-start rounded-lg bg-surface-alt px-5 py-3 text-3xl font-medium text-muted">{interim}…</div>}
        <div ref={end} />
      </section>

      <section className="mt-6" aria-label="Your reply">
        <div className="mb-3 flex flex-wrap gap-2">
          {phrases.map((p) => (
            <button key={p} data-head-target onClick={() => say(p)} className="min-h-[56px] rounded-full border-2 border-border bg-surface px-5 text-lg font-medium shadow-soft hover:bg-surface-hover data-[head-hover=true]:border-accent data-[head-hover=true]:bg-accent-soft">
              {p}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            say(reply);
          }}
        >
          <label htmlFor="listen-reply" className="sr-only">Type a reply for Milo to say</label>
          <input
            id="listen-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply — Milo says it out loud"
            className="min-h-[64px] flex-1 rounded-full border-2 border-border bg-surface px-6 text-xl outline-none focus:border-accent"
          />
          <Button variant="primary" size="lg" type="submit" label="Say it">
            <Send size={22} aria-hidden /> Say it
          </Button>
        </form>
      </section>
    </div>
  );
}
