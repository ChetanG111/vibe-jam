import { createGameShell } from "../shell/gameShell";

export async function boot(mount: HTMLElement | null) {
  if (!mount) throw new Error("Missing #app mount element");
  mount.innerHTML = "";

  const url = new URL(window.location.href);
  const mode = (url.searchParams.get("mode") || "").toLowerCase();

  const shell = createGameShell();
  mount.appendChild(shell.root);

  // Editors are dev-only. In production builds we do not ship editor code or allow editor mode.
  if (mode === "editor") {
    if (import.meta.env.DEV) {
      const { startEditor } = await import("../tools/editor/startEditor");
      await startEditor(shell);
      return;
    }
    shell.setHudChips([{ label: "Mode", value: "Game" }]);
    shell.setHint("Editor mode is available only in dev. Run `npm.cmd run dev` and open `/?mode=editor`.");
  }

  const { startPlaceholderGame } = await import("../world/placeholder/startPlaceholderGame");
  await startPlaceholderGame(shell);
}
