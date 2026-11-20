"use client";
// The client side of the intent pipeline (WRITEUP §8.1):
// InputEvent → normalise → (partial? → predict → pick) → route → confirm → tool → respond → receipt → Milo → TTS
import { milo } from "@/components/milo/useMilo";
import { api, uid } from "./api";
import { predictionStrategy, track } from "./analytics";
import { looksLikeLetters, predictLocal } from "./phrasesLocal";
import { speak } from "./speech/tts";
import { chime, notify, soften } from "./sounds";
import { PendingConfirm, useApp } from "./store";
import type { InputMode, ModelCall, RouteResult, Suggestion, ToolName } from "./types";

let navigate: (href: string) => void = () => {};
export function registerNavigate(fn: (href: string) => void) {
  navigate = fn;
}

const READ_ONLY = new Set<ToolName>(["fit_check", "status", "coverage"]);
const LINK_LABEL: Record<string, string> = {
  "/fit": "Open Fit Check",
  "/appeal": "Open Coverage & Appeal",
  "/shop": "Open Shop",
};

let lastInputMode: InputMode = "text";
let sentenceStart = 0;

const st = () => useApp.getState();

function shouldSpeak(mode: InputMode) {
  const set = st().settings;
  return set.voiceOutput && (mode !== "text" || set.readEverything);
}

function firstSentence(s: string) {
  const m = s.match(/^.+?[.!?](\s|$)/);
  return m ? m[0].trim() : s;
}

export function say(text: string, mode: InputMode = lastInputMode) {
  st().announce(text);
  if (shouldSpeak(mode)) {
    const short = text.length > 160 ? `${firstSentence(text)} Want the details?` : text;
    speak(short);
  }
}

function miloMessage(text: string, extra: Partial<{ link: string | null; receiptId: string }> = {}) {
  notify();
  st().addMessage({
    id: uid("m"),
    role: "milo",
    text,
    link: extra.link ?? null,
    linkLabel: extra.link ? LINK_LABEL[extra.link] ?? (extra.link.startsWith("/fit/") ? "Open details" : "Open") : undefined,
    receiptId: extra.receiptId,
  });
}

// ---------------------------------------------------------------------------
// Letters (head / sign / partial text)
// ---------------------------------------------------------------------------

let predictTimer: ReturnType<typeof setTimeout> | null = null;
let predictSeq = 0;

export function lettersToString(letters: string[]) {
  return letters.includes("_") ? letters.join("") : letters.join(" ");
}

export function setLetters(letters: string[]) {
  if (letters.length === 0) sentenceStart = 0;
  else if (sentenceStart === 0) sentenceStart = performance.now();
  st().setLetters(letters);
  refreshSuggestions(letters);
}

export function addLetter(l: string, mode: InputMode) {
  lastInputMode = mode;
  setLetters([...st().letters, l]);
  track("letters_entered", { mode, count: st().letters.length });
}

export function backspace() {
  setLetters(st().letters.slice(0, -1));
}

export function clearLetters() {
  setLetters([]);
  st().setSuggestions([], "local");
}

function refreshSuggestions(letters: string[]) {
  const s = lettersToString(letters);
  if (!letters.filter((l) => l !== "_").length) {
    st().setSuggestions([], "local");
    return;
  }
  const local = predictLocal(s);
  st().setSuggestions(local, "local");
  if (local[0] && local[0].confidence < 0.5) milo.react("confused");
  if (predictTimer) clearTimeout(predictTimer);
  const seq = ++predictSeq;
  predictTimer = setTimeout(async () => {
    milo.set("thinking", true);
    try {
      const res = await api<{ suggestions: Suggestion[]; model: ModelCall | null; source: string }>("/api/predict", {
        json: { letters: s, mode: lastInputMode, context: { strategy: predictionStrategy() } },
        timeoutMs: 6000,
      });
      if (seq === predictSeq && res.suggestions?.length) {
        st().setSuggestions(res.suggestions, res.source === "live" ? "live" : "local", res.model);
      }
    } catch {
      /* keep local suggestions */
    } finally {
      if (seq === predictSeq) milo.set("thinking", false);
    }
  }, 150);
}

/** User picked a suggestion tile (rank is 1-based). */
export async function chooseSuggestion(s: Suggestion, rank: number, mode: InputMode) {
  lastInputMode = mode;
  milo.react("happy");
  const letters = st().letters;
  const raw = lettersToString(letters);
  const moves = letters.length + 1; // letters + the pick
  const alternatives = st().suggestions;
  const predictModel = st().predictModel;
  track("suggestion_rank_chosen", { rank, mode, strategy: predictionStrategy(), value: rank });
  track("moves_per_sentence", { moves, mode, letters: s.text.length });
  track("time_to_intent_ms", { ms: Math.round(performance.now() - sentenceStart), mode });
  api("/api/memory/phrase", { json: { text: s.text, kind: s.kind, tool: s.tool } }).catch(() => {});

  useApp.setState({ lastSaving: { moves, saved: Math.max(0, s.text.replace(/[^A-Za-z]/g, "").length - moves), text: s.text } });
  st().addMessage({ id: uid("m"), role: "user", text: s.text, mode, letters: raw });
  clearLetters();

  const meta = { moves, rank, dwellMs: st().settings.dwellMs };
  if (s.kind === "say" || !s.tool) {
    openConfirm({
      question: `Say “${s.text}” out loud?`,
      tool: "speak",
      args: { text: s.text },
      kind: "say",
      utterance: s.text,
      inputMode: mode,
      raw,
      partial: true,
      meta,
      alternatives,
      confidence: s.confidence,
      predictModel,
    });
    return;
  }
  await routeAndConfirm(s.text, mode, { raw, partial: true, meta, alternatives, confidence: s.confidence, predictModel, toolHint: s.tool });
}

/** "None of these" */
export function noneOfThese() {
  milo.react("confused");
  track("suggestion_rank_chosen", { rank: 0, mode: lastInputMode });
  say("Okay. Add another letter, or spell the start of the word.");
}

// ---------------------------------------------------------------------------
// Full utterances (text / voice)
// ---------------------------------------------------------------------------

export async function submitUtterance(text: string, mode: InputMode) {
  const t = text.trim();
  if (!t) return;
  lastInputMode = mode;
  track("input_mode_used", { mode });
  if (mode === "text" && looksLikeLetters(t)) {
    const letters = t.includes(" ") ? t.split(/\s+/).map((x) => x.toUpperCase()) : t.toUpperCase().split("");
    setLetters(letters);
    return;
  }
  st().addMessage({ id: uid("m"), role: "user", text: t, mode });
  await routeAndConfirm(t, mode, { raw: t, partial: false });
}

async function routeAndConfirm(
  utterance: string,
  mode: InputMode,
  ctx: {
    raw: string;
    partial: boolean;
    meta?: Record<string, any>;
    alternatives?: Suggestion[];
    confidence?: number;
    predictModel?: ModelCall | null;
    toolHint?: ToolName | null;
  }
) {
  milo.set("thinking", true);
  let r: RouteResult;
  try {
    r = await api<RouteResult>("/api/route", { json: { utterance, mode }, timeoutMs: 9000 });
  } catch {
    r = { kind: "say", tool: "speak", args: { text: utterance }, confirm_text: `Say “${utterance}” out loud?`, needs_confirm: true, source: "local" };
  } finally {
    milo.set("thinking", false);
  }
  if (ctx.toolHint && r.tool !== ctx.toolHint && ctx.toolHint !== "speak") {
    // prediction already knew the tool; trust it but keep router args when compatible
    r = { ...r, kind: "task", tool: ctx.toolHint, args: r.tool === ctx.toolHint ? r.args : defaultArgs(ctx.toolHint, utterance), needs_confirm: !READ_ONLY.has(ctx.toolHint) };
  }
  const pending: PendingConfirm = {
    question: r.confirm_text,
    tool: r.tool,
    args: r.args || {},
    kind: r.kind,
    utterance,
    inputMode: mode,
    raw: ctx.raw,
    partial: ctx.partial,
    meta: ctx.meta,
    alternatives: ctx.alternatives,
    confidence: ctx.confidence,
    predictModel: ctx.predictModel,
    routeModel: r.model ?? null,
  };
  if (READ_ONLY.has(r.tool)) {
    await act(pending, null);
  } else {
    openConfirm(pending);
  }
}

function defaultArgs(tool: ToolName, utterance: string): Record<string, any> {
  const t = utterance.toLowerCase();
  if (tool === "appeal") return { action: /file|submit/.test(t) ? "file" : /review/.test(t) ? "review" : /fix|revise/.test(t) ? "revise" : "draft" };
  if (tool === "shop") return { item: "glide-p2", action: "checkout" };
  if (tool === "caregiver") return { action: "request_approval", item: "glide-p2" };
  if (tool === "status") return { topic: "appeal" };
  if (tool === "fit_check") {
    const m = ["glide", "comet", "terra", "nimbus", "aero", "urban", "strider", "basic"].find((k) => t.includes(k));
    const ids: Record<string, string> = { glide: "glide-p2", comet: "comet-mw", terra: "terra-hd", nimbus: "nimbus-p3", aero: "aero-m1", urban: "urban-fold", strider: "strider-rw", basic: "basic-manual" };
    return m ? { item: ids[m] } : {};
  }
  return {};
}

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

export function openConfirm(p: PendingConfirm) {
  st().setConfirm(p);
  milo.set("waiting", true);
  say(p.question, p.inputMode);
}

export async function confirmYes(mode: InputMode) {
  const p = st().confirm;
  if (!p) return;
  st().setConfirm(null);
  milo.set("waiting", false);
  milo.react("happy");
  chime();
  await act(p, true, mode);
}

export async function confirmNo(mode: InputMode) {
  const p = st().confirm;
  if (!p) return;
  st().setConfirm(null);
  milo.set("waiting", false);
  soften();
  await act(p, false, mode);
}

// ---------------------------------------------------------------------------
// Act
// ---------------------------------------------------------------------------

async function startVerification(purpose: string): Promise<string | null> {
  try {
    const v = await api<{ id: string }>("/api/verify/start", { json: { user: "Maria Alvarez", purpose } });
    const ok = await new Promise<boolean>((resolve) => st().setVerify({ id: v.id, purpose, resolve }));
    st().setVerify(null);
    return ok ? v.id : null;
  } catch {
    return null;
  }
}

export async function act(p: PendingConfirm, confirmed: boolean | null, confirmMode?: InputMode, extraArgs: Record<string, any> = {}) {
  const input = {
    id: uid("evt"),
    ts: new Date().toISOString(),
    mode: p.inputMode,
    raw: p.raw,
    partial: p.partial,
    meta: p.meta,
  };
  const args = { ...p.args, ...extraArgs };
  milo.set("thinking", true);
  let res: any;
  try {
    res = await api("/api/act", {
      json: {
        tool: p.tool,
        args,
        confirmed,
        input_event: input,
        interpreted_as: p.utterance,
        alternatives: p.alternatives,
        confidence: p.confidence,
        confirm_mode: confirmed === null ? null : confirmMode ?? p.inputMode,
        predict_model: p.predictModel ?? null,
        route_model: p.routeModel ?? null,
      },
      timeoutMs: 45000,
    });
  } catch {
    milo.set("thinking", false);
    milo.react("confused");
    miloMessage("I couldn't reach my tools just now. Try again in a moment.");
    return;
  }
  milo.set("thinking", false);
  st().bumpReceipts();
  st().bumpData();

  const result = res.result || {};
  // multi-step flows
  if (p.tool === "appeal" && result.status === "needs_verification") {
    miloMessage(res.summary, { receiptId: res.receipt_id });
    const vid = await startVerification("appeal.file");
    if (vid) return act(p, true, confirmMode, { verification_id: vid });
    miloMessage("Verification cancelled. Nothing was filed.");
    return;
  }
  if (p.tool === "shop" && result.status === "needs_caregiver") {
    miloMessage(res.summary, { receiptId: res.receipt_id });
    const r = await api<{ token: string; to: string }>("/api/caregiver/request", {
      json: { item_id: args.item, amount_usd: result.priceUsd, note: "Power wheelchair purchase" },
    });
    pendingCheckout = { p, confirmMode, args, token: r.token };
    miloMessage(`Sent to ${r.to} for approval. I'll continue when ${r.to} answers.`, { link: `/caregiver/${r.token}` });
    say(`Sent to ${r.to} for approval.`, p.inputMode);
    return;
  }
  if (p.tool === "shop" && result.status === "needs_verification") {
    if (result.readAloud) await speak(result.readAloud);
    const vid = await startVerification("shop.checkout");
    if (vid) return act(p, true, confirmMode, { ...args, verification_id: vid });
    miloMessage("Verification cancelled. Nothing was ordered.");
    return;
  }

  if (p.tool === "speak" && confirmed) {
    st().setSpoken(p.utterance);
    milo.set("speaking", true);
    await speak(p.utterance, { who: "user", volume: 1, rate: Math.max(0.6, (st().settings.voiceRate || 1) * 0.9) });
    setTimeout(() => st().setSpoken(null), 1200);
    miloMessage(`Said: “${p.utterance}”`, { receiptId: res.receipt_id });
    return;
  }

  miloMessage(res.summary, { link: res.link ?? null, receiptId: res.receipt_id });
  if (
    (p.tool === "appeal" && result.status === "filed") ||
    (p.tool === "shop" && result.status === "ordered")
  ) {
    milo.react("celebrate");
  } else if (confirmed === false) {
    milo.react("idle");
  }
  say(res.summary, p.inputMode);
  track("tool_completed", { tool: p.tool, mode: p.inputMode, confirmed });
  if (res.link && p.tool !== "status" && p.tool !== "speak" && confirmed !== false) {
    // navigate to the result page for richer views
    if (p.tool === "fit_check" || p.tool === "appeal" || p.tool === "coverage") navigate(res.link);
  }
}

// caregiver approval resumes checkout
let pendingCheckout: { p: PendingConfirm; confirmMode?: InputMode; args: Record<string, any>; token: string } | null = null;
export async function onCaregiverDecision(d: { token: string; status: string; to: string }) {
  if (!pendingCheckout || pendingCheckout.token !== d.token) return;
  const pc = pendingCheckout;
  pendingCheckout = null;
  if (d.status === "approved") {
    milo.react("celebrate");
    miloMessage(`${d.to} approved. Let's finish checkout.`);
    await act(pc.p, true, pc.confirmMode, { ...pc.args, caregiver_token: d.token });
  } else {
    milo.react("confused");
    miloMessage(`${d.to} declined. Nothing was ordered.`);
  }
}

/** Quick actions + Director buttons run as if typed. */
export function quick(text: string) {
  return submitUtterance(text, "text");
}

/** For voice mode: map spoken words to confirm. Returns true if handled. */
export function handleVoiceConfirm(text: string): boolean {
  if (!st().confirm) return false;
  const t = text.toLowerCase();
  if (/\b(yes|yeah|yep|confirm|do it|okay|ok|sure|go ahead)\b/.test(t)) {
    confirmYes("voice");
    return true;
  }
  if (/\b(no|nope|cancel|stop|don't|do not)\b/.test(t)) {
    confirmNo("voice");
    return true;
  }
  return false;
}
