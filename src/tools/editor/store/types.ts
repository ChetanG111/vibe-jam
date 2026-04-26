export type MissionKind = "retrieve" | "destroy" | "smuggle";

export type MissionTemplate = {
  id: string;
  name: string;
  kind: MissionKind;
  reward: {
    cashMin: number;
    cashMax: number;
    heat: number;
  };
  constraints: {
    maxObjectives: number;
    minDistance: number;
    danger: number; // 0..3
  };
};

export type MissionPack = {
  version: 1;
  templates: MissionTemplate[];
  generator: { seed: number; sampleCount: number };
};

export type UiNodeType = "container" | "text" | "button" | "bar" | "list";

export type UiTheme = {
  bg: string;
  panel: string;
  text: string;
  accent: string;
  danger: string;
  ok: string;
};

export type UiNode = {
  id: string;
  type: UiNodeType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, unknown>;
};

export type UiScreen = {
  id: string;
  name: string;
  width: number;
  height: number;
  theme: UiTheme;
  nodes: UiNode[];
};

export type UiScreenPack = {
  version: 1;
  screens: UiScreen[];
  activeScreenId: string;
};

export type PrimitiveType = "box" | "cylinder" | "cone";

export type PrimitivePart = {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string; // hex
};

export type ProceduralModel = {
  id: string;
  name: string;
  parts: PrimitivePart[];
};

export type ModelPack = {
  version: 1;
  models: ProceduralModel[];
  activeModelId: string;
  budgets: { maxPerFileBytes: number; maxTotalBytes: number };
};

