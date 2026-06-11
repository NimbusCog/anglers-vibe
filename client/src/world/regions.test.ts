import { describe, expect, test } from "bun:test";
import { GATES, regionAt } from "./regions";

describe("regions", () => {
  test("south valley is region 1, glacier crown is region 5", () => {
    expect(regionAt(0, -600)).toBe(1);
    expect(regionAt(0, 660)).toBe(5);
  });
  test("river country is region 2, bluffs 3, hollow 4", () => {
    expect(regionAt(20, -200)).toBe(2);
    expect(regionAt(320, 200)).toBe(3);
    expect(regionAt(-310, 330)).toBe(4);
  });
  test("each gate names required gear", () => {
    for (const g of GATES) expect(g.requires.length).toBeGreaterThan(0);
    expect(GATES.find(g => g.into === 5)!.requires).toEqual(["parka", "rope"]);
  });
});
