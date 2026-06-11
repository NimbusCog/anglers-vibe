import { describe, expect, test } from "bun:test";
import { placements } from "./scatter";

describe("scatter placement", () => {
  test("deterministic for same seed", () => {
    const a = placements("spruce", 1, 500);
    const b = placements("spruce", 1, 500);
    expect(a.length).toBe(b.length);
    expect(a[0]).toEqual(b[0]);
  });
  test("different seeds differ", () => {
    expect(placements("spruce", 1, 100)[0]!.x).not.toBe(placements("spruce", 2, 100)[0]!.x);
  });
  test("no trees in water, above treeline, or on cliffs", () => {
    for (const p of placements("spruce", 1, 800)) {
      expect(p.y).toBeGreaterThan(7);     // above shoreline/water
      expect(p.y).toBeLessThan(150);      // below treeline
    }
  });
});
