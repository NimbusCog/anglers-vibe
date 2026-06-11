/** Client-side bite sampling — mirrors server species.py weights (server re-validates every catch). */
import type { SpeciesDef, WorldState } from "../net/api";

const RARITY_WEIGHT: Record<string, number> = { common: 100, uncommon: 35, rare: 8, legendary: 1 };

export function biteWeight(sp: SpeciesDef, w: WorldState): number {
  const c = sp.cond;
  if (c.only_time && !c.only_time.includes(w.phase)) return 0;
  if (c.only_weather && !c.only_weather.includes(w.weather)) return 0;
  if (c.only_aurora && !w.aurora) return 0;
  let wt = RARITY_WEIGHT[sp.rarity] ?? 1;
  wt *= c.time?.[w.phase] ?? 1;
  wt *= c.weather?.[w.weather] ?? 1;
  return wt;
}

export function sampleBite(all: SpeciesDef[], region: number, w: WorldState, rng: () => number = Math.random) {
  const pool = all
    .filter(sp => sp.regions.includes(region))
    .map(sp => ({ sp, wt: biteWeight(sp, w) }))
    .filter(e => e.wt > 0);
  if (pool.length === 0) return null;
  const total = pool.reduce((a, e) => a + e.wt, 0);
  let r = rng() * total;
  let chosen = pool[pool.length - 1]!.sp;
  for (const e of pool) {
    r -= e.wt;
    if (r <= 0) { chosen = e.sp; break; }
  }
  const pct = rng();
  const weight = Math.round((chosen.wmin + pct * (chosen.wmax - chosen.wmin)) * 100) / 100;
  return { species: chosen, weight, pct };
}

/** Bite wait: 8–25 s, rarer rolls live at the long end naturally via uniform draw. */
export const biteWait = (rng: () => number = Math.random) => 8 + rng() * 17;

/** Hook-set window by rarity (s). */
export const hookWindow = (rarity: string) =>
  ({ common: 1.2, uncommon: 0.9, rare: 0.6, legendary: 0.4 }[rarity] ?? 1.0);
