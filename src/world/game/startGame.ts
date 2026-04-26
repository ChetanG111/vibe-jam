import * as THREE from "three";
import type { AppShell } from "../../shell/gameShell";

export async function startGame(shell: AppShell) {
  shell.setHudChips([
    { label: "Mode", value: "Game" },
    { label: "Camera", value: "Q/E orbit" },
  ]);
  shell.setHint("WASD to move. Space/Shift for depth. Q/E to orbit.");

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
  floor.position.y = -18;
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
  water.position.y = 8;
  scene.add(water);

  const subGroup = new THREE.Group();
  subGroup.position.set(0, 0, 0);
  scene.add(subGroup);

  addRandomProps(scene);

  // Load the user-provided OBJ for dev-only iteration.
  // In production builds this file is not shipped; we fall back to a small procedural placeholder.
  if (import.meta.env.DEV) {
    const ok = await tryLoadDevObj(subGroup);
    if (!ok) addProceduralFallback(subGroup);
  } else {
    addProceduralFallback(subGroup);
  }

  let yaw = Math.PI; // Position camera behind the sub
  let yawVel = 0;
  const yawSpeed = 1.25; // rad/s

  const keyState: Record<string, boolean> = {
    q: false, e: false,
    w: false, s: false, a: false, d: false,
    " ": false, shift: false
  };
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.repeat) return;
    const k = ev.key.toLowerCase();
    if (k in keyState) keyState[k] = true;
    if (ev.code === "Space") keyState[" "] = true;
    if (ev.shiftKey) keyState["shift"] = true;
  };
  const onKeyUp = (ev: KeyboardEvent) => {
    const k = ev.key.toLowerCase();
    if (k in keyState) keyState[k] = false;
    if (ev.code === "Space") keyState[" "] = false;
    if (!ev.shiftKey) keyState["shift"] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const resize = () => {
    const w = Math.max(shell.canvasHost.clientWidth, 1);
    const h = Math.max(shell.canvasHost.clientHeight, 1);
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  const ro = new ResizeObserver(resize);
  ro.observe(shell.canvasHost);
  resize();

  // "Perfect" centering: move the group so its bounding center is at origin,
  // then point the camera at origin.
  const subCenter = getVisualCenter(subGroup);
  subGroup.position.sub(subCenter);
  const baseTarget = new THREE.Vector3(0, 0, 0);

  const camPos = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const radius = getCameraDistanceForObject(camera, subGroup, baseTarget);
  const height = radius * 0.45;
  const moveSpeed = 15.0; // units/s

  let raf = 0;
  let last = performance.now();
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;

    // Camera Orbit
    const orbitDir = (keyState.e ? 1 : 0) - (keyState.q ? 1 : 0);
    const desiredYawVel = orbitDir * yawSpeed;
    yawVel = lerp(yawVel, desiredYawVel, 1 - Math.exp(-dt * 14));
    yaw += yawVel * dt;

    // Movement
    const forward = (keyState.w ? 1 : 0) - (keyState.s ? 1 : 0);
    const side = (keyState.d ? 1 : 0) - (keyState.a ? 1 : 0);
    const up = (keyState[" "] ? 1 : 0) - (keyState.shift ? 1 : 0);

    // Calculate movement relative to camera yaw
    const moveX = (Math.cos(yaw) * side - Math.sin(yaw) * forward) * moveSpeed * dt;
    const moveZ = (Math.sin(yaw) * -side - Math.cos(yaw) * forward) * moveSpeed * dt;
    const moveY = up * moveSpeed * dt;

    subGroup.position.x += moveX;
    subGroup.position.y += moveY;
    subGroup.position.z += moveZ;

    // Rotate sub to face movement direction (basic lerped look-at)
    if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
      const targetRotation = Math.atan2(moveX, moveZ);
      subGroup.rotation.y = lerp(subGroup.rotation.y, targetRotation, 1 - Math.exp(-dt * 5));
    }

    // Follow target
    baseTarget.copy(subGroup.position);

    const actualRadius = radius * 0.65; // Closer view
    desired.set(Math.sin(yaw) * actualRadius, height * 0.7, Math.cos(yaw) * actualRadius).add(baseTarget);
    camPos.lerp(desired, 1 - Math.exp(-dt * 6));

    camera.position.copy(camPos);
    camera.lookAt(baseTarget);
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

function getVisualCenter(obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return center;
}

function getCameraDistanceForObject(
  camera: THREE.PerspectiveCamera,
  obj: THREE.Object3D,
  center: THREE.Vector3,
) {
  const sphere = new THREE.Sphere();
  new THREE.Box3().setFromObject(obj).getBoundingSphere(sphere);
  const radius = Number.isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : 6;
  const verticalDistance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) * 0.5);
  const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.aspect);
  const horizontalDistance = radius / Math.sin(horizontalFov * 0.5);
  const centerOffset = sphere.center.distanceTo(center);
  return Math.max(verticalDistance, horizontalDistance) + centerOffset + radius * 1.8;
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

function addProceduralFallback(host: THREE.Group) {
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
  glow.position.set(-2.2, 0.35, 0);
  sub.add(glow);
  host.add(sub);
}

function addRandomProps(scene: THREE.Scene) {
  const count = 80;
  const range = 240;
  const cubeGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const sphereGeo = new THREE.SphereGeometry(0.7, 12, 12);
  
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0xff9d6e, // Warm orange
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0xff9d6e,
    emissiveIntensity: 0.5,
  });
  
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x6ee7ff, // Bright cyan
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x6ee7ff,
    emissiveIntensity: 0.8,
  });

  for (let i = 0; i < count; i++) {
    const isCube = Math.random() > 0.5;
    const mesh = new THREE.Mesh(isCube ? cubeGeo : sphereGeo, isCube ? cubeMat : sphereMat);
    
    mesh.position.set(
      (Math.random() - 0.5) * range,
      (Math.random() - 0.5) * 40 - 2, // Distributed around the sub depth
      (Math.random() - 0.5) * range
    );
    
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    const scale = 0.4 + Math.random() * 2.5;
    mesh.scale.setScalar(scale);
    
    scene.add(mesh);
  }
}
