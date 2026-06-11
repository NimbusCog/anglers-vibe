/** Rain/snow particles around the player + weather fog moods. */
import * as THREE from "three";

const COUNT = 1600, RADIUS = 40, HEIGHT = 30;

export class Weather {
  private points: THREE.Points;
  private vel: Float32Array;
  private mode: "none" | "rain" | "snow" = "none";
  private mat: THREE.PointsMaterial;

  constructor(scene: THREE.Scene) {
    const pos = new Float32Array(COUNT * 3);
    this.vel = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * RADIUS * 2;
      pos[i * 3 + 1] = Math.random() * HEIGHT;
      pos[i * 3 + 2] = (Math.random() - 0.5) * RADIUS * 2;
      this.vel[i] = 0.5 + Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0xaaccee, size: 0.12, transparent: true, opacity: 0.7 });
    this.points = new THREE.Points(geo, this.mat);
    this.points.visible = false;
    scene.add(this.points);
  }

  /** weather string from server; snow shows in rain-slot when at altitude (region 5). */
  set(weather: string, region: number) {
    const want: typeof this.mode =
      weather === "snow" || (weather === "rain" && region === 5) ? "snow"
      : weather === "rain" ? "rain" : "none";
    if (want === this.mode) return;
    this.mode = want;
    this.points.visible = want !== "none";
    this.mat.color.set(want === "snow" ? 0xffffff : 0xaaccee);
    this.mat.size = want === "snow" ? 0.22 : 0.12;
  }

  update(dt: number, center: THREE.Vector3) {
    if (!this.points.visible) return;
    this.points.position.set(center.x, center.y, center.z);
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const speed = this.mode === "rain" ? 22 : 3.5;
    for (let i = 0; i < COUNT; i++) {
      let y = pos.getY(i) - this.vel[i]! * speed * dt;
      if (y < 0) y = HEIGHT;
      pos.setY(i, y);
      if (this.mode === "snow") pos.setX(i, pos.getX(i) + Math.sin((y + i) * 0.6) * dt * 1.2);
    }
    pos.needsUpdate = true;
  }
}
