/** Vegetation v2 — better silhouettes from pure geometry.
 *  Spruce: 3 stacked foliage cones + trunk, snow-dusted variant up high.
 *  Birch: white trunk + pale blob canopy, stands in the valley.
 *  Rocks/bushes as before. Each visual layer is one InstancedMesh. */
import * as THREE from "three";
import { placements, type Placement } from "./scatter";

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, pts: Placement[],
                   yJitter = 0, scaleMul = 1) {
  const m = new THREE.InstancedMesh(geo, mat, pts.length);
  const d = new THREE.Object3D();
  pts.forEach((p, i) => {
    d.position.set(p.x, p.y + yJitter, p.z);
    d.scale.setScalar(p.scale * scaleMul);
    d.rotation.y = p.rot;
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
  });
  m.castShadow = true;
  return m;
}

export function buildVegetation(): THREE.Group {
  const g = new THREE.Group();
  const mat = (color: number, flat = false) =>
    new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: flat });

  // spruce: trunk + three cones narrowing upward (lowland green)
  const sprucePts = placements("spruce", 1, 2200).filter(p => p.y < 110);
  const trunk = new THREE.CylinderGeometry(0.16, 0.3, 2.0, 5); trunk.translate(0, 1.0, 0);
  const cone1 = new THREE.ConeGeometry(2.0, 3.2, 7); cone1.translate(0, 3.2, 0);
  const cone2 = new THREE.ConeGeometry(1.5, 2.8, 7); cone2.translate(0, 5.2, 0);
  const cone3 = new THREE.ConeGeometry(0.9, 2.2, 7); cone3.translate(0, 7.0, 0);
  g.add(instanced(trunk, mat(0x4a3526), sprucePts));
  g.add(instanced(cone1, mat(0x1d4a2e), sprucePts));
  g.add(instanced(cone2, mat(0x235636), sprucePts));
  g.add(instanced(cone3, mat(0x2a6240), sprucePts));

  // alpine spruce: darker, snow-capped top cone (treeline band)
  const alpinePts = placements("spruce", 4, 700).filter(p => p.y >= 95 && p.y < 150);
  g.add(instanced(trunk, mat(0x3d2c20), alpinePts, 0, 0.85));
  g.add(instanced(cone1, mat(0x16382a), alpinePts, 0, 0.85));
  g.add(instanced(cone2, mat(0x1b4232), alpinePts, 0, 0.85));
  g.add(instanced(cone3, mat(0xdfe8ee), alpinePts, 0, 0.85));   // snow tip

  // birch: white trunks, pale-gold canopy, valley floor stands
  const birchPts = placements("bush", 7, 500).filter(p => p.y < 45);
  const bTrunk = new THREE.CylinderGeometry(0.09, 0.13, 2.6, 5); bTrunk.translate(0, 1.3, 0);
  const canopy = new THREE.IcosahedronGeometry(1.25, 0); canopy.translate(0, 3.1, 0);
  g.add(instanced(bTrunk, mat(0xe4e0d6), birchPts));
  g.add(instanced(canopy, mat(0x7a8f3e, true), birchPts));

  g.add(instanced(new THREE.IcosahedronGeometry(1, 0), mat(0x6e6c68, true), placements("rock", 2, 900)));
  g.add(instanced(new THREE.SphereGeometry(0.7, 6, 5), mat(0x3f5a2a), placements("bush", 3, 1200)));
  return g;
}
