import * as THREE from "three";
import { getVisualCenter } from "./cameraUtils";

export async function loadSubmarine(subGroup: THREE.Group) {
  // Load the user-provided OBJ for dev-only iteration.
  // In production builds this file is not shipped; we fall back to a small procedural placeholder.
  if (import.meta.env.DEV) {
    const ok = await tryLoadDevObj(subGroup);
    if (!ok) addProceduralFallback(subGroup);
  } else {
    addProceduralFallback(subGroup);
  }
}

async function tryLoadDevObj(host: THREE.Group): Promise<boolean> {
  const url = "/dev-assets/Seaview%20submarine.obj";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const text = await res.text();

    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    const loader = new OBJLoader();
    const obj = loader.parse(text);

    // Use a consistent material for now (OBJ+MTL integration later if needed).
    obj.traverse((child: any) => {
      if (child && child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x9bd7ff,
          roughness: 0.9,
          metalness: 0.05,
        });
      }
    });

    // Normalize: center and scale to a reasonable size.
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) return false;
    const targetSize = 8.5;
    const scale = targetSize / maxDim;
    obj.scale.setScalar(scale);

    // Recompute after scaling and center on the vertex centroid. This better
    // matches the apparent mass of the OBJ than the midpoint of its bounds.
    const center = getVisualCenter(obj);
    obj.position.sub(center);

    host.add(obj);
    return true;
  } catch {
    return false;
  }
}

export function addProceduralFallback(host: THREE.Group) {
  const sub = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x1e2b44,
    metalness: 0.1,
    roughness: 0.8,
  });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 6.0, 10, 1), hullMat);
  hull.rotation.x = Math.PI / 2;
  sub.add(hull);
  const conning = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 1.2), hullMat);
  conning.position.set(0, 0.65, 0.4);
  sub.add(conning);
  const glow = new THREE.PointLight(0x6ee7ff, 1.0, 18, 2);
  glow.position.set(0, 0.35, -2.2);
  sub.add(glow);
  host.add(sub);
}
