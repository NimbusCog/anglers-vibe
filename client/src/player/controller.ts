import * as THREE from "three";
import { heightAt, waterLevelAt } from "../world/heightmap";
import { GATES } from "../world/regions";

const SPEED = 6.5, SPRINT = 11, EYE = 1.6, CAM_DIST = 7;

export class PlayerController {
  pos = new THREE.Vector3(0, 0, -700);
  yaw = 0; pitch = -0.15;
  body: THREE.Group;
  private keys = new Set<string>();
  /** gear inventory — loaded from server save; gates check this */
  gear = new Set<string>();

  setGear(ids: string[]) { this.gear = new Set(ids); }

  /** Fight feedback: 0 = calm; >0 shakes the camera toward/around the fish. */
  camShake = 0;

  constructor(private camera: THREE.PerspectiveCamera, scene: THREE.Scene, canvas: HTMLCanvasElement) {
    this.body = new THREE.Group();
    const capsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0xc4622d }),  // placeholder angler; GLB in M2+
    );
    capsule.position.y = 0.85;
    capsule.castShadow = true;
    this.body.add(capsule);
    scene.add(this.body);
    addEventListener("keydown", (e: KeyboardEvent) => this.keys.add(e.code));
    addEventListener("keyup", (e: KeyboardEvent) => this.keys.delete(e.code));
    canvas.addEventListener("click", () => canvas.requestPointerLock());
    addEventListener("mousemove", (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * 0.0024;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0019, -1.1, 0.5);
    });
  }

  update(dt: number) {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const v = new THREE.Vector3();
    if (this.keys.has("KeyW")) v.add(f);
    if (this.keys.has("KeyS")) v.sub(f);
    if (this.keys.has("KeyD")) v.add(r);
    if (this.keys.has("KeyA")) v.sub(r);
    if (v.lengthSq() > 0) {
      v.normalize().multiplyScalar((this.keys.has("ShiftLeft") ? SPRINT : SPEED) * dt);
      const next = this.pos.clone().add(v);
      if (!this.blocked(next)) this.pos.copy(next);
    }
    const ground = heightAt(this.pos.x, this.pos.z);
    const water = waterLevelAt(this.pos.x, this.pos.z);
    this.pos.y = water !== null && water > ground + 0.4 ? water - 0.4 : ground; // wade, don't sink
    this.body.position.copy(this.pos);
    this.body.rotation.y = this.yaw;
    // chase camera
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(CAM_DIST * Math.cos(this.pitch));
    const cam = this.pos.clone().add(back).add(new THREE.Vector3(0, EYE + CAM_DIST * -Math.sin(this.pitch) + 1.2, 0));
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.5);
    if (this.camShake > 0) {
      cam.x += (Math.random() - 0.5) * this.camShake;
      cam.y += (Math.random() - 0.5) * this.camShake * 0.6;
      cam.z += (Math.random() - 0.5) * this.camShake;
    }
    this.camera.position.copy(cam);
    this.camera.lookAt(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  private blocked(next: THREE.Vector3): boolean {
    for (const g of GATES) {
      if (g.requires.every(req => this.gear.has(req))) continue;
      if (Math.hypot(next.x - g.x, next.z - g.z) < g.r) return true;
    }
    // steep-slope block: can't walk up granite faces
    const ahead = heightAt(next.x, next.z);
    return ahead - heightAt(this.pos.x, this.pos.z) > 1.2;
  }
}
