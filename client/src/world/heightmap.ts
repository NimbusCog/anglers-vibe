import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";

const noise = new ImprovedNoise();
const fbm = (x: number, z: number, oct: number, scale: number, amp: number) => {
  let v = 0, a = amp, s = scale;
  for (let i = 0; i < oct; i++) { v += noise.noise(x / s, z / s, 7.7 + i) * a; a *= 0.5; s *= 0.5; }
  return v;
};

/** Meandering valley spine: x-position of the valley center at a given z. */
export const spineX = (z: number) => 120 * Math.sin(z / 180) + 40 * Math.sin(z / 67);

export interface WaterBody {
  name: string; x: number; z: number; r: number; level: number; region: number;
}

/** Bowls are carved after the base profile; level = water surface y. */
export const WATER_BODIES: WaterBody[] = [
  { name: "tern_bay",     x: 0,    z: -560, r: 230, level: 6,   region: 1 },
  { name: "river_lower",  x: 35,   z: -260, r: 90,  level: 26,  region: 2 },
  { name: "river_upper",  x: -60,  z: -40,  r: 80,  level: 58,  region: 2 },
  { name: "bluff_pool_a", x: 290,  z: 160,  r: 45,  level: 132, region: 3 },
  { name: "bluff_pool_b", x: 350,  z: 240,  r: 38,  level: 141, region: 3 },
  { name: "hollow_lake",  x: -310, z: 330,  r: 110, level: 168, region: 4 },
  { name: "the_eye",      x: 0,    z: 640,  r: 60,  level: 287, region: 5 },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

export function heightAt(x: number, z: number): number {
  const t = Math.min(Math.max((z + 750) / 1500, 0), 1);
  const ramp = 300 * Math.pow(t, 1.6);                       // south→north climb
  const d = Math.abs(x - spineX(z));
  const wall = Math.pow(Math.min(d / 460, 1.4), 2) * 340;    // U-shaped cross-section
  let h = ramp + wall + fbm(x, z, 4, 90, 10) + fbm(x, z, 2, 14, 1.6);
  for (const w of WATER_BODIES) {                            // carve basins
    const dist = Math.hypot(x - w.x, z - w.z);
    if (dist < w.r) {
      const k = smooth(1 - dist / w.r);
      const floor = w.level - 3 - 5 * k;                     // 3–8 m below surface
      h = h * (1 - k) + Math.min(h, floor) * k;
    }
  }
  return h;
}

export function waterLevelAt(x: number, z: number): number | null {
  for (const w of WATER_BODIES) {
    if (Math.hypot(x - w.x, z - w.z) < w.r && heightAt(x, z) < w.level) return w.level;
  }
  return null;
}
