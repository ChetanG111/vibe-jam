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

  const env = setupEnvironment(scene);

  const subGroup = new THREE.Group();
  subGroup.position.set(0, 9.0, 0); // Start at surface
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

    function createFolder(title: string) {
      const details = document.createElement("details");
      details.style.marginBottom = "8px";
      details.style.background = "rgba(0,0,0,0.2)";
      details.style.borderRadius = "4px";
      details.style.padding = "4px 8px";
      details.open = false; // Collapsed by default to save room

      const summary = document.createElement("summary");
      summary.textContent = title;
      summary.style.cursor = "pointer";
      summary.style.fontWeight = "bold";
      summary.style.fontSize = "13px";
      summary.style.userSelect = "none";
      details.appendChild(summary);

      const content = document.createElement("div");
      content.style.display = "flex";
      content.style.flexDirection = "column";
      content.style.gap = "8px";
      content.style.marginTop = "8px";
      content.style.paddingBottom = "4px";
      details.appendChild(content);

      debugPanel?.appendChild(details);
      return { content, details };
    }

    function createSlider(label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void, parent: HTMLElement | null = debugPanel) {
      if (!parent) return;
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
      parent.appendChild(container);
    }

    function createColorPicker(label: string, initialHex: string, onChange: (v: string) => void, parent: HTMLElement | null = debugPanel) {
      if (!parent) return;
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.justifyContent = "space-between";
      container.style.alignItems = "center";
      
      const labelEl = document.createElement("div");
      labelEl.textContent = label;
      labelEl.style.fontSize = "12px";
      
      const input = document.createElement("input");
      input.type = "color";
      input.value = initialHex;
      input.style.width = "40px";
      input.style.height = "20px";
      input.style.padding = "0";
      input.style.border = "none";
      input.style.background = "transparent";
      input.style.cursor = "pointer";
      
      input.oninput = () => onChange(input.value);
      
      container.appendChild(labelEl);
      container.appendChild(input);
      parent.appendChild(container);
    }

    const camFolder = createFolder("Camera & Movement");
    camFolder.details.open = true; // Keep the first one open
    createSlider("Move Speed", 1, 50, 1, moveSpeed, v => moveSpeed = v, camFolder.content);
    createSlider("Yaw Speed", 0.1, 5, 0.1, yawSpeed, v => yawSpeed = v, camFolder.content);
    createSlider("Mouse Sens", 0.001, 0.02, 0.001, mouseSensitivity, v => mouseSensitivity = v, camFolder.content);
    createSlider("Cam Dist Multi", 0.2, 3, 0.1, cameraDistMulti, v => cameraDistMulti = v, camFolder.content);

    const waterFolder = createFolder("Water Shader");
    createColorPicker("Water Deep", "#" + env.waterUniforms.waterColor.value.getHexString(), v => env.waterUniforms.waterColor.value.set(v), waterFolder.content);
    createColorPicker("Water Shallow", "#" + env.waterUniforms.skyColor.value.getHexString(), v => env.waterUniforms.skyColor.value.set(v), waterFolder.content);
    createSlider("Water Opacity", 0.1, 1.0, 0.05, env.waterUniforms.opacity.value, v => env.waterUniforms.opacity.value = v, waterFolder.content);
    createSlider("Normal Strength", 0.1, 10.0, 0.1, env.waterUniforms.normalStrength.value, v => env.waterUniforms.normalStrength.value = v, waterFolder.content);
    createSlider("Fresnel Power", 0.1, 8.0, 0.1, env.waterUniforms.fresnelPower.value, v => env.waterUniforms.fresnelPower.value = v, waterFolder.content);
    createSlider("Foam Particles", 0.0, 1.0, 0.05, env.waterUniforms.foamDensity.value, v => env.waterUniforms.foamDensity.value = v, waterFolder.content);
    createSlider("Sun Sparkles", 0.0, 1.0, 0.05, env.waterUniforms.sunSparkleDensity.value, v => env.waterUniforms.sunSparkleDensity.value = v, waterFolder.content);
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

  const WATER_LEVEL = 8.0;
  const SURFACE_OFFSET = 1.0; // Restored height so it sits comfortably like a boat!
  
  // Snap the submarine exactly to the water surface at start
  subGroup.position.y = WATER_LEVEL + SURFACE_OFFSET;

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
    if (subGroup.position.y > WATER_LEVEL + SURFACE_OFFSET) {
      subGroup.position.y = WATER_LEVEL + SURFACE_OFFSET;
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

