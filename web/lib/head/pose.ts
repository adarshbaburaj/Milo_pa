// Head pose (yaw, pitch) from the facial transformation matrix, with a landmark-ratio fallback.
type Matrix = { rows: number; columns: number; data: number[] };
type LM = { x: number; y: number; z: number };

export type Pose = { yaw: number; pitch: number; source: "matrix" | "landmarks" | "nose" };

export function poseFromMatrix(m: Matrix | undefined): Pose | null {
  if (!m || !m.data || m.data.length < 16) return null;
  const d = m.data;
  // Detect layout: translation lives at 12..14 (column-major) or 3,7,11 (row-major).
  const colMajor = Math.abs(d[14]) >= Math.abs(d[11]);
  // forward axis of the face = third column of the rotation part
  const fx = colMajor ? d[8] : d[2];
  const fy = colMajor ? d[9] : d[6];
  const fz = colMajor ? d[10] : d[10];
  const yaw = Math.atan2(fx, fz);
  const pitch = Math.atan2(-fy, Math.hypot(fx, fz));
  if (!isFinite(yaw) || !isFinite(pitch)) return null;
  return { yaw, pitch, source: "matrix" };
}

export function poseFromLandmarks(lm: LM[] | undefined): Pose | null {
  if (!lm || lm.length < 455) return null;
  const nose = lm[1], L = lm[234], R = lm[454], top = lm[10], chin = lm[152];
  const yaw = (nose.x - L.x) / (R.x - L.x) - 0.5;
  const pitch = (nose.y - top.y) / (chin.y - top.y) - 0.5;
  if (!isFinite(yaw) || !isFinite(pitch)) return null;
  return { yaw, pitch, source: "landmarks" };
}

/** Nose pointer: the nose tip's position in the (mirrored) camera frame. Moving the nose moves the cursor. */
export function poseFromNose(lm: LM[] | undefined): Pose | null {
  if (!lm || lm.length < 2) return null;
  const n = lm[1];
  return { yaw: 1 - n.x, pitch: n.y, source: "nose" };
}
