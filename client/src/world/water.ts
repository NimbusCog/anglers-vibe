import * as THREE from "three";
import { WATER_BODIES } from "./heightmap";

const GLACIAL = new THREE.Color(0x3fa8a0);   // silt turquoise
const CLEAR = new THREE.Color(0x2a5f7a);     // spring pools

export function buildWater(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  const mats: THREE.MeshStandardMaterial[] = [];
  for (const w of WATER_BODIES) {
    const mat = new THREE.MeshStandardMaterial({
      color: w.region >= 3 ? CLEAR : GLACIAL,
      transparent: true, opacity: 0.86, roughness: 0.15, metalness: 0.4,
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(w.r * 1.04, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(w.x, w.level, w.z);
    group.add(m);
    mats.push(mat);
  }
  // cheap shimmer: oscillate roughness; normal-map upgrade is an M4 polish item
  const update = (t: number) => {
    for (const mat of mats) mat.roughness = 0.13 + 0.05 * Math.sin(t * 1.7);
  };
  return { group, update };
}
