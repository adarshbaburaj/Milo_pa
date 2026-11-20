"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Milo } from "@/components/milo/Milo";
import { milo } from "@/components/milo/useMilo";
import { addLetter, backspace, chooseSuggestion, clearLetters, confirmNo, confirmYes, lettersToString } from "@/lib/agent";
import { loadCalibration } from "@/lib/head/calibration";
import { faceTracker } from "@/lib/head/faceTracker";
import { useApp } from "@/lib/store";
import { EASE, Tile } from "@/components/ui";
import { Calibrate } from "./Calibrate";
import { HeadPointer, SelfView } from "./HeadPointer";
import { Suggestions } from "./Suggestions";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Head mode overlay: composer + 4 suggestions + 6×5 letter grid, driven by head pose. */
export function HeadBoard() {
  const letters = useApp((s) => s.letters);
  const suggestions = useApp((s) => s.suggestions);
  const lastSaving = useApp((s) => s.lastSaving);
  const ready = useApp((s) => s.headReady);
  const setMode = useApp((s) => s.setMode);
  const confirm = useApp((s) => s.confirm);
  const lastReply = useApp((s) => [...s.messages].reverse().find((m) => m.role === "milo")?.text);
  const [needsCal, setNeedsCal] = useState(false);
  const [faceOk, setFaceOk] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loadCalibration()?.source !== faceTracker.pointer.replace("pose", "matrix")) {
      setNeedsCal(true);
      return;
    }
    milo.set("listening", true);
    faceTracker
      .start()
      .then(() => useApp.getState().setHeadReady(true))
      .catch(() => setErr(faceTracker.error || "Couldn't start the camera."));
    return () => {
      milo.set("listening", false);
    };
  }, []);

  useEffect(
    () => () => {
      faceTracker?.stop();
      useApp.getState().setHeadReady(false);
      milo.set("listening", false);
      milo.set("sleep", false);
    },
    []
  );

  const close = () => setMode("text");
  const done = () => {
    const top = suggestions[0];
    if (top) chooseSuggestion(top, 1, "head");
  };
  const onShake = () => {
    if (useApp.getState().confirm) return confirmNo("head");
    if (useApp.getState().letters.length) {
      backspace();
      milo.react("confused");
    }
  };
  const onNodNoTarget = () => {
    if (useApp.getState().confirm) confirmYes("head");
  };

  if (needsCal)
    return (
      <Calibrate
        onDone={() => {
          setNeedsCal(false);
          milo.set("listening", true);
        }}
        onCancel={() => {
          setNeedsCal(false);
          setMode("text");
        }}
      />
    );

  const composer = lettersToString(letters).toUpperCase().split(" ").filter(Boolean);

  return (
    <>
      <div className="no-print fixed right-4 top-14 z-[55] flex flex-col items-end gap-2">
        <button
          data-head-target
          onClick={() => {
            clearLetters();
            close();
          }}
          aria-label="Exit head mode (Esc)"
          className="flex min-h-[56px] items-center gap-2 rounded-full border-2 border-border bg-surface px-6 text-lg font-semibold shadow-lift hover:bg-surface-hover data-[head-hover=true]:ring-[3px] data-[head-hover=true]:ring-accent"
        >
          ✕ Exit head mode <span className="text-sm font-normal text-muted">Esc</span>
        </button>
        <SelfView />
        <span className="rounded-full bg-surface px-2 text-xs text-muted">🔒 Video stays on this device · your nose is the pointer</span>
      </div>
      <motion.section
        aria-label="Head mode letter board"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: faceOk ? 1 : 0.5 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[32px] border-t-2 border-border bg-bg px-6 pb-4 pt-4 shadow-lift"
        style={{ height: "max(60vh, 720px)", maxHeight: "calc(100vh - 40px)" }}
      >
        {/* composer */}
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 pb-3">
          <Milo size={40} />
          <div className="flex min-h-[48px] flex-1 items-center gap-2" aria-live="polite" aria-label="Chosen letters">
            {composer.length ? (
              composer.map((l, i) => (
                <span key={i} className="rounded-full bg-accent px-4 py-1 font-mono text-2xl font-semibold text-white">
                  {l.replace(/_/g, " ␣ ")}
                </span>
              ))
            ) : (
              <span className={lastReply ? "text-lg" : "text-muted"}>
                {lastReply ?? "First letter of each word"}
                {err || ready ? "" : " · starting camera…"}
              </span>
            )}
          </div>
          <div className="text-right text-sm text-muted">
            {err ? (
              <span className="text-[#b42323]">{err}</span>
            ) : !faceOk ? (
              <span>I can’t see you — move into the camera view.</span>
            ) : lastSaving ? (
              <span>
                {lastSaving.moves} moves · saved {lastSaving.saved} letters
              </span>
            ) : (
              <span>dwell or nod = choose · shake = back</span>
            )}
          </div>
        </div>

        {/* suggestions */}
        <div className="mx-auto w-full max-w-[1100px] pb-3">
          {suggestions.length ? (
            <Suggestions mode="head" compact />
          ) : (
            <div className="flex h-[96px] items-center justify-center rounded-lg border-2 border-dashed border-border text-lg text-muted">
              Pick a letter — suggestions appear here
            </div>
          )}
        </div>

        {/* letter grid 6 × 5 */}
        <div className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-6 grid-rows-5 gap-2">
          {LETTERS.map((l) => (
            <Tile key={l} label={`Letter ${l}`} size="lg" onSelect={() => addLetter(l, "head")} className="!min-h-[88px]">
              {l}
            </Tile>
          ))}
          <Tile label="Next word" onSelect={() => addLetter("_", "head")} className="!min-h-[88px] text-lg">
            ␣ next word
          </Tile>
          <Tile label="Delete last letter" onSelect={backspace} className="!min-h-[88px] text-2xl" disabled={!letters.length}>
            ⌫
          </Tile>
          <Tile label="Done: choose the top suggestion" onSelect={done} className="!min-h-[88px] text-lg" disabled={!suggestions.length || !!confirm}>
            ✓ done
          </Tile>
          <Tile
            label="Close head mode"
            onSelect={() => {
              clearLetters();
              close();
            }}
            className="!min-h-[88px] text-lg"
          >
            ✕ close
          </Tile>
        </div>
      </motion.section>
      <HeadPointer onShake={onShake} onNodNoTarget={onNodNoTarget} onFace={setFaceOk} enabled={ready && !err} />
    </>
  );
}
