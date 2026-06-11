import { describe, expect, test } from "bun:test";
import { heightAt, WATER_BODIES, waterLevelAt } from "./heightmap";

describe("heightmap", () => {
  test("valley rises northward along the spine", () => {
    const south = heightAt(0, -700);
    const mid = heightAt(0, 0);
    const north = heightAt(0, 700);
    expect(mid).toBeGreaterThan(south);
    expect(north).toBeGreaterThan(mid);
    expect(north).toBeGreaterThan(220);
  });

  test("valley walls rise east and west of the spine", () => {
    const floor = heightAt(0, 0);
    expect(heightAt(550, 0)).toBeGreaterThan(floor + 80);
    expect(heightAt(-550, 0)).toBeGreaterThan(floor + 80);
  });

  test("Tern Bay basin sits below its water level", () => {
    const bay = WATER_BODIES.find(w => w.name === "tern_bay")!;
    expect(heightAt(bay.x, bay.z)).toBeLessThan(bay.level - 1.5);
  });

  test("every water body basin is below its level", () => {
    for (const w of WATER_BODIES) {
      expect(heightAt(w.x, w.z)).toBeLessThan(w.level);
    }
  });

  test("waterLevelAt returns level inside a body and null on dry land", () => {
    const bay = WATER_BODIES.find(w => w.name === "tern_bay")!;
    expect(waterLevelAt(bay.x, bay.z)).toBe(bay.level);
    expect(waterLevelAt(600, -700)).toBeNull();
  });

  test("deterministic", () => {
    expect(heightAt(123.4, -345.6)).toBe(heightAt(123.4, -345.6));
  });
});
