import type { AppShell } from "../../shell/gameShell";
import { createEditorShell } from "./ui/editorShell";
import { createStore } from "./store/store";
import { registerMissionEditor } from "./tabs/missions";
import { registerModelEditor } from "./tabs/models";
import { registerUiBuilder } from "./tabs/uiBuilder";

export async function startEditor(shell: AppShell) {
  shell.setHudChips([{ label: "Mode", value: "Editor" }]);
  shell.setHint("Editor mode: build missions, UI screens, and models. No gameplay/movement in this phase.");

  const store = createStore();
  const ui = createEditorShell();
  shell.root.appendChild(ui.root);

  registerMissionEditor(ui, store);
  registerUiBuilder(ui, store);
  registerModelEditor(ui, store, shell.canvasHost);

  ui.setActiveTab("missions");
}

