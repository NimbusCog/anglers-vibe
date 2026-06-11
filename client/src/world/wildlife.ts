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

  update(dt: number, t: number) {
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
