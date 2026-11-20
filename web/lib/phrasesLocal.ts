// Instant, in-browser prediction (mirror of api/engine.py predict_local).
// Shown immediately after each letter; replaced when /api/predict returns.
import seed from "./phrasesSeed.json";
import type { Suggestion, ToolName } from "./types";

type Phrase = { text: string; kind: string; tool: string; count: number; usualTime: string };

const STOP = new Set(["my", "the", "a", "an", "to", "of", "is", "if", "for", "in", "on", "at", "it", "me", "does", "did"]);

let phrases: Phrase[] = seed as Phrase[];
export function setPhrases(p: Phrase[]) {
  if (Array.isArray(p) && p.length) phrases = p;
}

export function parseLetters(letters: string): string[] {
  const s = letters.trim().toLowerCase().replace(/␣/g, "_");
  if (s.includes("_")) return s.split("_").map((g) => g.replace(/\s/g, "")).filter(Boolean);
  return s.split("").filter((c) => /[a-z]/.test(c));
}

const wordsOf = (t: string) => t.toLowerCase().match(/[a-z0-9']+/g) || [];

function align(tokens: string[], words: string[]): [number, number] | null {
  let best: [number, number] | null = null;
  const go = (i: number, j: number, skips: number) => {
    if (i === tokens.length) {
      const c: [number, number] = [skips, words.length - j];
      if (!best || c[1] < best[1] || (c[1] === best[1] && c[0] < best[0])) best = c;
      return;
    }
    if (j === words.length) return;
    if (words[j].startsWith(tokens[i])) go(i + 1, j + 1, skips);
    if (STOP.has(words[j])) go(i, j + 1, skips + 1);
  };
  go(0, 0, 0);
  return best;
}

function scorePhrase(tokens: string[], text: string): number {
  const words = wordsOf(text);
  if (!tokens.length || !words.length) return 0;
  const al = align(tokens, words) as [number, number] | null;
  if (al) {
    const [skips, trailing] = al;
    if (trailing === 0) return Math.max(0.6, 1 - 0.08 * skips);
    const consumed = words.length - trailing;
    return Math.max(0.2, 0.45 + (0.3 * consumed) / words.length - 0.05 * skips);
  }
  const joined = tokens.join("");
  if (joined.length >= 2 && words[0]!.startsWith(joined)) return 0.7;
  return 0;
}

function bucket(h: number) {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

export function predictLocal(letters: string, k = 4, now = new Date()): Suggestion[] {
  const tokens = parseLetters(letters);
  const maxCount = Math.max(1, ...phrases.map((p) => p.count || 0));
  const boost = (p: Phrase) =>
    (0.1 * Math.log1p(p.count || 0)) / Math.log1p(maxCount) + (p.usualTime === bucket(now.getHours()) ? 0.06 : 0);
  const sugg = (p: Phrase, c: number): Suggestion => ({
    text: p.text,
    kind: (p.kind as "say" | "task") || "say",
    tool: p.tool && p.tool !== "none" ? (p.tool as ToolName) : null,
    confidence: Math.round(Math.min(0.99, c) * 100) / 100,
  });
  if (!tokens.length) return [...phrases].sort((a, b) => b.count - a.count).slice(0, k).map((p) => sugg(p, 0.3));

  const scored: [number, Phrase][] = [];
  for (const p of phrases) {
    const b = scorePhrase(tokens, p.text);
    if (b > 0) scored.push([b + boost(p), p]);
  }
  const joined = tokens.join("");
  if (joined.length >= 3) {
    const seen = new Set<string>();
    for (const p of phrases)
      for (const w of wordsOf(p.text))
        if (w.length > joined.length && w.startsWith(joined) && !seen.has(w) && !STOP.has(w)) {
          seen.add(w);
          scored.push([0.55, { text: w[0].toUpperCase() + w.slice(1), kind: "say", tool: "none", count: 0, usualTime: "any" }]);
        }
  }
  if (scored.length < k) {
    const have = new Set(scored.map(([, p]) => p.text));
    for (const p of phrases) {
      if (have.has(p.text)) continue;
      const ws = wordsOf(p.text);
      scored.push([(ws[0]?.startsWith(tokens[0][0]) ? 0.15 : 0.02) + boost(p) * 0.5, p]);
    }
  }
  scored.sort((a, b) => b[0] - a[0]);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const [s, p] of scored) {
    const key = p.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sugg(p, s));
    if (out.length === k) break;
  }
  return out;
}

/** "Partial text is allowed": ≤ 4 chars, or all-caps letters separated by spaces (e.g. "W W A"). */
export function looksLikeLetters(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^([A-Za-z]\s+)+[A-Za-z]$/.test(t) && t === t.toUpperCase()) return true;
  return t.length <= 4 && /^[A-Za-z_ ]+$/.test(t) && !/^(hi|yes|no|ok|okay|stop|help|more)$/i.test(t);
}
