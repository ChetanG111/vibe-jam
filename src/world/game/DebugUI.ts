import * as THREE from "three";

export class DebugUI {
  private panel: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      position: "absolute",
      left: "16px",
      top: "16px",
      background: "rgba(10, 15, 20, 0.95)",
      backdropFilter: "blur(12px)",
      padding: "20px",
      borderRadius: "16px",
      color: "white",
      fontFamily: "'Outfit', 'Inter', sans-serif",
      fontSize: "13px",
      width: "280px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
      zIndex: "9999",
      maxHeight: "85vh",
      overflowY: "auto",
      pointerEvents: "auto",
      userSelect: "none"
    });
    parent.style.pointerEvents = "none"; // HUD itself is passthrough
    this.panel.style.pointerEvents = "auto"; // Panel is interactive
    parent.appendChild(this.panel);
  }

  addFolder(title: string) {
    const details = document.createElement("details");
    details.open = true;
    details.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    details.style.paddingBottom = "12px";
    
    const summary = document.createElement("summary");
    summary.textContent = title.toUpperCase();
    summary.style.cursor = "pointer";
    summary.style.fontWeight = "800";
    summary.style.letterSpacing = "0.05em";
    summary.style.padding = "8px 0";
    summary.style.color = "#00ffff"; // Cyan accent
    
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";
    container.style.marginTop = "8px";

    details.appendChild(summary);
    details.appendChild(container);
    this.panel.appendChild(details);
    return container;
  }

  addSlider(folder: HTMLElement, label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = "6px";

    const labelRow = document.createElement("div");
    labelRow.style.display = "flex";
    labelRow.style.justifyContent = "space-between";
    
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    labelEl.style.opacity = "0.6";

    const valueEl = document.createElement("span");
    valueEl.textContent = value.toFixed(3);
    valueEl.style.fontFamily = "monospace";
    valueEl.style.color = "#00ffff";

    labelRow.appendChild(labelEl);
    labelRow.appendChild(valueEl);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min.toString();
    slider.max = max.toString();
    slider.step = step.toString();
    slider.value = value.toString();
    slider.style.width = "100%";
    slider.style.accentColor = "#00ffff";
    slider.style.cursor = "pointer";

    slider.oninput = () => {
      const v = parseFloat(slider.value);
      valueEl.textContent = v.toFixed(3);
      onChange(v);
    };

    row.appendChild(labelRow);
    row.appendChild(slider);
    folder.appendChild(row);
  }

  addColor(folder: HTMLElement, label: string, color: THREE.Color, onChange: () => void) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    labelEl.style.opacity = "0.6";

    const input = document.createElement("input");
    input.type = "color";
    input.value = "#" + color.getHexString();
    input.style.border = "1px solid rgba(255,255,255,0.2)";
    input.style.width = "40px";
    input.style.height = "20px";
    input.style.borderRadius = "4px";
    input.style.cursor = "pointer";
    input.style.padding = "0";

    input.oninput = () => {
      color.set(input.value);
      onChange();
    };

    row.appendChild(labelEl);
    row.appendChild(input);
    folder.appendChild(row);
  }

  dispose() {
    this.panel.remove();
  }
}
