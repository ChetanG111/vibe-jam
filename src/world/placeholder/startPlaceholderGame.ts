import * as THREE from "three";
import type { AppShell } from "../../shell/gameShell";

export async function startPlaceholderGame(shell: AppShell) {
  shell.setHudChips([
    { label: "Mode", value: "Placeholder" },
    { label: "Build", value: "Editor-first" },
  ]);
  shell.setHint("Add `?mode=editor` to use mission/UI/model editors.");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x070a0f, 1);
  shell.canvasHost.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a0f, 0.045);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 16, 18);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0x7aa2ff, 0.28);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0x9bd7ff, 0.85);
  key.position.set(10, 18, 8);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      metalness: 0.0,
      roughness: 1.0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const scatter = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x111a2e, roughness: 1.0 });
  for (let i = 0; i < 150; i++) {
    const geo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.7);
    const rock = new THREE.Mesh(geo, rockMat);
    rock.position.set((Math.random() - 0.5) * 90, 0.15, (Math.random() - 0.5) * 90);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scatter.add(rock);
  }
  scene.add(scatter);

  const sub = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x1e2b44,
    metalness: 0.1,
    roughness: 0.8,
  });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 3.2, 8, 1), hullMat);
  hull.rotation.z = Math.PI / 2;
  sub.add(hull);
  const conning = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.9), hullMat);
  conning.position.set(0.2, 0.55, 0);
  sub.add(conning);
  const glow = new THREE.PointLight(0x6ee7ff, 1.0, 10, 2);
  glow.position.set(-1.2, 0.35, 0);
  sub.add(glow);
  sub.position.set(0, 0.55, 0);
  scene.add(sub);

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

  let raf = 0;
  const start = performance.now();
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const tt = (t - start) / 1000;
    sub.position.y = 0.55 + Math.sin(tt * 1.1) * 0.06;
    sub.rotation.y = Math.sin(tt * 0.45) * 0.15;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      // Placeholder: future pause menu.
      shell.setHint("Editor-first build. Add `?mode=editor` to the URL.");
    }
  };
  window.addEventListener("keydown", onKey);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    ro.disconnect();
    renderer.dispose();
    shell.canvasHost.innerHTML = "";
  };
}

