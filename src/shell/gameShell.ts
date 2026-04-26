export type AppShell = {
  root: HTMLDivElement;
  canvasHost: HTMLDivElement;
  hud: HTMLDivElement;
  hint: HTMLDivElement;
  setHint: (text: string) => void;
  setHudChips: (chips: Array<{ label: string; value: string }>) => void;
};

export function createGameShell(): AppShell {
  const root = document.createElement("div");
  root.className = "appRoot";

  const canvasHost = document.createElement("div");
  canvasHost.style.position = "absolute";
  canvasHost.style.inset = "0";
  canvasHost.style.overflow = "hidden";
  root.appendChild(canvasHost);

  const hud = document.createElement("div");
  hud.className = "hudLayer";
  root.appendChild(hud);

  const hudBar = document.createElement("div");
  hudBar.className = "hudBar";
  hud.appendChild(hudBar);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent =
    "Press ?mode=editor in the URL to open editors. This build is editor-first; gameplay/movement is intentionally stubbed.";
  hud.appendChild(hint);

  const setHint = (text: string) => {
    hint.textContent = text;
  };

  const setHudChips = (chips: Array<{ label: string; value: string }>) => {
    hudBar.innerHTML = "";
    for (const chip of chips) {
      const el = document.createElement("div");
      el.className = "chip";
      el.innerHTML = `<strong>${escapeHtml(chip.label)}</strong> ${escapeHtml(chip.value)}`;
      hudBar.appendChild(el);
    }
  };

  return { root, canvasHost, hud, hint, setHint, setHudChips };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

