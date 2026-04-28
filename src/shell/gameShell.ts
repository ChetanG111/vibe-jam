// src/shell/gameShell.ts
/**
 * Minimal stub of the AppShell interface used by editor and placeholder code.
 * Extend this definition with actual implementation details as the project evolves.
 */
export interface AppShell {
  /** DOM element that hosts the WebGL canvas */
  canvasHost: HTMLElement;
  /** Root container where UI components are attached */
  root: HTMLElement;
  /** Set HUD chips – small status labels displayed in the UI */
  setHudChips(chips: { label: string; value: string }[]): void;
  /** Show a hint or tooltip to the user */
  setHint(text: string): void;
}
