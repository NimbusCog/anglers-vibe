import { heightAt, waterLevelAt } from "./heightmap";

export interface Placement { x: number; y: number; z: number; scale: number; rot: number; }

/** mulberry32 — tiny seeded PRNG so worlds are reproducible. */
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const RULES: Record<string, { min: number; max: number; maxSlope: number; s0: number; s1: number }> = {
  spruce: { min: 8, max: 148, maxSlope: 0.45, s0: 0.8, s1: 1.7 },
  rock:   { min: 4, max: 290, maxSlope: 0.9,  s0: 0.5, s1: 2.2 },
  bush:   { min: 7, max: 160, maxSlope: 0.5,  s0: 0.6, s1: 1.2 },
};

export function placements(kind: string, seed: number, count: number): Placement[] {
  const rule = RULES[kind]!;
  const rand = rng(seed * 7919 + kind.length);
  const out: Placement[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const x = (rand() - 0.5) * 1480, z = (rand() - 0.5) * 1480;
    const y = heightAt(x, z);
    if (y < rule.min || y > rule.max) continue;
    if (waterLevelAt(x, z) !== null) continue;
    const slope = (heightAt(x + 2, z) - y) ** 2 + (heightAt(x, z + 2) - y) ** 2;
    if (slope > rule.maxSlope) continue;
    out.push({ x, y, z, scale: rule.s0 + rand() * (rule.s1 - rule.s0), rot: rand() * Math.PI * 2 });
  }
  return out;
}
