import * as THREE from "three";

const DAY_SECONDS = 1200; // 20 min game day (client-local in M1; server-owned from M2)

export class Sky {
  sun = new THREE.DirectionalLight(0xffe8c4, 2.6);
  ambient = new THREE.AmbientLight(0x7d8db0, 0.65);
  hemi = new THREE.HemisphereLight(0xbcd5ff, 0x3a4633, 0.5);
  private peaks: THREE.Mesh;

  constructor(public scene: THREE.Scene) {
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -400; sc.right = 400; sc.top = 400; sc.bottom = -400; sc.far = 1600;
    scene.add(this.sun, this.ambient, this.hemi);
    scene.fog = new THREE.Fog(0xc7d5e6, 250, 1700);
    scene.background = new THREE.Color(0xa8c4e0);
    // ring of distant snowcaps: jagged cylinder silhouette
    const g = new THREE.CylinderGeometry(1900, 1900, 480, 96, 1, true);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) p.setY(i, 120 + 340 * ((Math.abs(Math.sin(i * 12.9898) * 43758.5453)) % 1));
    }
    g.computeVertexNormals();
    this.peaks = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0xdfe8f2, side: THREE.BackSide, fog: false,
    }));
    this.peaks.position.y = -40;
    scene.add(this.peaks);
  }

  /** When set (server world frac 0..1), the sun follows server time instead of local. */
  serverFrac: number | null = null;

  private aurora: THREE.Mesh | null = null;
  private auroraMat: THREE.ShaderMaterial | null = null;

  /** Aurora ribbon — built lazily, shown on server aurora flag. */
  setAurora(on: boolean) {
    if (on && !this.aurora) {
      this.auroraMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 } },
        vertexShader: `varying vec2 vUv; uniform float uT;
          void main(){ vUv=uv;
            vec3 p=position; p.y += sin(uv.x*9.0+uT*0.7)*60.0 + sin(uv.x*23.0-uT*0.4)*25.0;
            gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform float uT;
          void main(){
            float band = smoothstep(0.0,0.35,vUv.y)*smoothstep(1.0,0.55,vUv.y);
            float shimmer = 0.6 + 0.4*sin(vUv.x*40.0 + uT*1.3);
            vec3 c = mix(vec3(0.1,0.9,0.45), vec3(0.45,0.2,0.85), vUv.x*0.7+0.15*sin(uT*0.2));
            gl_FragColor = vec4(c, band*shimmer*0.5); }`,
      });
      const geo = new THREE.PlaneGeometry(2600, 420, 64, 8);
      this.aurora = new THREE.Mesh(geo, this.auroraMat);
      this.aurora.position.set(0, 620, 900);
      this.aurora.rotation.x = -0.25;
      (this.aurora as THREE.Mesh & { renderOrder: number }).renderOrder = 5;
      this.scene.add(this.aurora);
    }
    if (this.aurora) this.aurora.visible = on;
  }

  /** Sub-arctic sun: stays low (8–26° elevation), swings wide in azimuth. */
  update(t: number) {
    const phase = this.serverFrac !== null
      ? this.serverFrac * Math.PI * 2
      : ((t % DAY_SECONDS) / DAY_SECONDS) * Math.PI * 2;  // 0..2π over a day
    const elev = THREE.MathUtils.degToRad(17 + 9 * Math.sin(phase));
    const azim = phase;
    const r = 900;
    this.sun.position.set(r * Math.cos(elev) * Math.cos(azim), r * Math.sin(elev), r * Math.cos(elev) * Math.sin(azim));
    const night = Math.max(0, -Math.sin(phase - Math.PI / 6));      // dusk dimming
    this.sun.intensity = 2.6 - 1.9 * night;
    this.ambient.intensity = 0.65 - 0.35 * night;
    (this.scene.background as THREE.Color).setHSL(0.58, 0.32, 0.62 - 0.4 * night);
    (this.scene.fog as THREE.Fog).color.copy(this.scene.background as THREE.Color);
    if (this.auroraMat) this.auroraMat.uniforms.uT!.value = t;
  }
}
