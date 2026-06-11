/** Pure fight simulation — tension / distance / stamina. No three.js, fully testable.
 *  Numbers from docs/design.md "Catch loop". */

export interface GearParams {
  pullFactor: number;   // rod tier: multiplies fish pull (0.8/0.65/0.5/0.35)
  reelSpeed: number;    // m/s closed while reeling (2.5/3.2/4.0/5.0)
  redStart: number;     // tension where red zone begins (80/84/88/92)
}

export const gearParams = (g: { rod: number; reel: number; line: number }): GearParams => ({
  pullFactor: [0, 0.8, 0.65, 0.5, 0.35][g.rod] ?? 0.8,
  reelSpeed: [0, 2.5, 3.2, 4.0, 5.0][g.reel] ?? 2.5,
  redStart: [0, 80, 84, 88, 92][g.line] ?? 80,
});

/** Personality → run behavior. cadence: mean s between runs; dur: run length s; speed: m/s. */
const PERSONALITIES: Record<string, { cadence: number; dur: number; speed: number; pull: number }> = {
  steady:    { cadence: 6,   dur: 1.6, speed: 3.5, pull: 1.0 },
  sprinter:  { cadence: 4,   dur: 1.2, speed: 5.5, pull: 0.9 },
  twitchy:   { cadence: 2.5, dur: 0.7, speed: 4.0, pull: 0.6 },
  runner:    { cadence: 5,   dur: 3.0, speed: 6.0, pull: 1.2 },
  jumper:    { cadence: 4.5, dur: 1.0, speed: 7.0, pull: 1.4 },
  grinder:   { cadence: 7,   dur: 2.4, speed: 3.0, pull: 1.3 },
  ambush:    { cadence: 8,   dur: 1.0, speed: 8.0, pull: 1.5 },
  sulker:    { cadence: 9,   dur: 2.0, speed: 2.5, pull: 1.4 },
  bulldog:   { cadence: 6,   dur: 4.0, speed: 4.0, pull: 1.8 },
  panic:     { cadence: 3,   dur: 0.8, speed: 7.5, pull: 1.1 },
  palelight: { cadence: 5,   dur: 3.0, speed: 5.0, pull: 1.7 },
  aurora:    { cadence: 4,   dur: 2.5, speed: 6.5, pull: 1.8 },
  boss:      { cadence: 3.5, dur: 3.5, speed: 7.0, pull: 2.0 },
};

export type FightState = "fighting" | "landed" | "snapped" | "thrown";

export class FightSim {
  tension = 30;
  distance: number;
  stamina: number;
  state: FightState = "fighting";
  running = false;
  elapsed = 0;
  private redTime = 0;
  private slackTime = 0;
  private runLeft = 0;
  private nextRun: number;
  private p: { cadence: number; dur: number; speed: number; pull: number };
  private gear: GearParams;
  private weightF: number;
  private rng: () => number;

  constructor(opts: { weight: number; personality: string; gear: GearParams; rng?: () => number }) {
    this.p = PERSONALITIES[opts.personality] ?? PERSONALITIES.steady!;
    this.gear = opts.gear;
    this.rng = opts.rng ?? Math.random;
    this.weightF = Math.min(2.2, 0.5 + opts.weight / 10);            // 0.55..2.2
    this.distance = Math.min(40, 10 + opts.weight * 1.4);
    this.stamina = 100 * this.weightF;
    this.nextRun = this.p.cadence * (0.5 + this.rng());
  }

  /** Advance dt seconds with the player reeling or not. */
  step(dt: number, reeling: boolean) {
    if (this.state !== "fighting") return;
    this.elapsed += dt;

    // fish runs
    this.nextRun -= dt;
    if (this.runLeft > 0) {
      this.runLeft -= dt;
      this.running = true;
    } else {
      this.running = false;
      if (this.nextRun <= 0 && this.stamina > 30) {
        const staminaScale = Math.min(1, this.stamina / 100);
        this.runLeft = this.p.dur * (0.6 + 0.8 * this.rng()) * staminaScale;
        this.nextRun = this.p.cadence * (0.5 + this.rng());
      }
    }

    const pull = this.p.pull * this.weightF * this.gear.pullFactor;

    // tension dynamics
    if (reeling) this.tension += 28 * dt;
    else this.tension -= 35 * dt;
    if (this.running) this.tension += 40 * pull * dt;
    this.tension = Math.max(0, Math.min(105, this.tension));

    // distance dynamics
    if (reeling && !this.running) this.distance -= this.gear.reelSpeed * dt;
    if (this.running) this.distance += this.p.speed * pull * dt;

    // stamina: sweet zone 55..redStart drains hard
    const sweet = this.tension >= 55 && this.tension < this.gear.redStart;
    this.stamina -= (sweet ? 12 : 4) * dt;
    this.stamina = Math.max(0, this.stamina);

    // fail states
    if (this.tension >= this.gear.redStart) {
      this.redTime += dt;
      if (this.redTime >= 1.5) { this.state = "snapped"; return; }
    } else {
      this.redTime = Math.max(0, this.redTime - dt * 0.5);   // red time decays, not resets
    }
    if (this.tension < 10) {
      this.slackTime += dt;
      if (this.slackTime >= 3) { this.state = "thrown"; return; }
    } else {
      this.slackTime = 0;
    }

    if (this.distance <= 0) this.state = "landed";
  }
}
