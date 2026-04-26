import * as THREE from "three";
import type { AppShell } from "../../shell/gameShell";
import { setupEnvironment } from "./environment";
import { loadSubmarine, SubmarineModelType } from "./submarine";
import { getCameraDistanceForObject, getVisualCenter } from "./cameraUtils";
import { createRockFormations } from "./terrain";
// import { createVolumetricBeam } from "./lightUtils";

export async function startGame(shell: AppShell) {
  shell.setHudChips([
    { label: "Mode", value: "Game" },
    { label: "Camera", value: "Q/E orbit" },
  ]);
  shell.setHint("WASD to move. Space/Shift for depth. Q/E to orbit.");

  // --- Underwater Overlay (Screen Tint) ---
  const overlay = document.createElement("div");
  overlay.id = "underwater-overlay";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.background = "radial-gradient(circle, rgba(0, 40, 80, 0.0) 0%, rgba(0, 20, 40, 0.6) 100%)";
  overlay.style.backgroundColor = "rgba(0, 60, 120, 0.15)";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.1s linear"; // We'll update manually for smoother lerp
  shell.hud.appendChild(overlay);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x020408, 1);
  shell.canvasHost.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  camera.layers.enable(0);
  camera.layers.enable(1);

  const env = setupEnvironment(scene);

  const subGroup = new THREE.Group();
  subGroup.position.set(0, 9.0, 0);
  scene.add(subGroup);

  // --- Hero Lighting (Submarine visibility) ---
  const heroLight = new THREE.DirectionalLight(0xffffff, 5.0);
  heroLight.layers.set(1);
  camera.add(heroLight);
  scene.add(camera);

  const heroAmbient = new THREE.AmbientLight(0xffffff, 1.0);
  heroAmbient.layers.set(1);
  scene.add(heroAmbient);

  // --- Submarine Headlight ---
  const headLight = new THREE.SpotLight(0xfff5e6, 2000.0, 400, 1.0, 0.2, 1);
  headLight.position.set(0, 0, 5.5); // Moved further forward to clear the new GLB nose
  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0, 0, 20);
  subGroup.add(headLight);
  subGroup.add(lightTarget);
  headLight.target = lightTarget;

  /*
  // --- Volumetric Beam ---
  const { beam, update: updateBeam } = createVolumetricBeam(headLight);
  subGroup.add(beam);
  beam.position.copy(headLight.position);
  */

  // --- Model Container ---
  // We put the model in its own group so we can clear it without deleting lights
  const modelGroup = new THREE.Group();
  subGroup.add(modelGroup);

  // Initial Load
  const updateModelLayers = () => {
    modelGroup.traverse(child => {
      child.layers.set(1);
    });
    // Ensure the headlight (which is a sibling) stays on both layers
    headLight.layers.enable(0);
    headLight.layers.enable(1);
  };

  await loadSubmarine(modelGroup, "glb_lowpoly");
  updateModelLayers();

  let yaw = Math.PI;
  let yawVel = 0;
  let yawSpeed = 0.25;
  let moveSpeed = 8.0;
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
    debugPanel.style.maxHeight = "80vh";
    debugPanel.style.overflowY = "auto";
    shell.hud.appendChild(debugPanel);

    function createFolder(title: string) {
      const details = document.createElement("details");
      details.style.marginBottom = "8px";
      details.style.background = "rgba(0,0,0,0.2)";
      details.style.borderRadius = "4px";
      details.style.padding = "4px 8px";
      details.open = false;
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

    const modelFolder = createFolder("Submarine Model");
    modelFolder.details.open = true;
    const modelSelect = document.createElement("select");
    modelSelect.style.background = "rgba(255,255,255,0.1)";
    modelSelect.style.color = "white";
    modelSelect.style.border = "1px solid rgba(255,255,255,0.3)";
    modelSelect.style.borderRadius = "4px";
    modelSelect.style.padding = "4px";
    modelSelect.style.fontSize = "12px";

    const options: { label: string, value: SubmarineModelType }[] = [
      { label: "Low-Poly GLB", value: "glb_lowpoly" },
      { label: "Type XXI GLB", value: "glb_type_xxi" },
      { label: "Seaview OBJ", value: "obj" },
      { label: "Procedural", value: "procedural" },
    ];

    options.forEach(opt => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      modelSelect.appendChild(el);
    });

    modelSelect.onchange = async () => {
      await loadSubmarine(modelGroup, modelSelect.value as SubmarineModelType);
      updateModelLayers();
    };
    modelFolder.content.appendChild(modelSelect);

    const camFolder = createFolder("Camera & Movement");
    createSlider("Move Speed", 1, 50, 1, moveSpeed, v => moveSpeed = v, camFolder.content);
    createSlider("Yaw Speed", 0.1, 5, 0.1, yawSpeed, v => yawSpeed = v, camFolder.content);
    createSlider("Cam Dist Multi", 0.2, 3, 0.1, cameraDistMulti, v => cameraDistMulti = v, camFolder.content);

    const terrainFolder = createFolder("Ocean Floor (Low Poly Tuning)");
    const opts = env.terrain.options;
    createSlider("Number of Faces (Detail)", 4, 300, 2, opts.segments, v => env.terrain.regenerate({ segments: v }), terrainFolder.content);
    createSlider("Noise Scale", 0.001, 0.05, 0.001, opts.noiseScale, v => env.terrain.regenerate({ noiseScale: v }), terrainFolder.content);
    createSlider("Height Scale", 5, 150, 5, opts.heightScale, v => env.terrain.regenerate({ heightScale: v }), terrainFolder.content);
    createSlider("Floor Depth", -200, 0, 1, env.terrain.mesh.position.y, v => env.terrain.mesh.position.y = v, terrainFolder.content);
    createSlider("Edge Sharpness", 0, 1.0, 0.05, env.terrain.wireMat.opacity, v => env.terrain.wireMat.opacity = v, terrainFolder.content);

    const lightFolder = createFolder("Submarine Lights");
    createSlider("Headlight Intensity", 0, 3000, 10, headLight.intensity, v => headLight.intensity = v, lightFolder.content);
    createSlider("Sub visibility (Hero Light)", 0, 10, 0.1, heroLight.intensity, v => {
      heroLight.intensity = v;
      heroAmbient.intensity = v * 0.2;
    }, lightFolder.content);
    createSlider("Wideness (Angle)", 0.1, 1.5, 0.05, headLight.angle, v => headLight.angle = v, lightFolder.content);
    createSlider("Focus (Penumbra)", 0, 1, 0.05, headLight.penumbra, v => headLight.penumbra = v, lightFolder.content);
    createSlider("Range (Distance)", 10, 600, 10, headLight.distance, v => headLight.distance = v, lightFolder.content);

    const rockFolder = createFolder("Rock Formations (Canyon)");
    const rOpts = {
      count: 800,
      minSize: 6,
      maxSize: 25,
      randomness: 0.3
    };

    const updateRocks = () => {
      scene.children.forEach(c => {
        if (c.name === "rockGroup") {
          // Properly dispose of materials
          c.traverse(child => {
            if (child instanceof THREE.Mesh) {
              if (child.material instanceof THREE.Material) child.material.dispose();
            }
          });
          scene.remove(c);
        }
      });
      const newRocks = createRockFormations({ ...rOpts, range: 2000 });
      newRocks.name = "rockGroup";
      scene.add(newRocks);
    };

    createSlider("Rock Count", 10, 1200, 10, rOpts.count, v => { rOpts.count = v; updateRocks(); }, rockFolder.content);
    createSlider("Min Size", 1, 50, 1, rOpts.minSize, v => { rOpts.minSize = v; updateRocks(); }, rockFolder.content);
    createSlider("Max Size", 5, 100, 1, rOpts.maxSize, v => { rOpts.maxSize = v; updateRocks(); }, rockFolder.content);
    createSlider("Randomness (Scatter)", 0, 1.0, 0.05, rOpts.randomness, v => { rOpts.randomness = v; updateRocks(); }, rockFolder.content);
  }

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

  // const subCenter = getVisualCenter(subGroup);
  // subGroup.position.sub(subCenter);

  const WATER_LEVEL = 8.0;
  const SURFACE_OFFSET = 1.0;
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
    const orbitDir = (keyState.q ? 1 : 0) - (keyState.e ? 1 : 0);
    const desiredYawVel = orbitDir * yawSpeed;
    yawVel = THREE.MathUtils.lerp(yawVel, desiredYawVel, 1 - Math.exp(-dt * 14));
    yaw += yawVel * dt;
    const targetSubRotation = yaw + Math.PI;
    let diff = targetSubRotation - subGroup.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    subGroup.rotation.y += diff * (1 - Math.exp(-dt * 10));
    const forward = (keyState.w ? 1 : 0) - (keyState.s ? 1 : 0);
    const side = (keyState.d ? 1 : 0) - (keyState.a ? 1 : 0);
    const up = (keyState[" "] ? 1 : 0) - (keyState.shift ? 1 : 0);
    const moveX = (Math.cos(yaw) * side - Math.sin(yaw) * forward) * moveSpeed * dt;
    const moveZ = (Math.sin(yaw) * -side - Math.cos(yaw) * forward) * moveSpeed * dt;
    const moveY = up * moveSpeed * dt;
    subGroup.position.x += moveX;
    subGroup.position.y += moveY;
    if (subGroup.position.y > WATER_LEVEL + SURFACE_OFFSET) {
      subGroup.position.y = WATER_LEVEL + SURFACE_OFFSET;
    }
    const floorY = env.terrain.getHeight(subGroup.position.x, subGroup.position.z) + env.terrain.mesh.position.y;
    const minHeight = floorY + 1.2;
    if (subGroup.position.y < minHeight) {
      subGroup.position.y = minHeight;
    }
    subGroup.position.z += moveZ;
    env.tick(dt);
    baseTarget.copy(subGroup.position);
    const actualRadius = radius * cameraDistMulti;
    desired.set(Math.sin(yaw) * actualRadius, height * 0.7, Math.cos(yaw) * actualRadius).add(baseTarget);
    camPos.lerp(desired, 1 - Math.exp(-dt * 6));
    camera.position.copy(camPos);
    camera.lookAt(baseTarget);

    // updateBeam(); // Keep beam synced with any spotlight changes

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (debugPanel) debugPanel.remove();
    renderer.dispose();
    shell.canvasHost.innerHTML = "";
  };
}
