export type EditorTabId = "missions" | "ui" | "models";

export type EditorShell = {
  root: HTMLDivElement;
  left: HTMLDivElement;
  center: HTMLDivElement;
  right: HTMLDivElement;
  setActiveTab: (id: EditorTabId) => void;
  setCenter: (node: HTMLElement) => void;
  setRight: (node: HTMLElement) => void;
  setLeft: (node: HTMLElement) => void;
  onTabChange: (cb: (id: EditorTabId) => void) => void;
};

export function createEditorShell(): EditorShell {
  const root = document.createElement("div");
  root.className = "editorShell";

  const left = document.createElement("div");
  left.className = "panel";
  root.appendChild(left);

  const center = document.createElement("div");
  center.style.position = "relative";
  center.style.overflow = "hidden";
  root.appendChild(center);

  const right = document.createElement("div");
  right.className = "panel right";
  root.appendChild(right);

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  left.appendChild(tabs);

  const tabIds: Array<{ id: EditorTabId; label: string }> = [
    { id: "missions", label: "Missions" },
    { id: "ui", label: "UI" },
    { id: "models", label: "Models" },
  ];

  const listeners: Array<(id: EditorTabId) => void> = [];
  const buttons = new Map<EditorTabId, HTMLButtonElement>();

  for (const t of tabIds) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tabBtn";
    b.textContent = t.label;
    b.setAttribute("aria-selected", "false");
    b.addEventListener("click", () => {
      setActiveTab(t.id);
    });
    buttons.set(t.id, b);
    tabs.appendChild(b);
  }

  const leftBody = document.createElement("div");
  leftBody.className = "panelBody";
  left.appendChild(leftBody);

  const rightBody = document.createElement("div");
  rightBody.className = "panelBody";
  right.appendChild(rightBody);

  const setLeft = (node: HTMLElement) => {
    leftBody.replaceChildren(node);
  };
  const setCenter = (node: HTMLElement) => {
    center.replaceChildren(node);
  };
  const setRight = (node: HTMLElement) => {
    rightBody.replaceChildren(node);
  };

  const setActiveTab = (id: EditorTabId) => {
    for (const [tid, btn] of buttons.entries()) {
      btn.setAttribute("aria-selected", tid === id ? "true" : "false");
    }
    for (const cb of listeners) cb(id);
  };

  const onTabChange = (cb: (id: EditorTabId) => void) => {
    listeners.push(cb);
  };

  return { root, left, center, right, setActiveTab, setCenter, setRight, setLeft, onTabChange };
}
