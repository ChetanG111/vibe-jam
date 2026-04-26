import * as THREE from "three";
import type { AppShell } from "../../shell/gameShell";

export async function startGame(shell: AppShell) {
  shell.setHudChips([
    { label: "Mode", value: "Game" },
    { label: "Camera", value: "Q/E orbit" },
  ]);
  shell.setHint("Camera: Q/E to orbit. Movement comes next. `?mode=editor` is dev-only.");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x070a0f, 1);
  shell.canvasHost.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a0f, 0.03);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);

  const ambient = new THREE.AmbientLight(0x7aa2ff, 0.22);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0x9bd7ff, 0.9);
  key.position.set(25, 35, 15);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6ee7ff, 0.35);
  rim.position.set(-20, 14, -25);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      metalness: 0.0,
      roughness: 1.0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  // "Water surface" just for visual reference in this step (no depth caps yet).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0b2a3a,
      metalness: 0.0,
      roughness: 0.15,
      transparent: true,
      opacity: 0.18,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 18;
  scene.add(water);

  const subGroup = new THREE.Group();
  subGroup.position.set(0, 10, 0);
  scene.add(subGroup);

  // Load the user-provided OBJ for dev-only iteration.
  // In production builds this file is not shipped; we fall back to a small procedural placeholder.
  if (import.meta.env.DEV) {
    const ok = await tryLoadDevObj(subGroup);
    if (!ok) addProceduralFallback(subGroup);
  } else {
    addProceduralFallback(subGroup);
  }

  // Camera orbit controls (Q/E) around the submarine at origin.
  let yaw = Math.PI * 0.15;
  let yawVel = 0;
  const yawSpeed = 1.25; // rad/s

  const keyState = { q: false, e: false };
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.repeat) return;
    if (ev.key === "q" || ev.key === "Q") keyState.q = true;
    if (ev.key === "e" || ev.key === "E") keyState.e = true;
  };
  const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.key === "q" || ev.key === "Q") keyState.q = false;
    if (ev.key === "e" || ev.key === "E") keyState.e = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const resize = () => {
    const w = shell.canvasHost.clientWidth;
    const h = shell.canvasHost.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(shell.canvasHost);
  resize();

  const target = new THREE.Vector3(0, 11, 0);
  const camPos = new THREE.Vector3();
  const desired = new THREE.Vector3();

  let raf = 0;
  let last = performance.now();
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;

    // Soft acceleration based on held keys.
    const dir = (keyState.e ? 1 : 0) - (keyState.q ? 1 : 0);
    const desiredVel = dir * yawSpeed;
    yawVel = lerp(yawVel, desiredVel, 1 - Math.exp(-dt * 14));
    yaw += yawVel * dt;

    const radius = 24;
    const height = 10.5;
    desired.set(Math.sin(yaw) * radius, height, Math.cos(yaw) * radius).add(target);
    camPos.lerp(desired, 1 - Math.exp(-dt * 6));

    camera.position.copy(camPos);
    camera.lookAt(target);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    renderer.dispose();
    shell.canvasHost.innerHTML = "";
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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

    // Recompute bounds after scaling and center it.
    const box2 = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    obj.position.sub(center);

    host.add(obj);
    return true;
  } catch {
    return false;
  }
}

function addProceduralFallback(host: THREE.Group) {
  const sub = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x1e2b44,
    metalness: 0.1,
    roughness: 0.8,
  });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 6.0, 10, 1), hullMat);
  hull.rotation.z = Math.PI / 2;
  sub.add(hull);
  const conning = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 1.2), hullMat);
  conning.position.set(0.4, 0.65, 0);
  sub.add(conning);
  const glow = new THREE.PointLight(0x6ee7ff, 1.0, 18, 2);
  glow.position.set(-2.2, 0.35, 0);
  sub.add(glow);
  host.add(sub);
}

