// 21 hand landmarks → wrist-relative, scale-normalised, mirrored-to-right 63-float vector.
export type LM = { x: number; y: number; z: number };

export function handFeatures(lm: LM[], handedness: "Left" | "Right" | string): number[] | null {
  if (!lm || lm.length < 21) return null;
  const w = lm[0];
  const m = lm[9];
  const scale = Math.hypot(m.x - w.x, m.y - w.y, m.z - w.z) || 1;
  // MediaPipe reports handedness for a mirrored selfie image; normalise everything to one hand
  const flip = handedness === "Left" ? -1 : 1;
  const out: number[] = [];
  for (const p of lm) {
    out.push((flip * (p.x - w.x)) / scale, (p.y - w.y) / scale, (p.z - w.z) / scale);
  }
  return out;
}
