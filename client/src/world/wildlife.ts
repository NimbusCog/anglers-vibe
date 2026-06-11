/** Ambient wildlife: circling eagles over each region's water, a pacing bear at Salmon Run,
 *  Dall sheep on the bluff ridge. Pure set dressing (spec M4). */
import * as THREE from "three";
import { heightAt, WATER_BODIES } from "./heightmap";

export class Wildlife {
  private eagles: { mesh: THREE.Mesh; cx: number; cz: number; cy: number; r: number; phase: number; speed: number }[] = [];
  private bear: THREE.Group;
  private bearT = 0;

  constructor(scene: THREE.Scene) {
    // eagles: one pair over Tern Bay, one over the river, one over the hollow
    const spots = [WATER_BODIES[0]!, WATER_BODIES[1]!, WATER_BODIES[5]!];
    const wing = new THREE.ConeGeometry(0.5, 2.2, 4);
    wing.rotateZ(Math.PI / 2);
    for (const s of spots) {
      for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(wing, new THREE.MeshStandardMaterial({ color: 0x2e2a26 }));
        scene.add(m);
        this.eagles.push({
          mesh: m, cx: s.x, cz: s.z, cy: s.level + 55 + k * 12,
          r: s.r * 0.7, phase: Math.random() * Math.PI * 2, speed: 0.25 + Math.random() * 0.15,
        });
      }
    }
    // bear: brown body+head pacing the far gravel bar at Salmon Run
    this.bear = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.6, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4f3a28 }));
    body.rotation.z = Math.PI / 2;
    body.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0x453a28 }));
    head.position.set(1.4, 1.3, 0);
    this.bear.add(body, head);
    scene.add(this.bear);
    // sheep: white dots on the bluff ridge
    for (let i = 0; i < 4; i++) {
      const x = 420 + i * 22, z = 300 + (i % 2) * 30;
      const sheep = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8e6e0 }));
      sheep.position.set(x, heightAt(x, z) + 0.6, z);
      scene.add(sheep);
    }
  }

  /** Leaping salmon at Salmon Run: small fish on staggered parabolic arcs. */
  private salmon: { mesh: THREE.Mesh; t: number; period: number; x: number; z: number; level: number }[] = [];

  private initSalmon(scene: THREE.Scene) {
    const river = WATER_BODIES[1]!;
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.45, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0xb84a4a }),
      );
      m.rotation.z = Math.PI / 2;
      scene.add(m);
      this.salmon.push({
        mesh: m, t: Math.random() * 6, period: 4 + Math.random() * 4,
        x: river.x + (Math.random() - 0.5) * river.r,
        z: river.z + (Math.random() - 0.5) * river.r,
        level: river.level,
      });
    }
  }

  /** Fish shadows circling at the eagle-marked hotspots — soft "fish here" hint. */
  private hotShadows: { mesh: THREE.Mesh; cx: number; cz: number; y: number; r: number; phase: number }[] = [];

  private initShadows(scene: THREE.Scene) {
    for (const s of [WATER_BODIES[0]!, WATER_BODIES[1]!]) {
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 8, 5),
          new THREE.MeshBasicMaterial({ color: 0x06141c, transparent: true, opacity: 0.35 }),
        );
        m.scale.set(1.2, 0.15, 0.45);
        scene.add(m);
        this.hotShadows.push({
          mesh: m, cx: s.x + (Math.random() - 0.5) * s.r, cz: s.z + (Math.random() - 0.5) * s.r,
          y: s.level - 0.4, r: 2 + Math.random() * 3, phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  update(dt: number, t: number) {
    if (this.salmon.length === 0) { this.initSalmon(this.bear.parent as THREE.Scene); this.initShadows(this.bear.parent as THREE.Scene); }
    for (const s of this.salmon) {
      s.t += dt;
      const k = (s.t % s.period) / 1.1;          // 1.1s airborne window per period
      if (k < 1) {
        s.mesh.visible = true;
        s.mesh.position.set(s.x + k * 2.5, s.level + Math.sin(k * Math.PI) * 1.6, s.z);
        s.mesh.rotation.z = Math.PI / 2 - (k - 0.5) * 1.8;
      } else {
        s.mesh.visible = false;
      }
    }
    for (const h of this.hotShadows) {
      h.phase += dt * 0.5;
      h.mesh.position.set(h.cx + Math.cos(h.phase) * h.r, h.y, h.cz + Math.sin(h.phase) * h.r);
      h.mesh.rotation.y = -h.phase;
    }
    for (const e of this.eagles) {
      e.phase += e.speed * dt;
      e.mesh.position.set(e.cx + Math.cos(e.phase) * e.r, e.cy + Math.sin(t * 0.7 + e.phase) * 3, e.cz + Math.sin(e.phase) * e.r);
      e.mesh.rotation.y = -e.phase;
    }
    this.bearT += dt * 0.3;
    const bx = 90 + Math.sin(this.bearT) * 10;
    const bz = -255;
    this.bear.position.set(bx, heightAt(bx, bz), bz);
    this.bear.rotation.y = Math.cos(this.bearT) > 0 ? 0 : Math.PI;
  }
}
