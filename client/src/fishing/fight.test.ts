import { describe, expect, test } from "bun:test";
import { FightSim, gearParams } from "./fight";

const calm = () => 0.99; // rng that never triggers runs

function makeSim(weight = 2, personality = "steady", gear = { rod: 1, reel: 1, line: 1 }, rng = calm) {
  return new FightSim({ weight, personality, gear: gearParams(gear), rng });
}

describe("fight sim", () => {
  test("tension rises while reeling, falls when slack", () => {
    const s = makeSim();
    s.step(1, true);
    const up = s.tension;
    s.step(1, false);
    expect(up).toBeGreaterThan(0);
    expect(s.tension).toBeLessThan(up);
  });

  test("reeling closes distance", () => {
    const s = makeSim();
    const d0 = s.distance;
    s.step(1, true);
    expect(s.distance).toBeLessThan(d0);
  });

  test("sustained red zone snaps the line", () => {
    const s = makeSim(12, "bulldog");
    // force tension high: reel constantly with a heavy fish
    let snapped = false;
    for (let i = 0; i < 600 && !snapped; i++) {
      s.step(0.1, true);
      if (s.state === "snapped") snapped = true;
    }
    expect(snapped).toBe(true);
  });

  test("weak fish lands by riding the sweet zone", () => {
    const s = makeSim(0.8, "twitchy");
    for (let i = 0; i < 3000 && s.state === "fighting"; i++) {
      // naive sweet-zone rider: reel unless tension above 70
      s.step(0.05, s.tension < 70);
    }
    expect(s.state).toBe("landed");
  });

  test("slack line too long throws the hook", () => {
    const s = makeSim();
    for (let i = 0; i < 200 && s.state === "fighting"; i++) s.step(0.05, false);
    expect(s.state).toBe("thrown");
  });

  test("better rod lands the same fish faster", () => {
    const land = (rod: number) => {
      const s = makeSim(3, "runner", { rod, reel: rod, line: rod }, () => 0.5);
      let t = 0;
      for (let i = 0; i < 6000 && s.state === "fighting"; i++) { s.step(0.05, s.tension < 70); t += 0.05; }
      return s.state === "landed" ? t : Infinity;
    };
    expect(land(4)).toBeLessThan(land(1));
  });

  test("stamina drains faster in the sweet zone", () => {
    const a = makeSim(5);
    const b = makeSim(5);
    // a rides sweet zone, b stays slack-ish (alternate to avoid hook-throw)
    for (let i = 0; i < 60; i++) {
      a.step(0.1, a.tension < 70);
      b.step(0.1, i % 4 === 0);
    }
    expect(a.stamina).toBeLessThan(b.stamina);
  });
});
