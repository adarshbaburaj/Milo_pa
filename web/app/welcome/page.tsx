"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Captions, Scanner } from "@/components/access/Access";
import { Calibrate } from "@/components/input/Calibrate";
import { MeasureEditor } from "@/components/measure/MeasureEditor";
import { Milo } from "@/components/milo/Milo";
import { milo } from "@/components/milo/useMilo";
import { NEEDS, planFor } from "@/lib/needs";
import { STT, sttAvailable } from "@/lib/speech/stt";
import { speak, stopSpeaking } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import type { InputMode } from "@/lib/types";
import { Button, EASE } from "@/components/ui";

const MODES: { mode: InputMode; icon: string; label: string; desc: string; words: RegExp }[] = [
  { mode: "text", icon: "⌨️", label: "Type", desc: "Keyboard or first letters", words: /\b(type|typing|keyboard)\b/ },
  { mode: "voice", icon: "🎙", label: "Speak", desc: "Talk to Milo", words: /\b(speak|voice|talk)\b/ },
  { mode: "head", icon: "🙂", label: "Head", desc: "Point with your nose", words: /\b(head|nose)\b/ },
  { mode: "sign", icon: "🤟", label: "Sign (beta)", desc: "Fingerspelling + a few signs", words: /\b(sign|signing)\b/ },
];

type Step = "gate" | "hello" | "needs" | "plan" | "measure" | "calibrate";

const PROMPT: Record<Exclude<Step, "gate" | "calibrate">, string> = {
  hello: "Hi, I’m Milo. I help you get things done, any way you can talk to me.",
  needs: "What would help you? Pick any that fit. You can pick more than one.",
  plan: "Here’s what I set up for you. You can change anything later.",
  measure: "Last thing: a few measurements so I can check which wheelchairs fit. A helper can do this for you.",
};

export default function Welcome() {
  const router = useRouter();
  const hydrate = useApp((s) => s.hydrate);
  const setSettings = useApp((s) => s.setSettings);
  const [step, setStep] = useState<Step>("gate");
  const [needs, setNeeds] = useState<string[]>([]);
  const [modes, setModes] = useState<InputMode[]>(["text", "voice"]);
  const stepRef = useRef(step);
  stepRef.current = step;
  const needsRef = useRef(needs);
  needsRef.current = needs;

  useEffect(() => hydrate(), [hydrate]);

  // Say each step out loud (captions always on). Skip voice if the person told us they're Deaf.
  useEffect(() => {
    if (step === "gate" || step === "calibrate") return;
    const text = PROMPT[step];
    useApp.getState().announce(text);
    if (needsRef.current.includes("deaf")) {
      useApp.getState().setCaption({ text, who: "milo" });
    } else speak(text);
    if (step === "hello") milo.react("happy");
  }, [step]);

  // Voice works on every step (if the mic is allowed): option names, "next", "back"
  const sttRef = useRef<STT | null>(null);
  const startVoice = () => {
    if (!sttAvailable() || sttRef.current) return;
    sttRef.current = new STT(
      {
        onFinal: (raw) => {
          const t = raw.toLowerCase();
          const s = stepRef.current;
          if (/\b(back|go back)\b/.test(t)) return back();
          if (/\b(next|continue|done|start|okay|ok|yes|finish)\b/.test(t)) return next();
          if (s === "needs") {
            if (/\bnone\b/.test(t)) return next();
            NEEDS.forEach((n) => n.say.test(t) && toggleNeed(n.id));
          }
          if (s === "plan") MODES.forEach((m) => m.words.test(t) && toggleMode(m.mode));
        },
        onEnd: () => {
          if (sttRef.current && stepRef.current !== "calibrate") setTimeout(() => sttRef.current?.start(), 250);
        },
      },
      true
    );
    sttRef.current.start();
  };
  useEffect(
    () => () => {
      const s = sttRef.current;
      sttRef.current = null;
      s?.stop();
    },
    []
  );

  // Gate: ANY key, click, tap, switch — or saying "start" — begins (this also unlocks audio)
  useEffect(() => {
    if (step !== "gate") return;
    const go = () => {
      setStep("hello");
      startVoice();
    };
    window.addEventListener("keydown", go, { once: true });
    window.addEventListener("pointerdown", go, { once: true });
    return () => {
      window.removeEventListener("keydown", go);
      window.removeEventListener("pointerdown", go);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const toggleNeed = (id: string) => {
    milo.react("happy");
    setNeeds((ns) => {
      const next = ns.includes(id) ? ns.filter((x) => x !== id) : [...ns, id];
      setModes(planFor(next).modes);
      return next;
    });
  };
  const toggleMode = (m: InputMode) => {
    milo.react("happy");
    setModes((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));
  };

  const ORDER: Step[] = ["gate", "hello", "needs", "plan", "measure", "calibrate"];
  const back = () => {
    stopSpeaking();
    const i = ORDER.indexOf(stepRef.current);
    if (i > 1) setStep(ORDER[i - 1]);
  };
  const finish = () => {
    const plan = planFor(needsRef.current);
    const ms = modes.length ? modes : (["text"] as InputMode[]);
    setSettings({ ...plan.settings, inputModes: ms, onboarded: true });
    useApp.getState().setMode(ms.includes("head") ? "head" : ms.includes("voice") ? "voice" : ms.includes("sign") ? "sign" : "text");
    milo.react("celebrate");
    sttRef.current?.stop();
    sttRef.current = null;
    router.push("/");
  };
  const next = () => {
    stopSpeaking();
    const s = stepRef.current;
    if (s === "hello") setStep("needs");
    else if (s === "needs") setStep("plan");
    else if (s === "plan") {
      setSettings({ ...planFor(needsRef.current).settings, inputModes: modes });
      setStep("measure");
    } else if (s === "measure") {
      if (modes.includes("head")) {
        sttRef.current?.stop();
        sttRef.current = null;
        setStep("calibrate");
      } else finish();
    }
  };

  if (step === "calibrate") return <Calibrate onDone={finish} onCancel={finish} />;

  if (step === "gate")
    return (
      <main id="main" className="flex min-h-screen cursor-pointer flex-col items-center justify-center gap-8 bg-bg px-8 text-center" aria-label="Start Milo">
        <Milo size={140} />
        <h1 className="text-[44px] font-semibold leading-tight">Hi, I’m Milo.</h1>
        <p className="max-w-2xl text-2xl leading-relaxed">
          To start, <strong>press any key</strong>, <strong>tap or click anywhere</strong>, or press your <strong>switch</strong>.
        </p>
        <p className="max-w-xl text-lg text-muted">Need a hand? Anyone nearby can press a key for you. After this, you can do everything with your voice, your head, one switch, or touch.</p>
        <div className="mt-2 flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-accent text-white shadow-lift" aria-hidden>
          <span className="text-3xl">▶</span>
        </div>
      </main>
    );

  const plan = planFor(needs);
  const stepNo = ["hello", "needs", "plan", "measure"].indexOf(step) + 1;

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-[920px] flex-col px-8 pb-12 pt-10">
      <Scanner force />
      <Captions />
      <div className="mb-8 flex items-center gap-4">
        <div className="flex gap-2" aria-label={`Step ${stepNo} of 4`}>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-2.5 w-12 rounded-full ${i <= stepNo ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
        <span className="ml-auto rounded-full bg-surface px-4 py-2 text-[15px] text-muted shadow-soft">
          Press <strong>Space</strong> or your switch when the option you want is outlined · or say it
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: EASE }}>
          <div className="mb-8 flex items-end gap-5">
            <Milo size={step === "hello" ? 120 : 80} />
            <h1 className="mb-2 max-w-[640px] rounded-lg rounded-bl-sm border border-border bg-surface px-6 py-4 text-[26px] font-semibold leading-snug shadow-soft">
              {PROMPT[step]}
            </h1>
          </div>

          {step === "hello" && (
            <div className="flex flex-col gap-4">
              <p className="text-xl text-muted">I’ll ask a few easy questions. I always check with you before I do anything, and I keep a receipt of every step.</p>
              <div className="flex gap-3">
                <Button variant="primary" size="lg" onClick={next}>Let’s start</Button>
              </div>
            </div>
          )}

          {step === "needs" && (
            <div>
              <div className="grid grid-cols-2 gap-3">
                {NEEDS.map((n) => {
                  const sel = needs.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      data-head-target
                      aria-pressed={sel}
                      onClick={() => toggleNeed(n.id)}
                      className={`flex min-h-[104px] items-center gap-4 rounded-lg border-2 bg-surface p-4 text-left shadow-soft transition-all data-[head-hover=true]:border-accent data-[head-hover=true]:bg-accent-soft ${sel ? "border-accent bg-accent-soft" : "border-border hover:border-accent/40"}`}
                    >
                      <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-alt text-3xl">{n.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xl font-semibold leading-snug">{n.title}</span>
                        <span className="block text-[15px] text-muted">{n.sub}</span>
                      </span>
                      {sel && <Check size={28} className="shrink-0 text-accent" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[15px] text-muted">We never ask for a diagnosis. This only changes how Milo works for you.</p>
              <div className="mt-6 flex gap-3">
                <Button variant="ghost" onClick={back}>Back</Button>
                <Button variant="primary" size="lg" onClick={next}>{needs.length ? "Continue" : "None of these — continue"}</Button>
              </div>
            </div>
          )}

          {step === "plan" && (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-success-soft p-5">
                  <div className="mb-2 text-lg font-semibold text-success">Turned on for you</div>
                  <ul className="space-y-2 text-[17px]">
                    {plan.on.map((x) => (
                      <li key={x} className="flex gap-2"><span aria-hidden>✓</span>{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-surface-alt p-5">
                  <div className="mb-2 text-lg font-semibold">Taken out of your way</div>
                  <ul className="space-y-2 text-[17px]">
                    {(plan.off.length ? plan.off : ["Nothing — the standard setup works for you"]).map((x) => (
                      <li key={x} className="flex gap-2"><span aria-hidden>—</span>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <h2 className="mb-3 mt-8 text-xl font-semibold">Ways to talk to Milo</h2>
              <div className="grid grid-cols-4 gap-3">
                {MODES.map((m) => {
                  const sel = modes.includes(m.mode);
                  return (
                    <button
                      key={m.mode}
                      data-head-target
                      aria-pressed={sel}
                      onClick={() => toggleMode(m.mode)}
                      className={`flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-lg border-2 bg-surface p-3 shadow-soft data-[head-hover=true]:border-accent data-[head-hover=true]:bg-accent-soft ${sel ? "border-accent bg-accent-soft" : "border-border"}`}
                    >
                      <span aria-hidden className="text-4xl">{m.icon}</span>
                      <span className="text-lg font-semibold">{m.label}</span>
                      <span className="text-center text-sm text-muted">{m.desc}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="ghost" onClick={back}>Back</Button>
                <Button variant="primary" size="lg" onClick={next}>Looks good</Button>
              </div>
            </div>
          )}

          {step === "measure" && (
            <div>
              <p className="mb-4 text-lg text-muted">
                Don’t have a tape measure? Use <strong>your current chair</strong>, a <strong>photo</strong>, send the link to a <strong>helper</strong>, or choose “not sure” — I’ll mark it and ask your clinician to confirm.
              </p>
              <MeasureEditor />
              <div className="mt-8 flex gap-3">
                <Button variant="ghost" onClick={back}>Back</Button>
                <Button variant="primary" size="lg" onClick={next}>{modes.includes("head") ? "Continue to head setup" : "Finish"}</Button>
                <Button variant="ghost" onClick={next}>Skip for now</Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
