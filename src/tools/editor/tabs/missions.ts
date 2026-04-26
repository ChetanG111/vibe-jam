import type { EditorShell } from "../ui/editorShell";
import type { EditorStore } from "../store/store";
import type { MissionKind, MissionTemplate } from "../store/types";
import { makeRng, pickOne } from "../util/rng";
import { copyText, downloadTextFile, safeJsonParse } from "../util/io";
import { validateMissionPack } from "../util/validate";

type GeneratedMission = {
  title: string;
  kind: MissionKind;
  rewardCash: number;
  heat: number;
  objectives: string[];
};

export function registerMissionEditor(ui: EditorShell, store: EditorStore) {
  ui.onTabChange((id) => {
    if (id !== "missions") return;
    render(ui, store);
  });
}

function render(ui: EditorShell, store: EditorStore) {
  const pack = store.missions;

  const left = document.createElement("div");
  left.className = "row";

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "8px";

  const header = document.createElement("div");
  header.innerHTML = `<div style="font-size:12px;color:var(--muted)">Templates</div>`;

  const btnRow = document.createElement("div");
  btnRow.className = "btnRow";
  const addBtn = button("New", "btn primary", () => {
    const id = `template_${Date.now().toString(36)}`;
    pack.templates.push({
      id,
      name: "New Contract",
      kind: "retrieve",
      reward: { cashMin: 100, cashMax: 150, heat: 8 },
      constraints: { maxObjectives: 3, minDistance: 20, danger: 1 },
    });
    pack.generator.seed = (pack.generator.seed + 1) | 0;
    store.saveAll();
    render(ui, store);
  });
  const dupBtn = button("Duplicate", "btn", () => {
    if (!pack.templates.length) return;
    const base = pack.templates[0]!;
    const id = `${base.id}_copy_${Date.now().toString(36)}`;
    pack.templates.unshift({ ...structuredClone(base), id, name: `${base.name} (Copy)` });
    store.saveAll();
    render(ui, store);
  });
  btnRow.append(addBtn, dupBtn);

  let selectedId = pack.templates[0]?.id ?? "";
  const select = document.createElement("select");
  for (const t of pack.templates) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  }
  select.value = selectedId;
  select.addEventListener("change", () => {
    selectedId = select.value;
    render(ui, store);
  });

  list.append(header, select, btnRow);
  left.appendChild(list);

  const center = document.createElement("div");
  center.style.height = "100%";
  center.style.padding = "14px";
  center.style.overflow = "auto";
  center.style.background =
    "radial-gradient(900px 700px at 40% 30%, rgba(110,231,255,0.08) 0%, rgba(0,0,0,0.0) 55%)";

  const genCard = document.createElement("div");
  genCard.style.maxWidth = "980px";
  genCard.style.margin = "0 auto";

  const genHeader = document.createElement("div");
  genHeader.style.display = "flex";
  genHeader.style.justifyContent = "space-between";
  genHeader.style.alignItems = "baseline";
  genHeader.style.gap = "12px";
  genHeader.style.marginBottom = "10px";
  genHeader.innerHTML = `<div style="font-size:14px;font-weight:600">Generator Preview</div>`;

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.alignItems = "center";

  const seedInput = inputNumber("Seed", pack.generator.seed, (v) => {
    pack.generator.seed = v | 0;
    store.saveAll();
    render(ui, store);
  });
  seedInput.style.maxWidth = "140px";

  const countInput = inputNumber("Samples", pack.generator.sampleCount, (v) => {
    pack.generator.sampleCount = clampInt(v, 1, 50);
    store.saveAll();
    render(ui, store);
  });
  countInput.style.maxWidth = "140px";

  const regenBtn = button("Regenerate", "btn primary", () => {
    pack.generator.seed = (pack.generator.seed + 1) | 0;
    store.saveAll();
    render(ui, store);
  });

  controls.append(seedInput, countInput, regenBtn);
  genHeader.appendChild(controls);
  genCard.appendChild(genHeader);

  const missions = generateMissions(pack.templates, pack.generator.seed, pack.generator.sampleCount);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(260px, 1fr))";
  grid.style.gap = "10px";

  for (const m of missions) {
    const card = document.createElement("div");
    card.style.border = "1px solid var(--border)";
    card.style.background = "rgba(10,12,18,0.45)";
    card.style.borderRadius = "8px";
    card.style.padding = "12px";
    card.style.boxShadow = "0 10px 26px rgba(0,0,0,0.22)";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
        <div style="font-weight:600">${escapeHtml(m.title)}</div>
        <div style="font-size:12px;color:var(--muted)">${escapeHtml(m.kind.toUpperCase())}</div>
      </div>
      <div style="margin-top:6px;font-size:12px;color:var(--muted)">Reward: <span style="color:var(--text)">${m.rewardCash}</span> cash, <span style="color:var(--danger)">+${m.heat}</span> heat</div>
      <div style="margin-top:10px;display:grid;gap:6px">
        ${m.objectives
          .map((o) => `<div style="font-size:12px">- ${escapeHtml(o)}</div>`)
          .join("")}
      </div>
    `;
    grid.appendChild(card);
  }

  genCard.appendChild(grid);
  center.appendChild(genCard);

  const right = missionInspector(pack, selectedId, store, () => render(ui, store));

  ui.setLeft(left);
  ui.setCenter(center);
  ui.setRight(right);
  ui.setActiveTab("missions");
}

function missionInspector(
  pack: any,
  selectedId: string,
  store: EditorStore,
  rerender: () => void,
) {
  const wrap = document.createElement("div");
  wrap.className = "row";

  const sel = (pack.templates as MissionTemplate[]).find((t) => t.id === selectedId) ?? pack.templates[0];
  if (!sel) {
    wrap.innerHTML = `<div class="error">No templates found.</div>`;
    return wrap;
  }

  const fields = document.createElement("div");
  fields.className = "row";

  fields.append(
    inputText("ID", sel.id, (v) => {
      sel.id = sanitizeId(v);
      store.saveAll();
      rerender();
    }),
    inputText("Name", sel.name, (v) => {
      sel.name = v;
      store.saveAll();
      rerender();
    }),
    inputSelect("Kind", sel.kind, ["retrieve", "destroy", "smuggle"], (v) => {
      sel.kind = v as MissionKind;
      store.saveAll();
      rerender();
    }),
    inputNumber("Cash Min", sel.reward.cashMin, (v) => {
      sel.reward.cashMin = clampInt(v, 0, 999999);
      sel.reward.cashMax = Math.max(sel.reward.cashMax, sel.reward.cashMin);
      store.saveAll();
      rerender();
    }),
    inputNumber("Cash Max", sel.reward.cashMax, (v) => {
      sel.reward.cashMax = clampInt(v, sel.reward.cashMin, 999999);
      store.saveAll();
      rerender();
    }),
    inputNumber("Heat", sel.reward.heat, (v) => {
      sel.reward.heat = clampInt(v, 0, 999);
      store.saveAll();
      rerender();
    }),
    inputNumber("Max Objectives", sel.constraints.maxObjectives, (v) => {
      sel.constraints.maxObjectives = clampInt(v, 1, 6);
      store.saveAll();
      rerender();
    }),
    inputNumber("Min Distance", sel.constraints.minDistance, (v) => {
      sel.constraints.minDistance = clampInt(v, 0, 999);
      store.saveAll();
      rerender();
    }),
    inputNumber("Danger (0-3)", sel.constraints.danger, (v) => {
      sel.constraints.danger = clampInt(v, 0, 3);
      store.saveAll();
      rerender();
    }),
  );

  const actions = document.createElement("div");
  actions.className = "btnRow";
  actions.append(
    button("Delete", "btn danger", () => {
      const idx = pack.templates.findIndex((t: MissionTemplate) => t.id === sel.id);
      if (idx >= 0) pack.templates.splice(idx, 1);
      store.saveAll();
      rerender();
    }),
    button("Export Pack", "btn", async () => {
      const text = JSON.stringify(pack, null, 2);
      await copyText(text);
    }),
    button("Download", "btn", () => {
      downloadTextFile("missions.pack.json", JSON.stringify(pack, null, 2));
    }),
  );

  const ioBox = document.createElement("div");
  ioBox.className = "row";
  const ta = document.createElement("textarea");
  ta.value = JSON.stringify(pack, null, 2);
  ioBox.appendChild(ta);

  const ioActions = document.createElement("div");
  ioActions.className = "btnRow";
  const validateBtn = button("Validate", "btn", () => {
    const parsed = safeJsonParse(ta.value);
    status.replaceChildren();
    if (!parsed.ok) {
      status.appendChild(msg("error", parsed.error));
      return;
    }
    const val = validateMissionPack(parsed.value);
    if (!val.ok) {
      status.appendChild(msg("error", val.error));
      return;
    }
    status.appendChild(msg("ok", "Valid mission pack."));
  });
  const importBtn = button("Import", "btn primary", () => {
    const parsed = safeJsonParse(ta.value);
    status.replaceChildren();
    if (!parsed.ok) {
      status.appendChild(msg("error", parsed.error));
      return;
    }
    const val = validateMissionPack(parsed.value);
    if (!val.ok) {
      status.appendChild(msg("error", val.error));
      return;
    }
    store.missions.templates = val.value.templates;
    store.missions.generator = val.value.generator;
    store.saveAll();
    status.appendChild(msg("ok", "Imported."));
    rerender();
  });
  ioActions.append(validateBtn, importBtn);

  const status = document.createElement("div");

  wrap.append(fields, actions, ioBox, ioActions, status);
  return wrap;
}

function generateMissions(templates: MissionTemplate[], seed: number, count: number): GeneratedMission[] {
  if (!templates.length) return [];
  const rng = makeRng(seed);
  const result: GeneratedMission[] = [];
  for (let i = 0; i < count; i++) {
    const t = pickOne(rng, templates);
    const cash = Math.round(t.reward.cashMin + (t.reward.cashMax - t.reward.cashMin) * rng());
    const objectives = buildObjectives(rng, t.kind, clampInt(t.constraints.maxObjectives, 1, 6));
    result.push({
      title: t.name,
      kind: t.kind,
      rewardCash: cash,
      heat: t.reward.heat,
      objectives,
    });
  }
  return result;
}

function buildObjectives(rng: () => number, kind: MissionKind, maxObjectives: number): string[] {
  const loc = pickOne(rng, ["outer trench", "wreck field", "pipeline bend", "shallow shelf", "dead zone"]);
  const who = pickOne(rng, ["broker", "handler", "dock rat", "silent buyer", "navy defector"]);
  const objCount = 1 + Math.floor(rng() * maxObjectives);
  const out: string[] = [];

  if (kind === "retrieve") {
    out.push(`Locate cache in ${loc}`);
    if (objCount > 1) out.push("Grab the sealed crate");
    if (objCount > 2) out.push(`Deliver to drop point (${who})`);
  } else if (kind === "destroy") {
    out.push(`Find target node in ${loc}`);
    if (objCount > 1) out.push("Plant charge");
    if (objCount > 2) out.push("Clear the blast radius");
  } else {
    out.push(`Meet courier in ${loc}`);
    if (objCount > 1) out.push("Pick up contraband");
    if (objCount > 2) out.push(`Deliver without scans (${who})`);
  }
  return out;
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

