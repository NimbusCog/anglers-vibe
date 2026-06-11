/** Water v2 — custom shader: gentle vertex waves, two scrolling normal-ish ripple layers,
 *  view-angle (fresnel) color mix, sun glint. Per-body tint: glacial silt vs clear. */
import * as THREE from "three";
import { WATER_BODIES } from "./heightmap";

const VERT = `
uniform float uT;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin((uv.x * 28.0) + uT * 1.1) * 0.06 + cos((uv.y * 23.0) - uT * 0.9) * 0.06;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vPos = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAG = `
uniform float uT;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormalW;

float ripple(vec2 p) {
  return sin(p.x * 40.0 + uT * 1.6) * cos(p.y * 34.0 - uT * 1.2)
       + sin(p.x * 90.0 - uT * 2.3) * cos(p.y * 76.0 + uT * 1.9) * 0.5;
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vPos);
  float r = ripple(vUv) * 0.5 + 0.5;
  // perturbed normal for glint
  vec3 n = normalize(vNormalW + vec3(r * 0.12 - 0.06, 0.0, r * 0.1 - 0.05));
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.0);
  // center of body reads deep, edges shallow
  float edge = smoothstep(0.32, 0.5, distance(vUv, vec2(0.5)));
  vec3 col = mix(uDeep, uShallow, edge * 0.7 + r * 0.12);
  col = mix(col, vec3(0.75, 0.83, 0.9), fres * 0.55);
  // sun glint
  vec3 h = normalize(viewDir + normalize(uSunDir));
  float spec = pow(max(dot(n, h), 0.0), 90.0);
  col += vec3(1.0, 0.95, 0.8) * spec * 0.8;
  float alpha = 0.82 + fres * 0.1;
  gl_FragColor = vec4(col, alpha);
}`;

export function buildWater(): { group: THREE.Group; update: (t: number, sunDir?: THREE.Vector3) => void } {
  const group = new THREE.Group();
  const mats: THREE.ShaderMaterial[] = [];
  for (const w of WATER_BODIES) {
    const glacial = w.region < 3;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      uniforms: {
        uT: { value: 0 },
        uShallow: { value: glacial ? new THREE.Color(0x55c2b4) : new THREE.Color(0x3f7a96) },
        uDeep: { value: glacial ? new THREE.Color(0x1f6e6e) : new THREE.Color(0x123a52) },
        uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.2) },
      },
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(w.r * 1.04, 64), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(w.x, w.level, w.z);
    group.add(m);
    mats.push(mat);
  }
  const update = (t: number, sunDir?: THREE.Vector3) => {
    for (const mat of mats) {
      mat.uniforms.uT!.value = t;
      if (sunDir) (mat.uniforms.uSunDir!.value as THREE.Vector3).copy(sunDir);
    }
  };
  return { group, update };
}
