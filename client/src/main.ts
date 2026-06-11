import * as THREE from "three";
import { Engine } from "./engine/engine";
import { buildTerrain } from "./world/terrain";
import { buildWater } from "./world/water";
import { buildVegetation } from "./world/vegetation";
import { heightAt } from "./world/heightmap";
import { GATES, regionAt } from "./world/regions";
import { Sky } from "./sky/sky";
import { Weather } from "./sky/weather";
import { Wildlife } from "./world/wildlife";
import { Cruisers } from "./world/cruisers";
import { PlayerController } from "./player/controller";
import { Hud } from "./ui/hud";
import { Panels } from "./ui/panels";
import { Fishing } from "./fishing/index";
import { buyItem, getState, restAt, savePos, sellCreel, subscribeWorld } from "./net/api";
import { audio } from "./audio";
import type { StateResponse, WorldState } from "./net/api";

const engine = new Engine();
engine.scene.add(buildTerrain());
const water = buildWater();
engine.scene.add(water.group);
engine.scene.add(buildVegetation());
const sky = new Sky(engine.scene);
const weather = new Weather(engine.scene);
const wildlife = new Wildlife(engine.scene);

// gate markers (proper props are M3 dressing)
for (const g of GATES) {
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 3.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xd4453a }),
  );
  marker.position.set(g.x, heightAt(g.x, g.z) + 1.75, g.z);
  engine.scene.add(marker);
}

// trading post: simple hut on the east shore of Tern Bay
const POST = new THREE.Vector3(245, heightAt(245, -555), -555);
const hut = new THREE.Group();
const walls = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshStandardMaterial({ color: 0x6e4f33 }));
walls.position.y = 1.5;
const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0x3a4a3a }));
roof.position.y = 4.1;
roof.rotation.y = Math.PI / 4;
hut.add(walls, roof);
hut.position.copy(POST);
engine.scene.add(hut);

// campfires: one per region, rest to dawn/dusk/night nearby with R
const CAMPFIRES: THREE.Vector3[] = [
  new THREE.Vector3(255, 0, -540),   // Tern Bay, by the trading post
  new THREE.Vector3(95, 0, -250),    // Salmon Run gravel bar
  new THREE.Vector3(300, 0, 120),    // Eagle Bluffs terrace
  new THREE.Vector3(-230, 0, 320),   // Icefall cave mouth
  new THREE.Vector3(40, 0, 620),     // The Eye
];
const fireGlows: THREE.PointLight[] = [];
for (const c of CAMPFIRES) {
  c.y = heightAt(c.x, c.z);
  const logs = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3526 }));
  logs.rotation.x = Math.PI / 2;
  logs.position.copy(c).add(new THREE.Vector3(0, 0.1, 0));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 6),
    new THREE.MeshBasicMaterial({ color: 0xff8c2e }));
  flame.position.copy(c).add(new THREE.Vector3(0, 0.6, 0));
  const glow = new THREE.PointLight(0xff9540, 30, 14, 1.8);
  glow.position.copy(c).add(new THREE.Vector3(0, 1.2, 0));
  fireGlows.push(glow);
  engine.scene.add(logs, flame, glow);
}

const player = new PlayerController(engine.camera, engine.scene, engine.renderer.domElement);
const hud = new Hud();
const panels = new Panels();

// audio starts on first gesture (browser policy)
addEventListener("click", () => audio.start(), { once: true });
addEventListener("keydown", () => audio.start(), { once: true });

// lantern: warm point light that follows the player, only lit inside the cavern with the gear
const lantern = new THREE.PointLight(0xffc873, 0, 26, 1.6);
engine.scene.add(lantern);

// dev: ?pos=x,z&yaw=r&pitch=r positions the player/camera for screenshots
const q = new URLSearchParams(location.search);
if (q.has("pos")) {
  const [px, pz] = q.get("pos")!.split(",").map(Number);
  player.pos.set(px ?? 0, 0, pz ?? -700);
  player.yaw = Number(q.get("yaw") ?? 0);
  player.pitch = Number(q.get("pitch") ?? -0.15);
}

const REGION_NAMES = ["", "Tern Bay", "Salmon Run", "Eagle Bluffs", "Icefall Cavern", "The Eye"];

let state: StateResponse | null = null;
let world: WorldState = { day: 0, frac: 0.1, phase: "dawn", weather: "clear", aurora: false };

const gearTiers = () => {
  const g = state?.player.gear ?? [];
  const tier = (kind: string) => Math.max(1, ...g.filter(x => x.startsWith(kind)).map(x => Number(x.slice(kind.length)) || 1));
  return { rod: tier("rod"), reel: tier("reel"), line: tier("line") };
};

const fishing = new Fishing(
  engine.scene, player, hud,
  () => world,
  () => state?.species ?? [],
  gearTiers,
  () => state?.player.gear ?? [],
  () => state?.player.lures ?? {},
  (m) => (m === "float" ? {} : state?.method_mult?.[m] ?? {}),
  (sp, weight, value, first, record) => {
    engine.timeScale = 0.25;                          // savor the landing
    setTimeout(() => { engine.timeScale = 1; }, 900);
    hud.showCard(sp.name, sp.rarity, weight, value, { first, record });
    void refresh();
  },
  () => { void refresh(); },                          // lure lost → sync inventory
);

const cruisers = new Cruisers(engine.scene, () => state?.species ?? [], () => world);
fishing.claimCruiser = (p) => cruisers.claimNear(p);

async function refresh() {
  try {
    state = await getState();
    world = state.world;
    sky.serverFrac = world.frac;
    player.setGear(state.player.gear);
    if (!q.has("pos")) player.pos.set(state.player.pos[0] ?? 0, 0, state.player.pos[1] ?? -700);
  } catch {
    hud.toast("server offline — fishing disabled, world still walkable");
  }
}
void refresh();

subscribeWorld(w => { world = w; sky.serverFrac = w.frac; });

// campfire rest
let restMenuUntil = 0;
addEventListener("keydown", async (e: KeyboardEvent) => {
  const nearFire = CAMPFIRES.some(c => player.pos.distanceTo(c) < 6);
  if (e.code === "KeyR" && nearFire && !fishing.busy) {
    restMenuUntil = performance.now() + 5000;
    hud.toast("rest until… [Z] dawn · [X] dusk · [C] night", 5000);
    return;
  }
  if (performance.now() < restMenuUntil && nearFire) {
    const to = e.code === "KeyZ" ? "dawn" : e.code === "KeyX" ? "dusk" : e.code === "KeyC" ? "night" : null;
    if (to) {
      restMenuUntil = 0;
      const r = await restAt(to);
      if (r.ok && r.world) { world = r.world; sky.serverFrac = world.frac; hud.toast(`you rest by the fire… it is now ${world.phase}`); }
    }
  }
});

// panels
addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.code === "KeyL") panels.toggleLog(state);
  if (e.code === "KeyM") panels.toggleMap(player.pos.x, player.pos.z, state?.player.gear ?? []);
  if (e.code === "Escape") panels.closeAll();
});

// shop interaction
addEventListener("keydown", async (e: KeyboardEvent) => {
  if (e.code !== "KeyE" || !state) return;
  if (hud.shopOpen) { hud.setShopOpen(false); return; }
  if (player.pos.distanceTo(POST) > 8 || fishing.busy) return;
  hud.renderShop(state.catalog, state.player,
    async (id) => {
      const r = await buyItem(id);
      hud.toast(r.ok ? `bought ${state!.catalog[id]!.label}` : `can't buy: ${r.reason}`);
      await refresh();
      if (state) hud.renderShop(state.catalog, state.player, () => {}, () => {});
      if (r.ok) hud.setShopOpen(false);
    },
    async () => {
      const r = await sellCreel();
      hud.toast(`sold ${r.sold} fish for $${r.total}`);
      await refresh();
      hud.setShopOpen(false);
    });
  hud.setShopOpen(true);
});

// periodic position save
setInterval(() => { void savePos(player.pos.x, player.pos.z); }, 10000);

engine.onUpdate((dt, t) => {
  if (!hud.shopOpen && !panels.anyOpen) player.update(dt);
  fishing.update(dt);
  water.update(t, sky.sun.position);
  sky.update(t);
  wildlife.update(dt, t);
  cruisers.update(dt);
  for (const gl of fireGlows) gl.intensity = 26 + Math.sin(t * 11 + gl.position.x) * 6;

  // Icefall Cavern: world goes near-black; the lantern carves a warm pocket
  const region = regionAt(player.pos.x, player.pos.z);
  sky.setAurora(world.aurora);
  weather.set(world.weather, region);
  weather.update(dt, player.pos);
  const inCave = region === 4;
  sky.sun.intensity *= inCave ? 0.06 : 1;
  sky.ambient.intensity *= inCave ? 0.15 : 1;
  sky.hemi.intensity = inCave ? 0.06 : 0.5;
  if (engine.scene.fog instanceof THREE.Fog) {
    engine.scene.fog.near = inCave ? 6 : 250;
    engine.scene.fog.far = inCave ? 70 : 1700;
  }
  lantern.intensity = inCave && (state?.player.gear.includes("lantern") ?? false) ? 180 : 0;
  lantern.position.set(player.pos.x, player.pos.y + 2.2, player.pos.z);

  if (state) {
    const wantName = state.species.find(s => s.id === state!.want)?.name ?? "";
    hud.setStatus(
      `${REGION_NAMES[region]}${player.pos.distanceTo(POST) <= 8 ? " · [E] trading post" : ""} · rig: ${fishing.method} [1-4] · want: ${wantName} x3 · [L]og [M]ap`,
      world.phase, world.weather, world.aurora, state.player);
  }
});

// loon calls when dusk settles in
let lastPhase = "";
setInterval(() => {
  if (world.phase === "dusk" && lastPhase !== "dusk") audio.loon();
  lastPhase = world.phase;
}, 5000);

engine.start();
