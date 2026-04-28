import * as THREE from "three";
import type { EditorShell } from "../ui/editorShell";
import type { EditorStore } from "../store/store";
import type { PrimitivePart, PrimitiveType, ProceduralModel } from "../store/types";
import { copyText, downloadTextFile, safeJsonParse } from "../util/io";
import { validateModelPack } from "../util/validate";

export function registerModelEditor(ui: EditorShell, store: EditorStore, _unusedCanvasHost: HTMLElement) {
  ui.onTabChange((id) => {
    if (id !== "models") return;
    render(ui, store);
  });
}

function render(ui: EditorShell, store: EditorStore) {
  const pack = store.models;
  const active = pack.models.find((m) => m.id === pack.activeModelId) ?? pack.models[0]!;
  pack.activeModelId = active.id;

  let selectedPartId = active.parts[0]?.id ?? "";

  const left = document.createElement("div");
  left.className = "row";
  left.appendChild(sectionTitle("Models"));

  const modelSelect = document.createElement("select");
  for (const m of pack.models) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  }
  modelSelect.value = active.id;
  modelSelect.addEventListener("change", () => {
    pack.activeModelId = modelSelect.value;
    store.saveAll();
    render(ui, store);
  });
  left.appendChild(modelSelect);

  const modelBtns = document.createElement("div");
  modelBtns.className = "btnRow";
  modelBtns.append(
    button("New Model", "btn primary", () => {
      const id = `model_${Date.now().toString(36)}`;
      pack.models.unshift({ id, name: "New Model", parts: [] });
      pack.activeModelId = id;
      store.saveAll();
      render(ui, store);
    }),
    button("Duplicate", "btn", () => {
      const id = `${active.id}_copy_${Date.now().toString(36)}`;
      pack.models.unshift({ ...structuredClone(active), id, name: `${active.name} (Copy)` });
      pack.activeModelId = id;
      store.saveAll();
      render(ui, store);
    }),
  );
  left.appendChild(modelBtns);

  left.appendChild(sectionTitle("Parts"));
  const partSelect = document.createElement("select");
  for (const p of active.parts) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.type}: ${p.id}`;
    partSelect.appendChild(opt);
  }
  partSelect.value = selectedPartId;
  partSelect.addEventListener("change", () => {
    selectedPartId = partSelect.value;
    render(ui, store);
  });
  left.appendChild(partSelect);

  const addRow = document.createElement("div");
  addRow.className = "btnRow";
  for (const t of ["box", "cylinder", "cone"] as PrimitiveType[]) {
    addRow.appendChild(
      button(`+ ${t}`, "btn", () => {
        const id = `${t}_${Date.now().toString(36)}`;
        active.parts.push({
          id,
          type: t,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: "#1e2b44",
        });
        selectedPartId = id;
        store.saveAll();
        render(ui, store);
      }),
    );
  }
  left.appendChild(addRow);

  const delRow = document.createElement("div");
  delRow.className = "btnRow";
  delRow.appendChild(
    button("Delete Part", "btn danger", () => {
      const idx = active.parts.findIndex((p) => p.id === selectedPartId);
      if (idx >= 0) active.parts.splice(idx, 1);
      selectedPartId = active.parts[0]?.id ?? "";
      store.saveAll();
      render(ui, store);
    }),
  );
  left.appendChild(delRow);

  const center = buildModelPreview(active);
  const right = buildInspector(pack, active, selectedPartId, store, () => render(ui, store), center.api);

  ui.setLeft(left);
  ui.setCenter(center.root);
  ui.setRight(right);
  ui.setActiveTab("models");
}

function buildModelPreview(model: ProceduralModel) {
  const root = document.createElement("div");
  root.style.position = "absolute";
  root.style.inset = "0";
  root.style.background =
    "radial-gradient(900px 700px at 40% 30%, rgba(110,231,255,0.08) 0%, rgba(0,0,0,0.0) 55%)";

  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.inset = "14px";
  host.style.border = "1px solid var(--border)";
  host.style.borderRadius = "8px";
  host.style.overflow = "hidden";
  host.style.boxShadow = "0 18px 44px rgba(0,0,0,0.35)";
  root.appendChild(host);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x070a0f, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a0f, 0.06);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  camera.position.set(6, 5.6, 7.5);
  camera.lookAt(0, 0.6, 0);

  scene.add(new THREE.AmbientLight(0x7aa2ff, 0.25));
  const key = new THREE.DirectionalLight(0x9bd7ff, 0.9);
  key.position.set(6, 10, 5);
  scene.add(key);

  const grid = new THREE.GridHelper(18, 18, 0x1a2a44, 0x0e1626);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  scene.add(grid);

  const holder = new THREE.Group();
  scene.add(holder);

  let proceduralObj = buildProceduralModelObject(model);
  holder.add(proceduralObj);

  let gltfObj: THREE.Object3D | null = null;
  let objObj: THREE.Object3D | null = null;

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  const start = performance.now();
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const tt = (t - start) / 1000;
    holder.rotation.y = tt * 0.35;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  const api = {
    refreshProcedural: (m: ProceduralModel) => {
      holder.remove(proceduralObj);
      proceduralObj.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) o.material.dispose?.();
      });
      proceduralObj = buildProceduralModelObject(m);
      holder.add(proceduralObj);
    },
    async loadGltfFromFile(file: File) {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const url = URL.createObjectURL(file);
      try {
        const gltf = await loader.loadAsync(url);
        if (gltfObj) holder.remove(gltfObj);
        if (objObj) holder.remove(objObj);
        objObj = null;
        gltfObj = gltf.scene;
        gltfObj.position.set(0, 0, 0);
        gltfObj.scale.setScalar(1);
        holder.add(gltfObj);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    async loadObjFromFile(file: File) {
      const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
      const loader = new OBJLoader();
      const text = await file.text();
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
      if (gltfObj) holder.remove(gltfObj);
      gltfObj = null;
      if (objObj) holder.remove(objObj);
      objObj = obj;
      objObj.position.set(0, 0, 0);
      objObj.scale.setScalar(1);
      holder.add(objObj);
    },
    clearGltf() {
      if (gltfObj) {
        holder.remove(gltfObj);
        gltfObj = null;
      }
      if (objObj) {
        holder.remove(objObj);
        objObj = null;
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      root.remove();
    },
  };

  return { root, api };
}

function buildInspector(
  pack: any,
  model: ProceduralModel,
  selectedPartId: string,
  store: EditorStore,
  rerender: () => void,
  previewApi: any,
) {
  const wrap = document.createElement("div");
  wrap.className = "row";

  wrap.appendChild(sectionTitle("Model"));
  wrap.append(
    inputText("Name", model.name, (v) => {
      model.name = v;
      store.saveAll();
      rerender();
    }),
    inputText("ID", model.id, (v) => {
      model.id = sanitizeId(v);
      store.saveAll();
      rerender();
    }),
  );

  const part = model.parts.find((p) => p.id === selectedPartId);
  wrap.appendChild(sectionTitle("Selected Part"));
  if (!part) {
    wrap.appendChild(msg("error", "No part selected."));
  } else {
    wrap.append(
      inputText("Part ID", part.id, (v) => {
        part.id = sanitizeId(v);
        store.saveAll();
        rerender();
      }),
      inputSelect("Type", part.type, ["box", "cylinder", "cone"], (v) => {
        part.type = v as PrimitiveType;
        store.saveAll();
        previewApi.refreshProcedural(model);
        rerender();
      }),
      vec3Editor("Position", part.position, () => {
        store.saveAll();
        previewApi.refreshProcedural(model);
      }),
      vec3Editor("Rotation (rad)", part.rotation, () => {
        store.saveAll();
        previewApi.refreshProcedural(model);
      }),
      vec3Editor("Scale", part.scale, () => {
        store.saveAll();
        previewApi.refreshProcedural(model);
      }),
      inputText("Color", part.color, (v) => {
        part.color = v.trim();
        store.saveAll();
        previewApi.refreshProcedural(model);
      }),
    );
  }

  wrap.appendChild(sectionTitle("glTF/OBJ Preview (local file)"));
  const gltfHint = document.createElement("div");
  gltfHint.style.fontSize = "12px";
  gltfHint.style.color = "var(--muted)";
  gltfHint.textContent =
    "Load a local .glb/.gltf or .obj to preview. To ship a model, add optimized .glb/.gltf under src/assets/models/ and keep within budgets (default 250 KB each, 2 MB total).";
  wrap.appendChild(gltfHint);

  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".glb,.gltf,.obj";
  file.addEventListener("change", async () => {
    status.replaceChildren();
    const f = file.files?.[0];
    if (!f) return;
    try {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
        if (f.size > pack.budgets.maxPerFileBytes) {
          status.appendChild(
            msg("error", `File is ${formatBytes(f.size)} (max ${formatBytes(pack.budgets.maxPerFileBytes)}).`),
          );
          return;
        }
        await previewApi.loadGltfFromFile(f);
      } else if (lower.endsWith(".obj")) {
        await previewApi.loadObjFromFile(f);
      } else {
        status.appendChild(msg("error", "Unsupported file type."));
        return;
      }
      status.appendChild(msg("ok", "Loaded into preview."));
    } catch (e: any) {
      status.appendChild(msg("error", e?.message ? String(e.message) : "Failed to load glTF"));
    }
  });
  wrap.appendChild(file);

  const gltfBtns = document.createElement("div");
  gltfBtns.className = "btnRow";
  gltfBtns.appendChild(
    button("Clear glTF", "btn", () => {
      previewApi.clearGltf();
      status.replaceChildren(msg("ok", "Cleared."));
    }),
  );
  wrap.appendChild(gltfBtns);

  const status = document.createElement("div");
  wrap.appendChild(status);

  wrap.appendChild(sectionTitle("Pack IO"));
  const ta = document.createElement("textarea");
  ta.value = JSON.stringify(pack, null, 2);
  wrap.appendChild(ta);

  const ioRow = document.createElement("div");
  ioRow.className = "btnRow";
  const ioStatus = document.createElement("div");
  ioRow.append(
    button("Copy", "btn", async () => {
      await copyText(ta.value);
      ioStatus.replaceChildren(msg("ok", "Copied."));
    }),
    button("Download", "btn", () => {
      downloadTextFile("models.pack.json", JSON.stringify(pack, null, 2));
    }),
    button("Validate", "btn", () => {
      ioStatus.replaceChildren();
      const parsed = safeJsonParse(ta.value);
      if (!parsed.ok) return ioStatus.appendChild(msg("error", parsed.error));
      const val = validateModelPack(parsed.value);
      if (!val.ok) return ioStatus.appendChild(msg("error", val.error));
      ioStatus.appendChild(msg("ok", "Valid model pack."));
    }),
    button("Import", "btn primary", () => {
      ioStatus.replaceChildren();
      const parsed = safeJsonParse(ta.value);
      if (!parsed.ok) return ioStatus.appendChild(msg("error", parsed.error));
      const val = validateModelPack(parsed.value);
      if (!val.ok) return ioStatus.appendChild(msg("error", val.error));
      store.models.models = val.value.models;
      store.models.activeModelId = val.value.activeModelId;
      store.models.budgets = val.value.budgets;
      store.saveAll();
      ioStatus.appendChild(msg("ok", "Imported."));
      rerender();
    }),
  );
  wrap.append(ioRow, ioStatus);

  return wrap;
}

function buildProceduralModelObject(model: ProceduralModel) {
  const group = new THREE.Group();
  for (const part of model.parts) {
    const mesh = buildPrimitive(part);
    group.add(mesh);
  }
  group.position.y = 0.55;
  return group;
}

function buildPrimitive(part: PrimitivePart) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(part.color),
    metalness: 0.05,
    roughness: 0.85,
  });
  let geo: THREE.BufferGeometry;
  if (part.type === "box") geo = new THREE.BoxGeometry(1, 1, 1);
  else if (part.type === "cylinder") geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1);
  else geo = new THREE.ConeGeometry(0.5, 1, 10, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(part.position[0], part.position[1], part.position[2]);
  mesh.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2]);
  mesh.scale.set(part.scale[0], part.scale[1], part.scale[2]);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function vec3Editor(label: string, v: [number, number, number], onCommit: () => void) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  const lab = document.createElement("label");
  lab.textContent = label;
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(3, 1fr)";
  grid.style.gap = "6px";
  const xs = ["x", "y", "z"] as const;
  xs.forEach((axis, i) => {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.05";
    inp.value = String(v[i]);
    inp.placeholder = axis;
    inp.addEventListener("change", () => {
      v[i] = safeNum(inp.value, v[i]);
      onCommit();
    });
    grid.appendChild(inp);
  });
  wrap.append(lab, grid);
  return wrap;
}

function safeNum(s: string, fallback: number) {
  const v = Number(s);
  if (!Number.isFinite(v)) return fallback;
  return v;
}

function sectionTitle(text: string) {
  const d = document.createElement("div");
  d.style.marginTop = "10px";
  d.style.fontSize = "12px";
  d.style.color = "var(--muted)";
  d.textContent = text;
  return d;
}

function button(label: string, className: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function inputText(label: string, value: string, onChange: (v: string) => void) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  const lab = document.createElement("label");
  lab.textContent = label;
  const inp = document.createElement("input");
  inp.value = value;
  inp.addEventListener("input", () => onChange(inp.value));
  wrap.append(lab, inp);
  return wrap;
}

function inputSelect(label: string, value: string, options: string[], onChange: (v: string) => void) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  const lab = document.createElement("label");
  lab.textContent = label;
  const sel = document.createElement("select");
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  }
  sel.value = value;
  sel.addEventListener("change", () => onChange(sel.value));
  wrap.append(lab, sel);
  return wrap;
}

function sanitizeId(s: string) {
  return s.trim().toLowerCase().replaceAll(/[^a-z0-9_]+/g, "_").replaceAll(/^_+|_+$/g, "");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function msg(kind: "ok" | "error", text: string) {
  const d = document.createElement("div");
  d.className = kind === "ok" ? "ok" : "error";
  d.textContent = text;
  return d;
}
