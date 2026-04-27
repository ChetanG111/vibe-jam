import * as THREE from "three";
import type { AppShell } from "../../shell/gameShell";
import { createSky } from "./sky";
import { DebugUI } from "./DebugUI";

export async function startGame(shell: AppShell) {
  shell.setHudChips([
    { label: "Mode", value: "Sky Explorer" },
    { label: "Status", value: "Clean Slate" },
  ]);
  shell.setHint("Use the sliders to tune the environment.");

  // --- Renderer Setup ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  shell.canvasHost.replaceChildren(renderer.domElement);

  // --- Scene & Camera ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(0, 2, 10);
  camera.lookAt(0, 2, 0);

  // --- Sky ---
  const sky = createSky();
  // Set vibrant defaults based on "Out of Water" reference
  sky.uniforms.topColor.value.set(0x004488);    // Richer Azure
  sky.uniforms.bottomColor.value.set(0x00ccff); // Brighter Cyan
  scene.add(sky.mesh);

  // --- Debug UI ---
  const ui = new DebugUI(shell.hud);
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

  // --- Resize ---
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

  // --- Loop ---
  let raf = 0;
  let last = performance.now();
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = (t - last) / 1000;
    last = t;

    sky.uniforms.time.value += dt;
    sky.mesh.position.copy(camera.position);

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    ui.dispose();
    renderer.dispose();
    shell.canvasHost.innerHTML = "";
  };
}
