import * as THREE from "three";
import { placements, type Placement } from "./scatter";

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, pts: Placement[]) {
  const m = new THREE.InstancedMesh(geo, mat, pts.length);
  const d = new THREE.Object3D();
  pts.forEach((p, i) => {
    d.position.set(p.x, p.y, p.z);
    d.scale.setScalar(p.scale);
    d.rotation.y = p.rot;
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
  });
  m.castShadow = true;
  return m;
}

export function buildVegetation(): THREE.Group {
  const g = new THREE.Group();
  // placeholder spruce: instanced cone foliage + instanced trunk at the same placements
  const spruceFoliage = new THREE.ConeGeometry(1.6, 5.5, 7); spruceFoliage.translate(0, 4.2, 0);
  const spruceTrunk = new THREE.CylinderGeometry(0.18, 0.26, 1.8, 5); spruceTrunk.translate(0, 0.9, 0);
  const pts = placements("spruce", 1, 2600);
  g.add(instanced(spruceFoliage, new THREE.MeshStandardMaterial({ color: 0x1d4a2e, roughness: 1 }), pts));
  g.add(instanced(spruceTrunk, new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }), pts));
  g.add(instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x6e6c68, roughness: 1, flatShading: true }), placements("rock", 2, 900)));
  g.add(instanced(new THREE.SphereGeometry(0.7, 6, 5), new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 1 }), placements("bush", 3, 1400)));
  return g;
}
