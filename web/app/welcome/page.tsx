"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Calibrate } from "@/components/input/Calibrate";
import { Milo } from "@/components/milo/Milo";
import { milo } from "@/components/milo/useMilo";
import { api } from "@/lib/api";
import { STT, sttAvailable } from "@/lib/speech/stt";
import { useApp } from "@/lib/store";
import type { InputMode, Profile } from "@/lib/types";
import { Button, EASE, PropertyRow, Tile, Toggle } from "@/components/ui";

const MODES: { mode: InputMode; icon: string; label: string; desc: string; words: RegExp }[] = [
  { mode: "text", icon: "Aa", label: "Type", desc: "Keyboard, large text, or first letters", words: /\b(type|typing|text|keyboard)\b/ },
  { mode: "voice", icon: "🎙", label: "Speak", desc: "Talk to Milo; Milo talks back", words: /\b(speak|voice|talk)\b/ },
  { mode: "head", icon: "🙂", label: "Move my head", desc: "Pick first letters with head movements", words: /\b(head|move)\b/ },
  { mode: "sign", icon: "🤟", label: "Sign (beta)", desc: "Fingerspelling and a few signs", words: /\b(sign|signing)\b/ },
];

const WHY: Record<string, string> = {
  seat: "Seat width should be 1–3″ wider than your hips so you sit safely without sliding.",
  door: "A chair needs its width plus about 2″ for your hands to pass through a door.",
  transfer: "Seat height inside this range makes moving in and out of the chair safer.",
  hall: "Power chairs need room to turn around in your hallway.",
  propel: "Insurers ask whether you can push a manual chair for daily activities at home.",
  insurer: "Used to check coverage and build your appeal.",
  caregiver: "Bigger purchases can ask them to approve first.",
};

export default function Welcome() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const hydrate = useApp((s) => s.hydrate);
  const [modes, setModes] = useState<InputMode[]>(["text", "voice", "head"]);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => hydrate(), [hydrate]);
  useEffect(() => {
    api("/api/profile").then(setProfile).catch(() => {});
  }, []);
  useEffect(() => {
    if (step === 0) setTimeout(() => milo.react("happy"), 400);
  }, [step]);

  // voice can pick mode cards on step 1
  useEffect(() => {
    if (step !== 1 || !sttAvailable()) return;
    const stt = new STT(
      {
        onFinal: (t) => {
          const m = MODES.find((x) => x.words.test(t.toLowerCase()));
          if (m) toggle(m.mode);
          if (/\b(next|continue|done)\b/i.test(t)) setStep(2);
        },
      },
      true
    );
    // only listen if the user already granted mic; avoid surprising prompts
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => p.state === "granted" && stt.start())
      .catch(() => {});
    return () => stt.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const toggle = (m: InputMode) => {
    milo.react("happy");
    setModes((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));
  };

  const finish = () => {
    const ms = modes.length ? modes : (["text"] as InputMode[]);
    setSettings({ onboarded: true, inputModes: ms });
    useApp.getState().setMode(ms.includes("head") ? "head" : ms.includes("voice") ? "voice" : "text");
    milo.react("celebrate");
    router.push("/");
  };

  const next = () => {
    if (step === 2) {
      if (modes.includes("head")) setStep(3);
      else finish();
    } else setStep(step + 1);
  };

  if (step === 3)
    return (
      <Calibrate
        onDone={() => {
          finish();
        }}
        onCancel={finish}
      />
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col px-6 pt-16" id="main">
      <div className="mb-10 flex items-center gap-2 text-sm text-muted" aria-label={`Step ${step + 1} of ${modes.includes("head") ? 4 : 3}`}>
        {[0, 1, 2, ...(modes.includes("head") ? [3] : [])].map((i) => (
          <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
          {step === 0 && (
            <div className="flex flex-col items-start gap-6">
              <Milo size={96} />
              <h1 className="text-[32px] font-semibold leading-10 tracking-tight">Hi, I’m Milo.</h1>
              <p className="text-lg">I’m here to help you get things done, any way you like to talk.</p>
              <p className="text-muted">You can type, speak, move your head, or sign. I always ask before I do anything, and I keep a receipt of every step.</p>
              <Button variant="primary" onClick={next}>Let’s start</Button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="mb-2 text-[32px] font-semibold leading-10 tracking-tight">How do you want to talk to me?</h1>
              <p className="mb-6 text-muted">Pick any. You can change this later. You can also say “speak” or “head”.</p>
              <div className="grid grid-cols-2 gap-3">
                {MODES.map((m) => (
                  <Tile key={m.mode} label={`${m.label}: ${m.desc}`} selected={modes.includes(m.mode)} onSelect={() => toggle(m.mode)} className="!h-40 flex-col gap-2 px-4">
                    <span className="text-3xl font-semibold" aria-hidden>{m.icon}</span>
                    <span className="text-lg font-medium">{m.label}</span>
                    <span className="text-sm text-muted">{m.desc}</span>
                  </Tile>
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button variant="primary" onClick={next} disabled={!modes.length}>Continue</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="mb-2 text-[32px] font-semibold leading-10 tracking-tight">About you</h1>
              <p className="mb-6 text-muted">
                Measurements and abilities only, never diagnoses. Prefilled with demo data (fictional).
              </p>
              {profile && (
                <div className="border-y border-border py-2">
                  <PropertyRow label="Name">{profile.name}</PropertyRow>
                  <Row label="Seat width range" value={`${profile.seatWidthRangeIn[0]}–${profile.seatWidthRangeIn[1]}″`} why={WHY.seat} />
                  <Row label="Hip width" value={`${profile.hipWidthIn}″`} why={WHY.seat} />
                  <Row label="Narrowest doorway" value={`${profile.home.narrowestDoorwayIn}″ (${profile.home.narrowestDoorwayName})`} why={WHY.door} />
                  <Row label="Transfer height" value={`${profile.transferHeightRangeIn[0]}–${profile.transferHeightRangeIn[1]}″`} why={WHY.transfer} />
                  <Row label="Hallway turning space" value={`${profile.home.hallwayTurnSpaceIn}″`} why={WHY.hall} />
                  <Row label="Can self-propel a manual chair for" value={`about ${profile.canSelfPropelFt} ft`} why={WHY.propel} />
                  <Row label="Insurer" value={profile.insurer} why={WHY.insurer} />
                  <Row label="Caregiver" value={`${profile.caregiver.name} (${profile.caregiver.relation}) · approves over $${profile.caregiver.approvalOverUsd}`} why={WHY.caregiver} />
                </div>
              )}
              <div className="mt-8 flex gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" onClick={next}>{modes.includes("head") ? "Continue to calibration" : "Finish"}</Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function Row({ label, value, why }: { label: string; value: string; why: string }) {
  return (
    <PropertyRow label={label} hint={<Toggle summary={<span className="text-sm text-muted">Why we ask</span>}><p className="text-sm text-muted">{why}</p></Toggle>}>
      {value}
    </PropertyRow>
  );
}
