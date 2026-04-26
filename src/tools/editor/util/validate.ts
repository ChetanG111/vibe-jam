import type { MissionPack, ModelPack, UiScreenPack } from "../store/types";

export function validateMissionPack(v: any): { ok: true; value: MissionPack } | { ok: false; error: string } {
  if (!v || v.version !== 1) return { ok: false, error: "Mission pack must have version: 1" };
  if (!Array.isArray(v.templates)) return { ok: false, error: "Mission pack templates must be an array" };
  for (const t of v.templates) {
    if (!t || typeof t.id !== "string" || typeof t.name !== "string") {
      return { ok: false, error: "Each template must have string id and name" };
    }
    if (!["retrieve", "destroy", "smuggle"].includes(String(t.kind))) {
      return { ok: false, error: `Template ${t.id} has invalid kind` };
    }
    if (!t.reward || typeof t.reward.cashMin !== "number" || typeof t.reward.cashMax !== "number") {
      return { ok: false, error: `Template ${t.id} reward is invalid` };
    }
    if (!t.constraints || typeof t.constraints.maxObjectives !== "number") {
      return { ok: false, error: `Template ${t.id} constraints are invalid` };
    }
  }
  if (!v.generator || typeof v.generator.seed !== "number" || typeof v.generator.sampleCount !== "number") {
    return { ok: false, error: "Mission pack generator must have seed and sampleCount numbers" };
  }
  return { ok: true, value: v as MissionPack };
}

export function validateUiPack(v: any): { ok: true; value: UiScreenPack } | { ok: false; error: string } {
  if (!v || v.version !== 1) return { ok: false, error: "UI pack must have version: 1" };
  if (!Array.isArray(v.screens) || !v.screens.length) return { ok: false, error: "UI pack must have screens[]" };
  if (typeof v.activeScreenId !== "string") return { ok: false, error: "UI pack must have activeScreenId" };
  for (const s of v.screens) {
    if (!s || typeof s.id !== "string" || typeof s.name !== "string") return { ok: false, error: "Invalid screen" };
    if (typeof s.width !== "number" || typeof s.height !== "number") return { ok: false, error: `Screen ${s.id} must have width/height` };
    if (!s.theme || typeof s.theme.text !== "string") return { ok: false, error: `Screen ${s.id} theme is invalid` };
    if (!Array.isArray(s.nodes)) return { ok: false, error: `Screen ${s.id} nodes must be an array` };
  }
  return { ok: true, value: v as UiScreenPack };
}

export function validateModelPack(v: any): { ok: true; value: ModelPack } | { ok: false; error: string } {
  if (!v || v.version !== 1) return { ok: false, error: "Model pack must have version: 1" };
  if (!Array.isArray(v.models) || !v.models.length) return { ok: false, error: "Model pack must have models[]" };
  if (typeof v.activeModelId !== "string") return { ok: false, error: "Model pack must have activeModelId" };
  for (const m of v.models) {
    if (!m || typeof m.id !== "string" || typeof m.name !== "string") return { ok: false, error: "Invalid model entry" };
    if (!Array.isArray(m.parts)) return { ok: false, error: `Model ${m.id} parts must be an array` };
  }
  if (!v.budgets || typeof v.budgets.maxPerFileBytes !== "number" || typeof v.budgets.maxTotalBytes !== "number") {
    return { ok: false, error: "Model pack must have budgets {maxPerFileBytes,maxTotalBytes}" };
  }
  return { ok: true, value: v as ModelPack };
}

