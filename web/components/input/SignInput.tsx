"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { milo } from "@/components/milo/useMilo";
import { addLetter, backspace, chooseSuggestion, confirmNo, confirmYes, lettersToString, openConfirm } from "@/lib/agent";
import { handTracker, HandFrame } from "@/lib/sign/handTracker";
import { addSamples, allSamples, classify, clearSamples, counts, loadSamples, Sample, SIGN_LABELS } from "@/lib/sign/knn";
import { stopSpeaking } from "@/lib/speech/tts";
import { useApp } from "@/lib/store";
import { Button, Chip, EASE } from "@/components/ui";
import { Suggestions } from "./Suggestions";

const STABLE_FRAMES = 12;
const MAX_DIST = 1.6; // mean k-NN distance threshold (normalised units)
const COOLDOWN = 800;

function emit(label: string) {
  const s = useApp.getState();
  if (label === "YES") return s.confirm ? confirmYes("sign") : s.suggestions[0] && chooseSuggestion(s.suggestions[0], 1, "sign");
  if (label === "NO") return s.confirm ? confirmNo("sign") : backspace();
  if (label === "STOP") {
    stopSpeaking();
    if (s.confirm) confirmNo("sign");
    return;
  }
  if (label === "HELP")
    return openConfirm({
      question: "Say “I need help” out loud?",
      tool: "speak",
      args: { text: "I need help" },
      kind: "say",
      utterance: "I need help",
      inputMode: "sign",
      raw: "HELP",
      partial: false,
    });
  if (label === "MORE") return addLetter("_", "sign");
  addLetter(label, "sign");
}

/** Sign input (beta): fingerspelling + YES/NO/HELP/STOP/MORE via hand landmarks + k-NN. */
export function SignInput() {
  const letters = useApp((s) => s.letters);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reading, setReading] = useState<{ label: string; stable: number } | null>(null);
  const [teach, setTeach] = useState(false);
  const [rec, setRec] = useState<{ label: string; n: number } | null>(null);
  const [cnt, setCnt] = useState<Record<string, number>>({});
  const canvas = useRef<HTMLCanvasElement>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const recBuf = useRef<Sample[]>([]);
  const recLabel = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/signs/default.json")
      .then((r) => r.json())
      .then((d) => loadSamples(d.samples || []))
      .catch(() => loadSamples())
      .finally(() => alive && setCnt(counts()));
    milo.set("listening", true);
    handTracker
      .start()
      .then(() => {
        setReady(true);
        const src = handTracker.getVideo()?.srcObject;
        if (videoEl.current && src) {
          videoEl.current.srcObject = src;
          videoEl.current.play().catch(() => {});
        }
      })
      .catch(() => setErr(handTracker.error || "Couldn't start the camera."));
    return () => {
      alive = false;
      handTracker?.stop();
      milo.set("listening", false);
    };
  }, []);

  useEffect(() => {
    let last: string | null = null;
    let run = 0;
    let dsum = 0;
    let cooldownUntil = 0;
    const unsub = handTracker.subscribe((f: HandFrame) => {
      // draw landmarks
      const c = canvas.current;
      if (c) {
        const g = c.getContext("2d")!;
        g.clearRect(0, 0, c.width, c.height);
        if (f.landmarks) {
          g.fillStyle = "#2383E2";
          f.landmarks.forEach((p) => g.fillRect((1 - p.x) * c.width - 2, p.y * c.height - 2, 4, 4));
        }
      }
      if (!f.hand || !f.v) {
        last = null;
        run = 0;
        setReading(null);
        return;
      }
      // recording for Teach
      if (recLabel.current) {
        recBuf.current.push({ label: recLabel.current, v: f.v });
        setRec({ label: recLabel.current, n: recBuf.current.length });
        if (recBuf.current.length >= 40) {
          addSamples(recBuf.current);
          recBuf.current = [];
          recLabel.current = null;
          setRec(null);
          setCnt(counts());
          milo.react("happy");
        }
        return;
      }
      const r = classify(f.v);
      if (!r || r.meanDist > MAX_DIST) {
        last = null;
        run = 0;
        setReading(null);
        return;
      }
      if (r.label === last) {
        run++;
        dsum += r.meanDist;
      } else {
        last = r.label;
        run = 1;
        dsum = r.meanDist;
      }
      setReading({ label: r.label, stable: Math.min(1, run / STABLE_FRAMES) });
      if (run >= STABLE_FRAMES && dsum / run < MAX_DIST && f.t > cooldownUntil) {
        cooldownUntil = f.t + COOLDOWN;
        run = 0;
        milo.react("happy");
        emit(r.label);
      }
    });
    return () => {
      unsub();
    };
  }, []);

  const startRec = (label: string) => {
    recBuf.current = [];
    recLabel.current = label;
    setRec({ label, n: 0 });
  };
  const exportSamples = () => {
    const blob = new Blob([JSON.stringify({ version: 1, samples: allSamples() })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "default.json";
    a.click();
  };
  const trained = Object.keys(cnt).length;

  return (
    <motion.section
      aria-label="Sign input (beta)"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg px-6 pb-5 pt-4 shadow-soft"
    >
      <div className="mx-auto flex max-w-[1100px] gap-6">
        <div className="shrink-0">
          <div className="relative h-[180px] w-[240px] overflow-hidden rounded bg-surface">
            <video ref={videoEl} muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-hidden />
            <canvas ref={canvas} width={240} height={180} className="absolute inset-0" aria-hidden />
            {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">{err ?? "Starting camera…"}</div>}
          </div>
          <p className="mt-1 text-xs text-muted">Video stays on this device</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-3">
            <Milo size={36} />
            <Chip tone="warning">Sign input (beta): fingerspelling and a few signs. Not a full ASL translator.</Chip>
            <div className="ml-auto flex gap-2">
              <Button onClick={() => setTeach(!teach)}>{teach ? "Done teaching" : "Teach Milo a sign"}</Button>
            </div>
          </div>

          {teach ? (
            <div>
              <p className="mb-2 text-sm text-muted">
                {rec ? `Hold the sign “${rec.label}”… ${rec.n}/40` : "Pick a label, then hold the sign steady in view. 40 frames are recorded. (Static approximations; J and Z need motion and are left out.)"}
              </p>
              <div className="grid grid-cols-10 gap-1.5">
                {SIGN_LABELS.map((l) => (
                  <button
                    key={l}
                    data-head-target
                    onClick={() => startRec(l)}
                    disabled={!!rec || !ready}
                    className={`rounded px-1 py-2 text-sm font-semibold ${cnt[l] ? "bg-success-soft text-success" : "bg-surface"} disabled:opacity-50`}
                  >
                    {l}
                    {cnt[l] ? <span className="block text-[10px] font-normal">{cnt[l]}</span> : null}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Button variant="ghost" onClick={exportSamples}>Export samples</Button>
                <Button variant="ghost" onClick={() => { clearSamples(); setCnt(counts()); }}>Clear my samples</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm text-muted">Seeing</span>
                <span className="min-w-[64px] font-mono text-3xl font-semibold">{reading?.label ?? "—"}</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-border" aria-hidden>
                  <div className="h-full bg-accent" style={{ width: `${(reading?.stable ?? 0) * 100}%` }} />
                </div>
                <span className="ml-auto font-mono text-2xl font-semibold tracking-widest">{lettersToString(letters).toUpperCase()}</span>
              </div>
              {trained < 2 ? (
                <p className="text-muted">No signs taught yet. Press “Teach Milo a sign” to record a few letters plus YES and NO.</p>
              ) : (
                <Suggestions mode="sign" compact />
              )}
              <p className="mt-2 text-xs text-muted">YES = confirm / pick top · NO = cancel / delete · HELP = “I need help” · STOP = stop · MORE = next word</p>
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}
