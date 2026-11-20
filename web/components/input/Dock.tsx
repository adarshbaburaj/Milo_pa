"use client";
import { ArrowUp, Mic, MicOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { milo } from "@/components/milo/useMilo";
import { clearLetters, handleVoiceConfirm, lettersToString, submitUtterance } from "@/lib/agent";
import { STT, sttAvailable } from "@/lib/speech/stt";
import { stopSpeaking } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import type { InputMode } from "@/lib/types";
import { Suggestions } from "./Suggestions";

const MODES: { mode: InputMode; icon: string; label: string }[] = [
  { mode: "text", icon: "Aa", label: "Type (Alt+1)" },
  { mode: "voice", icon: "🎙", label: "Speak (Alt+2)" },
  { mode: "head", icon: "🙂", label: "Head (Alt+3)" },
  { mode: "sign", icon: "🤟", label: "Sign, beta (Alt+4)" },
];

function voiceModeCommand(t: string): InputMode | null {
  const m = t.toLowerCase().match(/switch to (text|typing|voice|head|sign)/);
  if (!m) return null;
  return ({ text: "text", typing: "text", voice: "voice", head: "head", sign: "sign" } as const)[m[1] as "text"];
}

export function Dock() {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const letters = useApp((s) => s.letters);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        setMode(MODES[Number(e.key) - 1].mode);
      }
    };
    // Alt+digit gives special chars on macOS; use code too
    const onKeyCode = (e: KeyboardEvent) => {
      const m = e.code.match(/^Digit([1-4])$/);
      if (e.altKey && m) {
        e.preventDefault();
        setMode(MODES[Number(m[1]) - 1].mode);
      }
    };
    window.addEventListener("keydown", onKeyCode);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onKeyCode);
    };
  }, [setMode]);

  return (
    <div className="no-print sticky bottom-0 z-40 bg-bg pb-5 pt-3">
      {mode !== "head" && letters.length > 0 && (
        <div className="mb-3 rounded-lg border border-border bg-bg p-3 shadow-soft">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm text-muted">Letters</span>
            <span className="font-mono text-lg font-semibold tracking-widest">{lettersToString(letters).toUpperCase()}</span>
            <button aria-label="Clear letters" onClick={clearLetters} className="ml-auto rounded p-1 text-muted hover:bg-surface">
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
          <Suggestions mode={mode} compact />
        </div>
      )}
      <div className="flex min-h-[56px] items-end gap-2 rounded-lg border border-border bg-bg p-1.5 shadow-soft">
        <div role="radiogroup" aria-label="Input mode" className="flex shrink-0 gap-0.5 self-center rounded bg-surface p-0.5">
          {MODES.map((m) => (
            <button
              key={m.mode}
              role="radio"
              aria-checked={mode === m.mode}
              aria-label={m.label}
              title={m.label}
              data-head-target
              onClick={() => setMode(m.mode)}
              className={`h-10 w-10 rounded-sm text-[15px] font-semibold transition-colors ${mode === m.mode ? "bg-bg text-ink shadow-soft" : "text-muted hover:text-ink"}`}
            >
              {m.icon}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 self-center">
          {mode === "text" && <TextInput />}
          {mode === "voice" && <VoiceInput />}
          {mode === "head" && <HeadDockHint />}
          {mode === "sign" && <SignDockHint />}
        </div>
      </div>
    </div>
  );
}

function TextInput() {
  const [v, setV] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const confirm = useApp((s) => s.confirm);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 4 * 26 + 16) + "px";
  }, [v]);
  const send = () => {
    if (!v.trim()) return;
    submitUtterance(v, "text");
    setV("");
  };
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="milo-text" className="sr-only">Message Milo</label>
      <textarea
        id="milo-text"
        ref={ref}
        rows={1}
        value={v}
        autoFocus
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            if (!v.trim() && confirm) return; // ConfirmBar handles Enter
            e.preventDefault();
            send();
          }
        }}
        placeholder="Ask Milo, or type first letters like W W A"
        className="block max-h-[120px] w-full resize-none bg-transparent px-2 py-2 text-base leading-[26px] outline-none placeholder:text-muted focus-visible:outline-none"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!v.trim()}
        className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded bg-accent text-white disabled:bg-surface disabled:text-muted"
      >
        <ArrowUp size={18} strokeWidth={2} />
      </button>
    </form>
  );
}

function VoiceInput() {
  const [on, setOn] = useState(false);
  const interim = useApp((s) => s.interim);
  const setInterim = useApp((s) => s.setInterim);
  const setMode = useApp((s) => s.setMode);
  const sttRef = useRef<STT | null>(null);
  const available = typeof window !== "undefined" && sttAvailable();

  const start = () => {
    stopSpeaking();
    if (!sttRef.current)
      sttRef.current = new STT({
        onInterim: (t) => setInterim(t),
        onFinal: (t) => {
          setInterim("");
          if (!t) return;
          const m = voiceModeCommand(t);
          if (m) return setMode(m);
          if (handleVoiceConfirm(t)) return;
          submitUtterance(t, "voice");
        },
        onEnd: () => {
          setOn(false);
          milo.set("listening", false);
          setInterim("");
        },
      });
    sttRef.current.start();
    setOn(true);
    milo.set("listening", true);
    useApp.getState().announce("Milo is listening");
  };
  const stop = () => {
    sttRef.current?.stop();
  };

  // hold Space to talk when focus isn't in a text field
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isField(e.target) && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isField(e.target) && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      sttRef.current?.stop();
      milo.set("listening", false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!available)
    return <p className="px-2 text-sm text-muted">Voice input needs Chrome (Web Speech API). Type instead, or switch to head mode.</p>;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={on ? "Stop listening" : "Start listening"}
        aria-pressed={on}
        data-head-target
        onClick={() => (on ? stop() : start())}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${on ? "bg-danger text-white" : "bg-accent text-white"}`}
      >
        {on ? <MicOff size={20} strokeWidth={1.75} /> : <Mic size={20} strokeWidth={1.75} />}
      </button>
      <span className={`truncate text-base ${interim ? "text-muted" : "text-muted"}`}>
        {interim || (on ? "Listening…" : "Tap the mic, or hold Space to talk")}
      </span>
    </div>
  );
}

function HeadDockHint() {
  const ready = useApp((s) => s.headReady);
  return <p className="px-2 text-sm text-muted">{ready ? "Head mode is on: turn your head to move, dwell or nod to choose, shake to go back." : "Starting the camera… allow access when Chrome asks. Video stays on this device."}</p>;
}

function SignDockHint() {
  return <p className="px-2 text-sm text-muted">Sign input (beta): fingerspelling and a few signs. Not a full ASL translator.</p>;
}
