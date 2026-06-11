/** Cruisers — visible fish wandering each water body. Cast near one and you hook THAT fish:
 *  casting becomes stalking. Each cruiser pre-rolls a species legal for its water + conditions. */
import * as THREE from "three";
import { WATER_BODIES } from "./heightmap";
import { sampleBite } from "../fishing/bite";
import type { SpeciesDef, WorldState } from "../net/api";

interface Cruiser {
  mesh: THREE.Mesh;
  body: typeof WATER_BODIES[number];
  species: SpeciesDef | null;
  heading: number;
  speed: number;
  respawnIn: number;   // >0 = despawned, counting down
}

const PER_BODY = 3;
const CLAIM_RADIUS = 3.2;

export class Cruisers {
  private all: Cruiser[] = [];

  constructor(
    scene: THREE.Scene,
    private getSpecies: () => SpeciesDef[],
    private getWorld: () => WorldState,
  ) {
    for (const body of WATER_BODIES) {
      for (let i = 0; i < PER_BODY; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 8, 5),
          new THREE.MeshBasicMaterial({ color: 0x0a1c26, transparent: true, opacity: 0.42 }),
        );
        mesh.scale.set(1.3, 0.16, 0.5);
        mesh.visible = false;
        scene.add(mesh);
        this.all.push({
          mesh, body, species: null,
          heading: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 0.8,
          respawnIn: Math.random() * 5,
        });
      }
    }
  }

  private spawn(c: Cruiser) {
    const bite = sampleBite(this.getSpecies(), c.body.region, this.getWorld());
    if (!bite) { c.respawnIn = 8; return; }
    c.species = bite.species;
    const a = Math.random() * Math.PI * 2, r = Math.random() * c.body.r * 0.7;
    c.mesh.position.set(c.body.x + Math.cos(a) * r, c.body.level - 0.35, c.body.z + Math.sin(a) * r);
    const size = 0.5 + (bite.species.wmax / 25);
    c.mesh.scale.set(1.3 * size, 0.16 * size, 0.5 * size);
    c.mesh.visible = true;
    c.respawnIn = 0;
  }

  update(dt: number) {
    for (const c of this.all) {
      if (c.respawnIn > 0) {
        c.respawnIn -= dt;
        if (c.respawnIn <= 0 && this.getSpecies().length) this.spawn(c);
        continue;
      }
      if (!c.mesh.visible) { if (this.getSpecies().length) this.spawn(c); continue; }
      // wander: drift heading, stay inside the body
      c.heading += (Math.random() - 0.5) * dt * 1.5;
      const nx = c.mesh.position.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.mesh.position.z + Math.cos(c.heading) * c.speed * dt;
      if (Math.hypot(nx - c.body.x, nz - c.body.z) > c.body.r * 0.8) {
        c.heading += Math.PI * (0.8 + Math.random() * 0.4);
      } else {
        c.mesh.position.x = nx;
        c.mesh.position.z = nz;
      }
      c.mesh.rotation.y = c.heading;
    }
  }

  /** A lure landed at `point`: if a cruiser is close, it takes — returns its species and despawns it. */
  claimNear(point: THREE.Vector3): SpeciesDef | null {
    for (const c of this.all) {
      if (c.respawnIn > 0 || !c.mesh.visible || !c.species) continue;
      const d = Math.hypot(c.mesh.position.x - point.x, c.mesh.position.z - point.z);
      if (d <= CLAIM_RADIUS) {
        const sp = c.species;
        c.mesh.visible = false;
        c.respawnIn = 20 + Math.random() * 20;
        return sp;
      }
    }
    return null;
  }
}
