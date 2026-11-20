// One Euro filter (Casiez et al. 2012) — smooth when still, responsive when moving.
class LowPass {
  private y: number | null = null;
  filter(x: number, a: number) {
    this.y = this.y === null ? x : a * x + (1 - a) * this.y;
    return this.y;
  }
  last() {
    return this.y;
  }
}

export class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private t: number | null = null;
  constructor(private minCutoff = 1.0, private beta = 0.01, private dCutoff = 1.0) {}
  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value: number, tMs: number) {
    const dt = this.t === null ? 1 / 30 : Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const prev = this.x.last();
    const d = prev === null ? 0 : (value - prev) / dt;
    const ed = this.dx.filter(d, this.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(ed);
    return this.x.filter(value, this.alpha(cutoff, dt));
  }
  reset() {
    this.x = new LowPass();
    this.dx = new LowPass();
    this.t = null;
  }
}
