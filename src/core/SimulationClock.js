export const TIME_SPEEDS = [0.1, 1, 10, 30, 100];
export const EPOCH = Date.UTC(2026, 0, 1);

/** A simulation day clock. Orbital phases are illustrative, not an ephemeris. */
export class SimulationClock {
  constructor() { this.days = 0; this.speed = 0.1; this.paused = false; }
  update(deltaSeconds) {
    if (!this.paused) this.days += Math.max(0, Math.min(deltaSeconds, 0.1)) * this.speed;
    return this.days;
  }
  setSpeed(speed) { if (TIME_SPEEDS.includes(Number(speed))) this.speed = Number(speed); }
  reset() { this.days = 0; }
  get date() { return new Date(EPOCH + this.days * 86400000); }
}
