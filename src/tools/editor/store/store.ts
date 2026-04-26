import { loadJson, saveJson } from "../util/persist";
import type { MissionPack } from "./types";
import type { UiScreenPack } from "./types";
import type { ModelPack } from "./types";

export type EditorStore = {
  missions: MissionPack;
  ui: UiScreenPack;
  models: ModelPack;
  saveAll: () => void;
};

const LS_KEY = "bsc_editor_store_v1";

export function createStore(): EditorStore {
  const saved = loadJson(LS_KEY);

  const missions: MissionPack = (saved?.missions as MissionPack) ?? defaultMissionPack();
  const ui: UiScreenPack = (saved?.ui as UiScreenPack) ?? defaultUiPack();
  const models: ModelPack = (saved?.models as ModelPack) ?? defaultModelPack();

  const saveAll = () => {
    saveJson(LS_KEY, { missions, ui, models, savedAt: new Date().toISOString() });
  };

  return { missions, ui, models, saveAll };
}

function defaultMissionPack(): MissionPack {
  return {
    version: 1,
    templates: [
      {
        id: "retrieve_wreck_cache",
        name: "Retrieve: Wreck Cache",
        kind: "retrieve",
        reward: { cashMin: 120, cashMax: 220, heat: 8 },
        constraints: { maxObjectives: 3, minDistance: 25, danger: 1 },
      },
      {
        id: "destroy_relay_node",
        name: "Destroy: Relay Node",
        kind: "destroy",
        reward: { cashMin: 160, cashMax: 280, heat: 14 },
        constraints: { maxObjectives: 2, minDistance: 35, danger: 2 },
      },
    ],
    generator: { seed: 1337, sampleCount: 8 },
  };
}

function defaultUiPack(): UiScreenPack {
  return {
    version: 1,
    screens: [
      {
        id: "hud_default",
        name: "HUD (Default)",
        width: 1280,
        height: 720,
        theme: {
          bg: "#070a0f",
          panel: "rgba(18, 22, 34, 0.92)",
          text: "#e9eefc",
          accent: "#6ee7ff",
          danger: "#ff5a7a",
          ok: "#4cffc6"
        },
        nodes: [
          {
            id: "heat_bar",
            type: "bar",
            x: 0.02,
            y: 0.03,
            w: 0.22,
            h: 0.05,
            props: { label: "HEAT", valueKey: "heat", color: "danger" },
          },
          {
            id: "mission_list",
            type: "list",
            x: 0.02,
            y: 0.10,
            w: 0.30,
            h: 0.25,
            props: { title: "CONTRACT", itemsKey: "objectives" },
          },
        ],
      },
    ],
    activeScreenId: "hud_default",
  };
}

function defaultModelPack(): ModelPack {
  return {
    version: 1,
    models: [
      {
        id: "sub_placeholder",
        name: "Sub (Procedural)",
        parts: [
          {
            id: "hull",
            type: "cylinder",
            position: [0, 0, 0],
            rotation: [0, 0, Math.PI / 2],
            scale: [0.8, 3.2, 0.8],
            color: "#1e2b44",
          },
          {
            id: "conning",
            type: "box",
            position: [0.2, 0.55, 0],
            rotation: [0, 0, 0],
            scale: [0.6, 0.4, 0.9],
            color: "#1e2b44",
          },
          {
            id: "nose",
            type: "cone",
            position: [-1.55, 0, 0],
            rotation: [0, 0, Math.PI / 2],
            scale: [0.75, 0.75, 0.9],
            color: "#1a2236",
          },
        ],
      },
    ],
    activeModelId: "sub_placeholder",
    budgets: { maxPerFileBytes: 256000, maxTotalBytes: 2097152 },
  };
}

