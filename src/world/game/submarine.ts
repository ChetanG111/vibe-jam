import * as THREE from "three";
import { getVisualCenter } from "./cameraUtils";

export type SubmarineModelType = "procedural" | "obj" | "glb_lowpoly" | "glb_type_xxi";

const MODEL_CONFIGS: Record<string, { url: string; filter?: (name: string) => boolean }> = {
  glb_lowpoly: { url: "/models/submarine_low_poly.glb" },
  glb_type_xxi: { 
    url: "/models/low_poly_type_xxi_submarine.glb",
    filter: (name: string) => {
      const n = name.toLowerCase();
      return n.includes("torpedo") || n.includes("mine");
    }
  }
};

export async function loadSubmarine(subGroup: THREE.Group, type: SubmarineModelType = "glb_lowpoly") {
  subGroup.clear();

  if (type === "obj") {
    const ok = await tryLoadDevObj(subGroup);
    if (!ok) addProceduralFallback(subGroup);
  } else if (type === "glb_lowpoly" || type === "glb_type_xxi") {
    const config = MODEL_CONFIGS[type];
    const ok = await tryLoadGlb(subGroup, config.url, config.filter);
    if (!ok) addProceduralFallback(subGroup);
  } else {
    addProceduralFallback(subGroup);
  }
}

async function tryLoadGlb(host: THREE.Group, url: string, filter?: (name: string) => boolean): Promise<boolean> {
  try {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;

    // Apply filter (remove torpedoes/mines)
    if (filter) {
      const toRemove: THREE.Object3D[] = [];
      model.traverse(child => {
        if (filter(child.name)) {
          toRemove.push(child);
        }
      });
      toRemove.forEach(obj => {
        obj.parent?.remove(obj);
      });
    }

    // Normalize: center and scale
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) return false;
    
    const targetSize = 8.5;
    const scale = targetSize / maxDim;
    model.scale.setScalar(scale);

    const center = getVisualCenter(model);
    model.position.sub(center);

    host.add(model);
    return true;
  } catch (err) {
    console.error("Failed to load GLB:", err);
    return false;
  }
}

async function tryLoadDevObj(host: THREE.Group): Promise<boolean> {
  const url = "/dev-assets/Seaview%20submarine.obj";
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const text = await res.text();

    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    const loader = new OBJLoader();
    const obj = loader.parse(text);

    obj.traverse((child: any) => {
      if (child && child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x9bd7ff,
          roughness: 0.9,
          metalness: 0.05,
        });
      }
    });

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) return false;
    
    const targetSize = 8.5;
    const scale = targetSize / maxDim;
    obj.scale.setScalar(scale);

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
  host.add(sub);
}
