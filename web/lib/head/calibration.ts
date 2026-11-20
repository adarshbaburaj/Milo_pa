// Calibration: neutral pose + signed gains so a comfortable head turn covers the screen.
export type Calibration = {
  source: "matrix" | "landmarks" | "nose";
  yaw0: number;
  pitch0: number;
  gainX: number; // screen-fractions per unit yaw (signed)
  gainY: number;
  at: string;
};

const KEY = "milo.headCalibration";

export function defaultCalibration(source: "matrix" | "landmarks" | "nose"): Calibration {
  if (source === "nose") return { source, yaw0: 0.5, pitch0: 0.5, gainX: 1 / 0.22, gainY: 1 / 0.16, at: "" };
  // matrix: ~±0.3 rad comfortable turn; landmarks: ~±0.15 ratio
  return source === "matrix"
    ? { source, yaw0: 0, pitch0: 0, gainX: -1 / 0.5, gainY: -1 / 0.35, at: "" }
    : { source, yaw0: 0, pitch0: 0.05, gainX: -1 / 0.3, gainY: 1 / 0.2, at: "" };
}

export function loadCalibration(): Calibration | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Calibration) : null;
  } catch {
    return null;
  }
}

export function saveCalibration(c: Calibration) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}

export function clearCalibration() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** samples: neutral + 4 corners (TL, TR, BR, BL) in raw pose units. */
export function computeCalibration(
  source: "matrix" | "landmarks" | "nose",
  neutral: { yaw: number; pitch: number },
  corners: { tl: { yaw: number; pitch: number }; tr: { yaw: number; pitch: number }; br: { yaw: number; pitch: number }; bl: { yaw: number; pitch: number } }
): Calibration {
  const yawL = (corners.tl.yaw + corners.bl.yaw) / 2;
  const yawR = (corners.tr.yaw + corners.br.yaw) / 2;
  const pT = (corners.tl.pitch + corners.tr.pitch) / 2;
  const pB = (corners.bl.pitch + corners.br.pitch) / 2;
  const fallback = defaultCalibration(source);
  // corners were shown at 10%/90% → span 0.8 of the screen
  let gx = 0.8 / (yawR - yawL);
  let gy = 0.8 / (pB - pT);
  if (!isFinite(gx) || Math.abs(yawR - yawL) < 1e-3) gx = fallback.gainX;
  if (!isFinite(gy) || Math.abs(pB - pT) < 1e-3) gy = fallback.gainY;
  return { source, yaw0: neutral.yaw, pitch0: neutral.pitch, gainX: gx, gainY: gy, at: new Date().toISOString() };
}
