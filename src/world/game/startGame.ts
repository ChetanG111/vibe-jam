import * as THREE from "three";
import type { AppShell } from "../../shell/gameShell";
import { createSky } from "./sky";
import { DebugUI } from "./DebugUI";
import { loadSubmarine } from "./submarine";

export async function startGame(shell: AppShell) {
  shell.setHudChips([
    { label: "Mode", value: "Weighty Sub" },
    { label: "Physics", value: "Fluid Damping" },
  ]);
  shell.setHint("WASD: Move | Space/Shift: Depth | Q/E: Turn & Orbit");

  // --- Renderer Setup ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  shell.canvasHost.replaceChildren(renderer.domElement);

  // --- Scene & Camera ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  
  // --- Environment ---
  const sky = createSky();
  sky.uniforms.topColor.value.set(0x004488);
  sky.uniforms.bottomColor.value.set(0x00ccff);
  scene.add(sky.mesh);

  // --- Submarine Setup ---
  const subGroup = new THREE.Group();
  const modelContainer = new THREE.Group(); // Inner group for banking/rolling
  subGroup.add(modelContainer);
  subGroup.position.set(0, 0, 0);
  scene.add(subGroup);

  await loadSubmarine(modelContainer, "glb_lowpoly");

  // --- Physics & State ---
  const velocity = new THREE.Vector3();
  const damping = 0.98;
  const thrust = 0.45;
  const turnSpeed = 1.2;
  const bankLerp = 4.0;
  const maxBank = 0.25;
  
  let yaw = Math.PI;
  let yawVel = 0;
  let roll = 0;

  const keys: Record<string, boolean> = {};
  const onKey = (e: KeyboardEvent, v: boolean) => {
    keys[e.key.toLowerCase()] = v;
    if (e.code === "Space") keys["space"] = v;
    if (e.shiftKey) keys["shift"] = v;
  };
  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));

  // --- Debug UI ---
  const ui = new DebugUI(shell.hud);
  
  // Sky Folder
  const skyFolder = ui.addFolder("Sky & Sun");
  ui.addColor(skyFolder, "Top Color", sky.uniforms.topColor.value, () => {});
  ui.addColor(skyFolder, "Bottom Color", sky.uniforms.bottomColor.value, () => {});
  ui.addColor(skyFolder, "Sun Color", sky.uniforms.sunColor.value, () => {});

  const sunDir = sky.uniforms.sunDir.value;
  const updateSun = () => sunDir.normalize();
  ui.addSlider(skyFolder, "Sun X", -1, 1, 0.01, sunDir.x, v => { sunDir.x = v; updateSun(); });
  ui.addSlider(skyFolder, "Sun Y", -1, 1, 0.01, sunDir.y, v => { sunDir.y = v; updateSun(); });
  ui.addSlider(skyFolder, "Sun Z", -1, 1, 0.01, sunDir.z, v => { sunDir.z = v; updateSun(); });
  ui.addSlider(skyFolder, "Sun Size", 0.9, 0.999, 0.001, sky.uniforms.sunSize.value, v => sky.uniforms.sunSize.value = v);
  ui.addSlider(skyFolder, "Sun Glow", 0, 0.5, 0.01, sky.uniforms.sunGlow.value, v => sky.uniforms.sunGlow.value = v);

  // Physics Folder
  const physicsFolder = ui.addFolder("Movement Physics");
  let debugDamping = damping;
  let debugThrust = thrust;

  ui.addSlider(physicsFolder, "Damping", 0.8, 1.0, 0.001, damping, v => debugDamping = v);
  ui.addSlider(physicsFolder, "Thrust", 0.1, 2.0, 0.05, thrust, v => debugThrust = v);
  ui.addSlider(physicsFolder, "Bank Juice", 0, 1.0, 0.05, maxBank, v => {});

  // --- Loop ---
  let raf = 0;
  let last = performance.now();
  
  const camOffset = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 5, 15);
  const camTarget = new THREE.Vector3();

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;

    // 1. Rotation (Yaw)
    const turnDir = (keys["q"] ? 1 : 0) - (keys["e"] ? 1 : 0);
    const targetYawVel = turnDir * turnSpeed;
    yawVel = THREE.MathUtils.lerp(yawVel, targetYawVel, 1 - Math.exp(-dt * 5));
    yaw += yawVel * dt;
    subGroup.rotation.y = yaw;

    // 2. Banking (Roll Juice)
    // Roll the model container based on turn velocity
    const targetRoll = -yawVel * 0.25; 
    roll = THREE.MathUtils.lerp(roll, targetRoll, 1 - Math.exp(-dt * bankLerp));
    modelContainer.rotation.z = roll;

    // 3. Thrust & Velocity
    const forward = (keys["w"] ? 1 : 0) - (keys["s"] ? 1 : 0);
    const strafe = (keys["d"] ? 1 : 0) - (keys["a"] ? 1 : 0);
    const up = (keys["space"] ? 1 : 0) - (keys["shift"] ? 1 : 0);

    // Calculate local force
    const force = new THREE.Vector3(strafe, up, -forward).normalize().multiplyScalar(debugThrust);
    
    // Convert force to world space based on current yaw
    force.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    
    velocity.add(force.multiplyScalar(dt * 60)); // Normalize to ~60fps
    velocity.multiplyScalar(debugDamping);

    subGroup.position.add(velocity.clone().multiplyScalar(dt));

    // 4. Camera Follow (Fluid Orbit)
    camOffset.set(Math.sin(yaw) * 18, 6, Math.cos(yaw) * 18);
    const desiredCamPos = subGroup.position.clone().add(camOffset);
    camPos.lerp(desiredCamPos, 1 - Math.exp(-dt * 4));
    camera.position.copy(camPos);
    
    camTarget.lerp(subGroup.position, 1 - Math.exp(-dt * 8));
    camera.lookAt(camTarget);

    // 5. Environment
    sky.uniforms.time.value += dt;
    sky.mesh.position.copy(camera.position);

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  const resize = () => {
    const w = shell.canvasHost.clientWidth;
    const h = shell.canvasHost.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(shell.canvasHost);
  resize();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    ui.dispose();
    window.removeEventListener("keydown", onKey as any);
    window.removeEventListener("keyup", onKey as any);
    renderer.dispose();
    shell.canvasHost.innerHTML = "";
  };
}
