export interface Gate {
  name: string; x: number; z: number; r: number;   // blocking sphere on the path
  into: number; requires: string[];                 // gear ids
}

/** Region polygons approximated as z-bands with x carve-outs (cheap & testable). */
export function regionAt(x: number, z: number): number {
  if (z >= 560) return 5;                                  // glacier crown
  if (x < -180 && z >= 220 && z < 560) return 4;           // hollow (west mountain flank)
  if (x > 200 && z >= 80 && z < 560) return 3;             // bluffs (east terrace)
  if (z >= -340 && z < 560) return 2;                      // river country
  return 1;                                                // Tern Bay valley floor
}

export const GATES: Gate[] = [
  { name: "river_ford",  x: 30,   z: -340, r: 26, into: 2, requires: ["waders"] },
  { name: "rope_anchor", x: 230,  z: 95,   r: 20, into: 3, requires: ["rope"] },
  { name: "cave_mouth",  x: -195, z: 300,  r: 22, into: 4, requires: ["lantern"] },
  { name: "summit_col",  x: -20,  z: 560,  r: 30, into: 5, requires: ["parka", "rope"] },
];
