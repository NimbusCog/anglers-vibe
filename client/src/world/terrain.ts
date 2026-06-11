import * as THREE from "three";
import { heightAt } from "./heightmap";

const SIZE = 1500, SEGS = 384;

/** Alaska palette by elevation+slope: silt shore, forest green, granite, snow. */
function tint(h: number, slope: number, c: THREE.Color): THREE.Color {
  if (h > 235) return c.setRGB(0.93, 0.95, 0.99);            // snow
  if (slope > 0.55) return c.setRGB(0.42, 0.41, 0.44);       // granite face
  if (h > 150) return c.setRGB(0.50, 0.52, 0.46);            // alpine scrub
  if (h < 9) return c.setRGB(0.72, 0.68, 0.58);              // silt shoreline
  return c.setRGB(0.18 + h / 900, 0.34, 0.20);               // spruce forest floor
}

export function buildTerrain(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const n = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    tint(pos.getY(i), 1 - n.getY(i), c);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}
