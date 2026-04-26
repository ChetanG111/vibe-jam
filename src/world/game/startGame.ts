import * as THREE from "three";
import type { AppShell } from "../../shell/gameShell";
import { setupEnvironment } from "./environment";
import { loadSubmarine } from "./submarine";
import { getCameraDistanceForObject, getVisualCenter } from "./cameraUtils";

export async function startGame(shell: AppShell) {
  shell.setHudChips([
    { label: "Mode", value: "Game" },
    { label: "Camera", value: "Q/E orbit" },
  ]);
  shell.setHint("WASD to move. Space/Shift for depth. Q/E to orbit.");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x82a1b1, 1); // Hazy sky color
  shell.canvasHost.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x82a1b1, 0.012); // Lighter fog

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);

  const depthRenderTarget = new THREE.WebGLRenderTarget(1, 1);
  depthRenderTarget.texture.minFilter = THREE.NearestFilter;
  depthRenderTarget.texture.magFilter = THREE.NearestFilter;
  depthRenderTarget.depthTexture = new THREE.DepthTexture(1, 1);
  depthRenderTarget.depthTexture.type = THREE.UnsignedShortType;

  const env = setupEnvironment(scene, camera, depthRenderTarget.depthTexture);

  const subGroup = new THREE.Group();
  subGroup.position.set(0, 0, 0);
  scene.add(subGroup);

  await loadSubmarine(subGroup);

  let yaw = Math.PI; // Position camera behind the sub
  let yawVel = 0;
  let yawSpeed = 0.25; // rad/s
  let moveSpeed = 5.0; // units/s
  let mouseSensitivity = 0.005;
  let cameraDistMulti = 0.9;

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

  // UI for Mouse Control Toggle
  let mouseLookActive = false;
  // Mouse look toggle disabled for now
  /*
  const mouseToggle = document.createElement("button");
  mouseToggle.className = "btn";
  mouseToggle.style.position = "absolute";
  mouseToggle.style.right = "16px";
  mouseToggle.style.top = "16px";
  mouseToggle.style.pointerEvents = "auto";
  mouseToggle.textContent = "Mouse Look: OFF";
  shell.hud.appendChild(mouseToggle);

  mouseToggle.onclick = () => {
    mouseLookActive = !mouseLookActive;
    mouseToggle.textContent = `Mouse Look: ${mouseLookActive ? "ON" : "OFF"}`;
    mouseToggle.classList.toggle("primary", mouseLookActive);
    if (mouseLookActive) {
      shell.canvasHost.requestPointerLock?.();
    } else {
      document.exitPointerLock?.();
    }
  };
  */

  let debugPanel: HTMLDivElement | null = null;
  if (import.meta.env.DEV) {
    debugPanel = document.createElement("div");
    debugPanel.style.position = "absolute";
    debugPanel.style.left = "16px";
    debugPanel.style.top = "80px";
    debugPanel.style.background = "rgba(0,0,0,0.7)";
    debugPanel.style.padding = "10px";
    debugPanel.style.borderRadius = "8px";
    debugPanel.style.color = "white";
    debugPanel.style.display = "flex";
    debugPanel.style.flexDirection = "column";
    debugPanel.style.gap = "8px";
    debugPanel.style.pointerEvents = "auto";
    shell.hud.appendChild(debugPanel);

    function createSlider(label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void) {
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "4px";

      const topRow = document.createElement("div");
      topRow.style.display = "flex";
      topRow.style.justifyContent = "space-between";
      topRow.style.alignItems = "center";

      const labelEl = document.createElement("div");
      labelEl.textContent = label;
      labelEl.style.fontSize = "12px";
      
      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.step = step.toString();
      numInput.value = value.toString();
      numInput.style.width = "60px";
      numInput.style.fontSize = "12px";
      numInput.style.background = "rgba(255,255,255,0.1)";
      numInput.style.color = "white";
      numInput.style.border = "1px solid rgba(255,255,255,0.3)";
      numInput.style.borderRadius = "4px";

      topRow.appendChild(labelEl);
      topRow.appendChild(numInput);
      
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = min.toString();
      slider.max = max.toString();
      slider.step = step.toString();
      slider.value = value.toString();
      
      const updateValue = (v: number) => {
        if (!Number.isNaN(v)) {
          slider.value = v.toString();
          numInput.value = v.toString();
          onChange(v);
        }
      };

      slider.oninput = () => updateValue(parseFloat(slider.value));
      numInput.onchange = () => updateValue(parseFloat(numInput.value));
      
      container.appendChild(topRow);
      container.appendChild(slider);
      debugPanel!.appendChild(container);
    }

    createSlider("Move Speed", 1, 50, 1, moveSpeed, v => moveSpeed = v);
    createSlider("Yaw Speed", 0.1, 5, 0.1, yawSpeed, v => yawSpeed = v);
    createSlider("Mouse Sens", 0.001, 0.02, 0.001, mouseSensitivity, v => mouseSensitivity = v);
    createSlider("Cam Dist Multi", 0.2, 3, 0.1, cameraDistMulti, v => cameraDistMulti = v);
  }

  let mouseDeltaX = 0;
  const onMouseMove = (ev: MouseEvent) => {
    if (mouseLookActive) {
      mouseDeltaX += ev.movementX;
    }
  };
  window.addEventListener("mousemove", onMouseMove);

  const resize = () => {
    const w = Math.max(shell.canvasHost.clientWidth, 1);
    const h = Math.max(shell.canvasHost.clientHeight, 1);
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    depthRenderTarget.setSize(w, h);
    env.resize(w, h);
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

  let raf = 0;
  let last = performance.now();
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;

    // Unified Camera Orbit & Submarine Rotation
    const orbitDir = (keyState.q ? 1 : 0) - (keyState.e ? 1 : 0);
    const desiredYawVel = orbitDir * yawSpeed;
    yawVel = THREE.MathUtils.lerp(yawVel, desiredYawVel, 1 - Math.exp(-dt * 14));
    
    // Update yaw from keyboard and mouse
    yaw += yawVel * dt;
    if (mouseLookActive) {
      yaw -= mouseDeltaX * mouseSensitivity;
      mouseDeltaX = 0;
    }

    // Submarine always faces away from the camera (forward into the view)
    const targetSubRotation = yaw + Math.PI;
    let diff = targetSubRotation - subGroup.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    subGroup.rotation.y += diff * (1 - Math.exp(-dt * 10));

    // Movement
    const forward = (keyState.w ? 1 : 0) - (keyState.s ? 1 : 0);
    const side = (keyState.d ? 1 : 0) - (keyState.a ? 1 : 0);
    const up = (keyState[" "] ? 1 : 0) - (keyState.shift ? 1 : 0);

    // Always move relative to camera yaw
    const moveX = (Math.cos(yaw) * side - Math.sin(yaw) * forward) * moveSpeed * dt;
    const moveZ = (Math.sin(yaw) * -side - Math.cos(yaw) * forward) * moveSpeed * dt;
    const moveY = up * moveSpeed * dt;

    subGroup.position.x += moveX;
    subGroup.position.y += moveY;
    
    // Phase 2: Restrict flying above water level
    const WATER_LEVEL = 8.0;
    if (subGroup.position.y > WATER_LEVEL) {
      subGroup.position.y = WATER_LEVEL;
    }

    subGroup.position.z += moveZ;

    env.tick(dt);

    // Follow target
    baseTarget.copy(subGroup.position);

    const actualRadius = radius * cameraDistMulti; // Closer view
    desired.set(Math.sin(yaw) * actualRadius, height * 0.7, Math.cos(yaw) * actualRadius).add(baseTarget);
    camPos.lerp(desired, 1 - Math.exp(-dt * 6));

    camera.position.copy(camPos);
    camera.lookAt(baseTarget);

    // Depth Pass
    env.water.visible = false;
    renderer.setRenderTarget(depthRenderTarget);
    renderer.render(scene, camera);
    
    // Main Pass
    env.water.visible = true;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousemove", onMouseMove);
    // mouseToggle.remove(); // Disabled
    if (debugPanel) debugPanel.remove();
    renderer.dispose();
    shell.canvasHost.innerHTML = "";
  };
}

