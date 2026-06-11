import { describe, expect, test } from "bun:test";
import { biteWeight, sampleBite } from "./bite";
import type { SpeciesDef, WorldState } from "../net/api";

const trout: SpeciesDef = { id: 1, name: "Rainbow Trout", regions: [1], rarity: "common", wmin: 0.5, wmax: 3, price: 8, personality: "sprinter", cond: {} };
const king: SpeciesDef = { id: 10, name: "King Salmon", regions: [2], rarity: "rare", wmin: 8, wmax: 25, price: 120, personality: "bulldog", cond: { only_time: ["dawn", "dusk"] } };
const aurora: SpeciesDef = { id: 23, name: "Aurora King", regions: [5], rarity: "legendary", wmin: 20, wmax: 50, price: 1200, personality: "aurora", cond: { only_aurora: true } };

const W = (o: Partial<WorldState> = {}): WorldState => ({ day: 0, frac: 0.3, phase: "day", weather: "clear", aurora: false, ...o });

describe("bite", () => {
  test("common trout always biteable", () => {
    expect(biteWeight(trout, W())).toBeGreaterThan(0);
  });
  test("king salmon gated to dawn/dusk", () => {
    expect(biteWeight(king, W({ phase: "day" }))).toBe(0);
    expect(biteWeight(king, W({ phase: "dawn" }))).toBeGreaterThan(0);
  });
  test("aurora king needs aurora", () => {
    expect(biteWeight(aurora, W({ phase: "night" }))).toBe(0);
    expect(biteWeight(aurora, W({ phase: "night", aurora: true }))).toBeGreaterThan(0);
  });
  test("sampleBite returns in-range weight for the region", () => {
    const res = sampleBite([trout, king, aurora], 1, W(), () => 0.5);
    expect(res).not.toBeNull();
    expect(res!.species.id).toBe(1);
    expect(res!.weight).toBeGreaterThanOrEqual(trout.wmin);
    expect(res!.weight).toBeLessThanOrEqual(trout.wmax);
  });
  test("empty pool returns null", () => {
    expect(sampleBite([aurora], 5, W({ phase: "night" }), () => 0.5)).toBeNull();
  });
});
