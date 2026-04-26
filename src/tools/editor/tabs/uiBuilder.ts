import type { EditorShell } from "../ui/editorShell";
import type { EditorStore } from "../store/store";
import type { UiNode, UiNodeType, UiScreen } from "../store/types";
import { copyText, downloadTextFile, safeJsonParse } from "../util/io";
import { validateUiPack } from "../util/validate";

export function registerUiBuilder(ui: EditorShell, store: EditorStore) {
  ui.onTabChange((id) => {
    if (id !== "ui") return;
    render(ui, store);
  });
}

function render(ui: EditorShell, store: EditorStore) {
  const pack = store.ui;
  const active = pack.screens.find((s) => s.id === pack.activeScreenId) ?? pack.screens[0]!;
  pack.activeScreenId = active.id;

  let selectedNodeId = active.nodes[0]?.id ?? "";

  const left = document.createElement("div");
  left.className = "row";

  left.appendChild(sectionTitle("Screens"));
  const screenSelect = document.createElement("select");
  for (const s of pack.screens) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    screenSelect.appendChild(opt);
  }
  screenSelect.value = active.id;
  screenSelect.addEventListener("change", () => {
    pack.activeScreenId = screenSelect.value;
    store.saveAll();
    render(ui, store);
  });
  left.appendChild(screenSelect);

  const screenActions = document.createElement("div");
  screenActions.className = "btnRow";
  screenActions.append(
    button("New Screen", "btn primary", () => {
      const id = `screen_${Date.now().toString(36)}`;
      pack.screens.unshift({
        id,
        name: "New Screen",
        width: 1280,
        height: 720,
        theme: { ...active.theme },
        nodes: [],
      });
      pack.activeScreenId = id;
      store.saveAll();
      render(ui, store);
    }),
    button("Duplicate", "btn", () => {
      const id = `${active.id}_copy_${Date.now().toString(36)}`;
      pack.screens.unshift({ ...structuredClone(active), id, name: `${active.name} (Copy)` });
      pack.activeScreenId = id;
      store.saveAll();
      render(ui, store);
    }),
  );
  left.appendChild(screenActions);

  left.appendChild(sectionTitle("Nodes"));

  const nodeSelect = document.createElement("select");
  for (const n of active.nodes) {
    const opt = document.createElement("option");
    opt.value = n.id;
    opt.textContent = `${n.type}: ${n.id}`;
    nodeSelect.appendChild(opt);
  }
  nodeSelect.value = selectedNodeId;
  nodeSelect.addEventListener("change", () => {
    selectedNodeId = nodeSelect.value;
    render(ui, store);
  });
  left.appendChild(nodeSelect);

  const addRow = document.createElement("div");
  addRow.className = "btnRow";
  for (const t of ["container", "text", "button", "bar", "list"] as UiNodeType[]) {
    addRow.appendChild(
      button(`+ ${t}`, "btn", () => {
        const id = `${t}_${Date.now().toString(36)}`;
        active.nodes.push({
          id,
          type: t,
          x: 0.05,
          y: 0.05,
          w: 0.25,
          h: t === "text" ? 0.06 : 0.12,
          props: defaultProps(t),
        });
        selectedNodeId = id;
        store.saveAll();
        render(ui, store);
      }),
    );
  }
  left.appendChild(addRow);

  const delRow = document.createElement("div");
  delRow.className = "btnRow";
  delRow.appendChild(
    button("Delete Node", "btn danger", () => {
      const idx = active.nodes.findIndex((n) => n.id === selectedNodeId);
      if (idx >= 0) active.nodes.splice(idx, 1);
      selectedNodeId = active.nodes[0]?.id ?? "";
      store.saveAll();
      render(ui, store);
    }),
  );
  left.appendChild(delRow);

  const center = buildScreenPreview(active, selectedNodeId, (newSelectedId) => {
    selectedNodeId = newSelectedId;
    render(ui, store);
  }, () => {
    store.saveAll();
  });

  const right = buildInspector(pack, active, selectedNodeId, store, () => render(ui, store));

  ui.setLeft(left);
  ui.setCenter(center);
  ui.setRight(right);
  ui.setActiveTab("ui");
}

function buildScreenPreview(
  screen: UiScreen,
  selectedNodeId: string,
  onSelect: (id: string) => void,
  onChange: () => void,
) {
  const wrap = document.createElement("div");
  wrap.style.position = "absolute";
  wrap.style.inset = "0";
  wrap.style.display = "grid";
  wrap.style.placeItems = "center";
  wrap.style.padding = "16px";
  wrap.style.background =
    "radial-gradient(900px 700px at 40% 30%, rgba(110,231,255,0.08) 0%, rgba(0,0,0,0.0) 55%)";

  const stage = document.createElement("div");
  stage.style.position = "relative";
  stage.style.width = "min(1080px, 100%)";
  stage.style.aspectRatio = `${screen.width} / ${screen.height}`;
  stage.style.borderRadius = "8px";
  stage.style.border = "1px solid var(--border)";
  stage.style.background = "rgba(0,0,0,0.25)";
  stage.style.boxShadow = "0 18px 44px rgba(0,0,0,0.35)";
  stage.style.overflow = "hidden";
  wrap.appendChild(stage);

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  stage.appendChild(overlay);

  const mockData = {
    heat: 42,
    hull: 86,
    objectives: ["Ping to reveal", "Dock to accept contract", "Extract or push"],
  };

  for (const node of screen.nodes) {
    const el = renderNode(node, screen, mockData);
    el.style.left = `${node.x * 100}%`;
    el.style.top = `${node.y * 100}%`;
    el.style.width = `${node.w * 100}%`;
    el.style.height = `${node.h * 100}%`;
    el.dataset.nodeId = node.id;

    if (node.id === selectedNodeId) {
      const outline = document.createElement("div");
      outline.style.position = "absolute";
      outline.style.inset = "0";
      outline.style.border = "1px solid rgba(110,231,255,0.65)";
      outline.style.boxShadow = "0 0 0 2px rgba(110,231,255,0.12) inset";
      outline.style.borderRadius = "8px";
      overlay.appendChild(outline);
      outline.style.left = el.style.left;
      outline.style.top = el.style.top;
      outline.style.width = el.style.width;
      outline.style.height = el.style.height;
    }

    attachDragResize(el, stage, node, () => {
      onChange();
      overlay.replaceChildren();
      onSelect(node.id);
    });

    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      onSelect(node.id);
    });

    stage.appendChild(el);
  }

  stage.addEventListener("pointerdown", () => {
    onSelect(screen.nodes[0]?.id ?? "");
  });

  return wrap;
}

function attachDragResize(
  el: HTMLDivElement,
  stage: HTMLDivElement,
  node: UiNode,
  commit: () => void,
) {
  el.style.pointerEvents = "auto";

  const handle = document.createElement("div");
  handle.style.position = "absolute";
  handle.style.right = "4px";
  handle.style.bottom = "4px";
  handle.style.width = "10px";
  handle.style.height = "10px";
  handle.style.borderRadius = "3px";
  handle.style.background = "rgba(110,231,255,0.8)";
  handle.style.cursor = "nwse-resize";
  el.appendChild(handle);

  const toLocal = (evt: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    const x = (evt.clientX - r.left) / r.width;
    const y = (evt.clientY - r.top) / r.height;
    return { x, y };
  };

  let dragMode: "move" | "resize" | null = null;
  let start = { x: 0, y: 0, nx: 0, ny: 0, nw: 0, nh: 0 };

  const onDown = (evt: PointerEvent, mode: "move" | "resize") => {
    evt.preventDefault();
    evt.stopPropagation();
    dragMode = mode;
    const p = toLocal(evt);
    start = { x: p.x, y: p.y, nx: node.x, ny: node.y, nw: node.w, nh: node.h };
    (evt.target as HTMLElement).setPointerCapture(evt.pointerId);
  };

  const onMove = (evt: PointerEvent) => {
    if (!dragMode) return;
    const p = toLocal(evt);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (dragMode === "move") {
      node.x = clamp01(start.nx + dx);
      node.y = clamp01(start.ny + dy);
    } else {
      node.w = clamp01(start.nw + dx);
      node.h = clamp01(start.nh + dy);
      node.w = Math.max(node.w, 0.03);
      node.h = Math.max(node.h, 0.03);
    }
    el.style.left = `${node.x * 100}%`;
    el.style.top = `${node.y * 100}%`;
    el.style.width = `${node.w * 100}%`;
    el.style.height = `${node.h * 100}%`;
  };

  const onUp = () => {
    if (!dragMode) return;
    dragMode = null;
    commit();
  };

  el.addEventListener("pointerdown", (e) => onDown(e, "move"));
  handle.addEventListener("pointerdown", (e) => onDown(e, "resize"));
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}

function buildInspector(
  pack: any,
  screen: UiScreen,
  selectedNodeId: string,
  store: EditorStore,
  rerender: () => void,
) {
  const wrap = document.createElement("div");
  wrap.className = "row";

  wrap.appendChild(sectionTitle("Screen"));
  wrap.append(
    inputText("Name", screen.name, (v) => {
      screen.name = v;
      store.saveAll();
    }),
    inputNumber("Width", screen.width, (v) => {
      screen.width = clampInt(v, 320, 8192);
      store.saveAll();
      rerender();
    }),
    inputNumber("Height", screen.height, (v) => {
      screen.height = clampInt(v, 240, 8192);
      store.saveAll();
      rerender();
    }),
  );

  wrap.appendChild(sectionTitle("Theme"));
  for (const key of ["bg", "panel", "text", "accent", "danger", "ok"] as const) {
    wrap.appendChild(
      inputText(key, (screen.theme as any)[key], (v) => {
        (screen.theme as any)[key] = v;
        store.saveAll();
      }),
    );
  }

  const node = screen.nodes.find((n) => n.id === selectedNodeId);
  wrap.appendChild(sectionTitle("Selected Node"));
  if (!node) {
    wrap.appendChild(msg("error", "No node selected."));
  } else {
    wrap.append(
      inputText("ID", node.id, (v) => {
        node.id = sanitizeId(v);
        store.saveAll();
        rerender();
      }),
      inputSelect("Type", node.type, ["container", "text", "button", "bar", "list"], (v) => {
        node.type = v as UiNodeType;
        node.props = defaultProps(node.type);
        store.saveAll();
        rerender();
      }),
      inputNumber("X (0..1)", node.x, (v) => {
        node.x = clamp01(v);
        store.saveAll();
        rerender();
      }),
      inputNumber("Y (0..1)", node.y, (v) => {
        node.y = clamp01(v);
        store.saveAll();
        rerender();
      }),
      inputNumber("W (0..1)", node.w, (v) => {
        node.w = Math.max(0.03, clamp01(v));
        store.saveAll();
        rerender();
      }),
      inputNumber("H (0..1)", node.h, (v) => {
        node.h = Math.max(0.03, clamp01(v));
        store.saveAll();
        rerender();
      }),
    );

    wrap.appendChild(sectionTitle("Props (JSON)"));
    const propsTa = document.createElement("textarea");
    propsTa.value = JSON.stringify(node.props ?? {}, null, 2);
    wrap.appendChild(propsTa);
    const propsBtnRow = document.createElement("div");
    propsBtnRow.className = "btnRow";
    propsBtnRow.appendChild(
      button("Apply Props", "btn primary", () => {
        const parsed = safeJsonParse(propsTa.value);
        propsStatus.replaceChildren();
        if (!parsed.ok) {
          propsStatus.appendChild(msg("error", parsed.error));
          return;
        }
        node.props = parsed.value ?? {};
        store.saveAll();
        propsStatus.appendChild(msg("ok", "Applied."));
        rerender();
      }),
    );
    wrap.appendChild(propsBtnRow);
    const propsStatus = document.createElement("div");
    wrap.appendChild(propsStatus);
  }

  wrap.appendChild(sectionTitle("Pack IO"));
  const ta = document.createElement("textarea");
  ta.value = JSON.stringify(pack, null, 2);
  wrap.appendChild(ta);

  const ioRow = document.createElement("div");
  ioRow.className = "btnRow";
  const status = document.createElement("div");
  ioRow.append(
    button("Copy", "btn", async () => {
      await copyText(ta.value);
      status.replaceChildren(msg("ok", "Copied."));
    }),
    button("Download", "btn", () => {
      downloadTextFile("ui.pack.json", JSON.stringify(pack, null, 2));
    }),
    button("Validate", "btn", () => {
      status.replaceChildren();
      const parsed = safeJsonParse(ta.value);
      if (!parsed.ok) return status.appendChild(msg("error", parsed.error));
      const val = validateUiPack(parsed.value);
      if (!val.ok) return status.appendChild(msg("error", val.error));
      status.appendChild(msg("ok", "Valid UI pack."));
    }),
    button("Import", "btn primary", () => {
      status.replaceChildren();
      const parsed = safeJsonParse(ta.value);
      if (!parsed.ok) return status.appendChild(msg("error", parsed.error));
      const val = validateUiPack(parsed.value);
      if (!val.ok) return status.appendChild(msg("error", val.error));
      store.ui.screens = val.value.screens;
      store.ui.activeScreenId = val.value.activeScreenId;
      store.saveAll();
      status.appendChild(msg("ok", "Imported."));
      rerender();
    }),
  );
  wrap.append(ioRow, status);

  return wrap;
}

function renderNode(node: UiNode, screen: UiScreen, mock: any): HTMLDivElement {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.borderRadius = "8px";
  el.style.border = "1px solid rgba(255,255,255,0.10)";
  el.style.background = "rgba(10, 12, 18, 0.55)";
  el.style.color = screen.theme.text;
  el.style.boxSizing = "border-box";
  el.style.padding = "8px 10px";
  el.style.userSelect = "none";
  el.style.cursor = "grab";
  el.style.display = "grid";
  el.style.alignContent = "start";
  el.style.gap = "6px";

  if (node.type === "container") {
    el.style.background = screen.theme.panel;
    el.textContent = String((node.props as any).title ?? "Container");
  } else if (node.type === "text") {
    el.style.background = "transparent";
    el.style.border = "1px dashed rgba(255,255,255,0.10)";
    el.textContent = String((node.props as any).text ?? "Text");
  } else if (node.type === "button") {
    el.style.borderColor = "rgba(110,231,255,0.35)";
    el.style.background = "rgba(110,231,255,0.12)";
    el.textContent = String((node.props as any).label ?? "Button");
  } else if (node.type === "bar") {
    const label = String((node.props as any).label ?? "BAR");
    const key = String((node.props as any).valueKey ?? "heat");
    const value = Number(mock[key] ?? 0);
    const pct = clamp01(value / 100);
    const track = document.createElement("div");
    track.style.height = "8px";
    track.style.borderRadius = "999px";
    track.style.background = "rgba(255,255,255,0.10)";
    track.style.overflow = "hidden";
    const fill = document.createElement("div");
    fill.style.height = "100%";
    fill.style.width = `${pct * 100}%`;
    const token = String((node.props as any).color ?? "accent");
    fill.style.background =
      token === "danger" ? screen.theme.danger : token === "ok" ? screen.theme.ok : screen.theme.accent;
    track.appendChild(fill);
    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.justifyContent = "space-between";
    head.style.fontSize = "12px";
    head.style.color = "rgba(233,238,252,0.85)";
    head.innerHTML = `<span>${escapeHtml(label)}</span><span>${Math.round(value)}</span>`;
    el.replaceChildren(head, track);
  } else if (node.type === "list") {
    const title = String((node.props as any).title ?? "LIST");
    const key = String((node.props as any).itemsKey ?? "objectives");
    const items: string[] = Array.isArray(mock[key]) ? mock[key] : [];
    const head = document.createElement("div");
    head.style.fontSize = "12px";
    head.style.color = "rgba(233,238,252,0.85)";
    head.textContent = title;
    const body = document.createElement("div");
    body.style.display = "grid";
    body.style.gap = "4px";
    body.style.fontSize = "12px";
    body.style.color = "rgba(233,238,252,0.75)";
    for (const it of items.slice(0, 5)) {
      const line = document.createElement("div");
      line.textContent = `- ${it}`;
      body.appendChild(line);
    }
    el.replaceChildren(head, body);
  }
  return el;
}

function defaultProps(type: UiNodeType): Record<string, unknown> {
  if (type === "container") return { title: "Panel" };
  if (type === "text") return { text: "Text" };
  if (type === "button") return { label: "Button" };
  if (type === "bar") return { label: "HEAT", valueKey: "heat", color: "danger" };
  return { title: "CONTRACT", itemsKey: "objectives" };
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

function inputNumber(label: string, value: number, onChange: (v: number) => void) {
  const wrap = document.createElement("div");
  wrap.className = "row";
  const lab = document.createElement("label");
  lab.textContent = label;
  const inp = document.createElement("input");
  inp.type = "number";
  inp.value = String(value);
  inp.addEventListener("input", () => onChange(Number(inp.value)));
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

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function sanitizeId(s: string) {
  return s.trim().toLowerCase().replaceAll(/[^a-z0-9_]+/g, "_").replaceAll(/^_+|_+$/g, "");
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function msg(kind: "ok" | "error", text: string) {
  const d = document.createElement("div");
  d.className = kind === "ok" ? "ok" : "error";
  d.textContent = text;
  return d;
}

