// Nod (quick down-and-back) and shake (left-right-left) detectors on calibrated
// screen-fraction coordinates relative to a slow baseline.
export class Gestures {
  private bx = 0;
  private by = 0;
  private init = false;
  private nodStart: number | null = null;
  private shakeCrossings: { t: number; s: number }[] = [];
  private cooldownUntil = 0;
  constructor(private nodTheta = 0.16, private shakeTheta = 0.14) {}

  update(nx: number, ny: number, t: number): "nod" | "shake" | null {
    if (!this.init) {
      this.bx = nx;
      this.by = ny;
      this.init = true;
    }
    const dx = nx - this.bx;
    const dy = ny - this.by;
    // slow baseline (time constant ~1s)
    this.bx += 0.04 * dx;
    this.by += 0.04 * dy;
    if (t < this.cooldownUntil) return null;

    // nod: down past theta, back within 600 ms
    if (this.nodStart === null && dy > this.nodTheta) this.nodStart = t;
    if (this.nodStart !== null) {
      if (t - this.nodStart > 600) this.nodStart = null;
      else if (dy < this.nodTheta * 0.35) {
        this.nodStart = null;
        this.cooldownUntil = t + 700;
        return "nod";
      }
    }

    // shake: yaw crosses ±theta with alternating signs twice within 800 ms
    const s = dx > this.shakeTheta ? 1 : dx < -this.shakeTheta ? -1 : 0;
    if (s !== 0) {
      const last = this.shakeCrossings[this.shakeCrossings.length - 1];
      if (!last || last.s !== s) this.shakeCrossings.push({ t, s });
    }
    this.shakeCrossings = this.shakeCrossings.filter((c) => t - c.t < 800);
    if (this.shakeCrossings.length >= 3) {
      this.shakeCrossings = [];
      this.cooldownUntil = t + 800;
      return "shake";
    }
    return null;
  }

  reset() {
    this.init = false;
    this.nodStart = null;
    this.shakeCrossings = [];
  }
}
