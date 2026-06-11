import * as THREE from "three";

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  private updaters: ((dt: number, t: number) => void)[] = [];
  private clock = new THREE.Clock();
  /** time dilation for dramatic moments (slow-mo on landing a fish) */
  timeScale = 1;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);
    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  onUpdate(fn: (dt: number, t: number) => void) { this.updaters.push(fn); }

  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05) * this.timeScale;
      const t = this.clock.elapsedTime;
      for (const u of this.updaters) u(dt, t);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
