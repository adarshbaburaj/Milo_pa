// In-browser k-NN (k = 5, Euclidean) over 63-float hand vectors.
export type Sample = { label: string; v: number[] };

const KEY = "milo.signSamples";

export const SIGN_LABELS = [
  ..."ABCDEFGHIKLMNOPQRSTUVWXY".split(""), // static letters (no J, Z)
  "YES", "NO", "HELP", "STOP", "MORE",
];

let samples: Sample[] = [];

export function loadSamples(defaults: Sample[] = []) {
  try {
    const raw = localStorage.getItem(KEY);
    samples = [...defaults, ...(raw ? (JSON.parse(raw) as Sample[]) : [])];
  } catch {
    samples = [...defaults];
  }
  return samples;
}

export function addSamples(s: Sample[]) {
  samples.push(...s);
  try {
    const mine = JSON.parse(localStorage.getItem(KEY) || "[]") as Sample[];
    localStorage.setItem(KEY, JSON.stringify([...mine, ...s]));
  } catch {}
}

export function clearSamples(label?: string) {
  samples = label ? samples.filter((s) => s.label !== label) : [];
  try {
    const mine = (JSON.parse(localStorage.getItem(KEY) || "[]") as Sample[]).filter((s) => (label ? s.label !== label : false));
    localStorage.setItem(KEY, JSON.stringify(mine));
  } catch {}
}

export function allSamples() {
  return samples;
}

export function counts(): Record<string, number> {
  const c: Record<string, number> = {};
  samples.forEach((s) => (c[s.label] = (c[s.label] || 0) + 1));
  return c;
}

function dist(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

export function classify(v: number[], k = 5): { label: string; meanDist: number; votes: number } | null {
  if (samples.length < k) return null;
  const nn = samples.map((s) => ({ s, d: dist(v, s.v) })).sort((a, b) => a.d - b.d).slice(0, k);
  const votes: Record<string, { n: number; d: number }> = {};
  nn.forEach(({ s, d }) => {
    votes[s.label] ||= { n: 0, d: 0 };
    votes[s.label].n++;
    votes[s.label].d += d;
  });
  const [label, best] = Object.entries(votes).sort((a, b) => b[1].n - a[1].n || a[1].d - b[1].d)[0];
  return { label, meanDist: best.d / best.n, votes: best.n };
}
