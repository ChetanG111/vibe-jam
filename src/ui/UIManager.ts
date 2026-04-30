import { CONFIG, SKY_PRESETS } from '../config';

export class UIManager {
  constructor(
    private onConfigUpdate: (key: string, value: any) => void,
    private onCameraToggle: () => void,
    private onCreateRocks: () => void,
    private onCreateCorals: () => void,
    private onWaterOpacityUpdate: (v: number) => void,
    private onFoamIntensityUpdate: (v: number) => void,
    private onSkyPresetUpdate: (v: number) => void,
    private onCloudCountUpdate: (v: number) => void
  ) {
    this.createFogPanel();
    this.createControlsHUD();
    this.createCameraToggle();
  }

  private createFogPanel() {
    const panel = document.createElement('div');
    panel.id = 'fog-panel';
    panel.innerHTML = `
      <style>
        #fog-panel {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 16px 20px;
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 13px;
          min-width: 220px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          user-select: none;
          z-index: 9999;
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(64, 176, 255, 0.5) transparent;
        }
        #fog-panel::-webkit-scrollbar { width: 6px; }
        #fog-panel::-webkit-scrollbar-thumb { background: rgba(64, 176, 255, 0.3); border-radius: 10px; }
        #fog-panel h3 { margin: 0 0 14px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
        .fog-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .fog-row label { min-width: 40px; color: rgba(255,255,255,0.8); }
        .fog-row input[type=range] { flex: 1; accent-color: #40b0ff; height: 4px; cursor: pointer; }
        .fog-row .val { min-width: 32px; text-align: right; color: #40b0ff; font-variant-numeric: tabular-nums; }
        .fog-row input[type=color] { width: 36px; height: 28px; border: none; background: none; cursor: pointer; border-radius: 6px; }
      </style>
      <h3>🌍 Sky Atmosphere</h3>
      <div class="fog-row">
        <label>Enabled</label>
        <input type="checkbox" id="cfg-sky-fog-toggle" ${CONFIG.skyFogEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #40b0ff;">
      </div>
      <div class="fog-row">
        <label>Near</label>
        <input type="range" id="fog-near" min="0" max="100" step="1" value="${CONFIG.skyFogNear}">
        <span class="val" id="fog-near-val">${CONFIG.skyFogNear}</span>
      </div>
      <div class="fog-row">
        <label>Far</label>
        <input type="range" id="fog-far" min="10" max="600" step="5" value="${CONFIG.skyFogFar}">
        <span class="val" id="fog-far-val">${CONFIG.skyFogFar}</span>
      </div>
      <div class="fog-row">
        <label>Color</label>
        <input type="color" id="fog-color" value="${SKY_PRESETS[CONFIG.skyPreset].bottom}">
        <span class="val">sky</span>
      </div>
      <div class="fog-row">
        <label>Preset</label>
        <input type="range" id="cfg-sky-preset" min="0" max="5" step="1" value="${CONFIG.skyPreset}">
        <span class="val" id="sky-preset-name">${SKY_PRESETS[CONFIG.skyPreset].name}</span>
      </div>
      <div class="fog-row">
        <label>Clouds</label>
        <input type="range" id="cfg-cloud-count" min="0" max="500" step="5" value="${CONFIG.cloudCount}">
        <span class="val" id="cloud-count-val">${CONFIG.cloudCount}</span>
      </div>
    `;
    document.body.appendChild(panel);
    
    document.getElementById('cfg-sky-fog-toggle')?.addEventListener('change', (e) => this.onConfigUpdate('skyFogEnabled', (e.target as HTMLInputElement).checked));
    document.getElementById('fog-near')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.onConfigUpdate('skyFogNear', val);
      document.getElementById('fog-near-val')!.textContent = val.toString();
    });
    document.getElementById('fog-far')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.onConfigUpdate('skyFogFar', val);
      document.getElementById('fog-far-val')!.textContent = val.toString();
    });
    document.getElementById('cfg-sky-preset')?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.onConfigUpdate('skyPreset', val);
      document.getElementById('sky-preset-name')!.textContent = SKY_PRESETS[val].name;
      this.onSkyPresetUpdate(val);
    });
    document.getElementById('cfg-cloud-count')?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.onConfigUpdate('cloudCount', val);
      document.getElementById('cloud-count-val')!.textContent = val.toString();
      this.onCloudCountUpdate(val);
    });

    const addSlider = (label: string, id: string, min: number, max: number, step: number, val: number, onChange: (v: number) => void) => {
      const row = document.createElement('div');
      row.className = 'fog-row';
      row.style.flexWrap = 'wrap';
      row.innerHTML = `
        <label style="width: 100%; margin-bottom: 4px;">${label}</label>
        <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
          <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="flex: 1;">
          <input type="number" id="${id}-num" step="${step}" value="${val}" style="width: 50px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #40b0ff; border-radius: 4px; padding: 2px 4px; font-size: 11px;">
        </div>
      `;
      panel.appendChild(row);
      const slider = document.getElementById(id) as HTMLInputElement;
      const numInput = document.getElementById(`${id}-num`) as HTMLInputElement;
      const update = (v: number, origin: 'slider' | 'num') => {
        if (origin === 'slider') numInput.value = v.toFixed(2).replace(/\.?0+$/, '');
        else if (v >= min && v <= max) slider.value = v.toString();
        onChange(v);
      };
      slider.addEventListener('input', () => update(parseFloat(slider.value), 'slider'));
      numInput.addEventListener('input', () => update(parseFloat(numInput.value) || 0, 'num'));
    };

    const hr = document.createElement('hr');
    hr.style.cssText = 'border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 16px 0;';
    panel.appendChild(hr);

    addSlider('Opacity', 'cfg-opacity', 0.1, 1, 0.01, CONFIG.waterOpacity, this.onWaterOpacityUpdate);
    addSlider('Sub Speed', 'cfg-speed', 1, 30, 0.5, CONFIG.moveSpeed, (v) => this.onConfigUpdate('moveSpeed', v));
    addSlider('Turn Spd', 'cfg-turn', 0.5, 4.0, 0.1, CONFIG.turnSpeed, (v) => this.onConfigUpdate('turnSpeed', v));
    addSlider('Prop Max', 'cfg-prop', 5, 50, 1, CONFIG.propMaxSpeed, (v) => this.onConfigUpdate('propMaxSpeed', v));
    addSlider('Wave Spd', 'cfg-w-spd', 0, 3, 0.1, CONFIG.waveSpeed, (v) => this.onConfigUpdate('waveSpeed', v));
    addSlider('Wave Hgt', 'cfg-w-hgt', 0, 5, 0.1, CONFIG.waveHeight, (v) => this.onConfigUpdate('waveHeight', v));
    addSlider('Sub Sink', 'cfg-sink', -2, 1.5, 0.05, CONFIG.subSink, (v) => this.onConfigUpdate('subSink', v));
    addSlider('Foam', 'cfg-foam', 0, 5, 0.05, CONFIG.foamIntensity, this.onFoamIntensityUpdate);
    addSlider('Cam Dist', 'cfg-cam-d', 2, 40, 0.5, CONFIG.camDist, (v) => this.onConfigUpdate('camDist', v));
    addSlider('Cam Hgt', 'cfg-cam-h', 0, 20, 0.2, CONFIG.camHeight, (v) => this.onConfigUpdate('camHeight', v));
    addSlider('Cam FOV', 'cfg-cam-f', 20, 120, 1, CONFIG.camFOV, (v) => this.onConfigUpdate('camFOV', v));

    const hr2 = hr.cloneNode() as HTMLHRElement;
    panel.appendChild(hr2);

    const wakeRow = document.createElement('div');
    wakeRow.className = 'fog-row';
    wakeRow.innerHTML = `<label>Wake</label><input type="checkbox" id="cfg-wake-toggle" ${CONFIG.wakeEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #40b0ff;">`;
    panel.appendChild(wakeRow);
    document.getElementById('cfg-wake-toggle')?.addEventListener('change', (e) => this.onConfigUpdate('wakeEnabled', (e.target as HTMLInputElement).checked));

    addSlider('Wake Size', 'cfg-wake-size', 0.05, 1.0, 0.05, CONFIG.wakeSize, (v) => this.onConfigUpdate('wakeSize', v));
    addSlider('Wake Life', 'cfg-wake-life', 0.2, 5.0, 0.1, CONFIG.wakeLifetime, (v) => this.onConfigUpdate('wakeLifetime', v));
    addSlider('Wake Spd', 'cfg-wake-spd', 0, 5, 0.1, CONFIG.wakeSpeed, (v) => this.onConfigUpdate('wakeSpeed', v));
    addSlider('Wake Sprd', 'cfg-wake-sprd', 0, 2, 0.1, CONFIG.wakeSpread, (v) => this.onConfigUpdate('wakeSpread', v));
    addSlider('Wake Hgt', 'cfg-wake-hgt-off', -1, 1, 0.05, CONFIG.wakeOffset, (v) => this.onConfigUpdate('wakeOffset', v));
    addSlider('Buoyancy', 'cfg-wake-buoy', -0.5, 1.0, 0.05, CONFIG.wakeBuoyancy, (v) => this.onConfigUpdate('wakeBuoyancy', v));
    addSlider('Wake Opac', 'cfg-wake-opac', 0, 1, 0.05, CONFIG.wakeOpacity, (v) => this.onConfigUpdate('wakeOpacity', v));

    const hr3 = hr.cloneNode() as HTMLHRElement;
    panel.appendChild(hr3);

    addSlider('Rocks', 'cfg-rocks', 0, 100, 1, CONFIG.rockCount, (v) => {
      this.onConfigUpdate('rockCount', Math.floor(v));
      this.onCreateRocks();
    });
    addSlider('Corals', 'cfg-corals', 0, 200, 1, CONFIG.coralCount, (v) => {
      this.onConfigUpdate('coralCount', Math.floor(v));
      this.onCreateCorals();
    });
    addSlider('Render Dist', 'cfg-render-dist', 1, 8, 1, CONFIG.renderDistance, (v) => this.onConfigUpdate('renderDistance', Math.floor(v)));

    const hr4 = hr.cloneNode() as HTMLHRElement;
    panel.appendChild(hr4);

    const uwHeader = document.createElement('h3');
    uwHeader.textContent = '🌊 Underwater Atmos';
    panel.appendChild(uwHeader);

    const uwToggleRow = document.createElement('div');
    uwToggleRow.className = 'fog-row';
    uwToggleRow.innerHTML = `<label>Enabled</label><input type="checkbox" id="cfg-uw-fog-toggle" ${CONFIG.uwFogEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #40b0ff;">`;
    panel.appendChild(uwToggleRow);
    document.getElementById('cfg-uw-fog-toggle')?.addEventListener('change', (e) => this.onConfigUpdate('uwFogEnabled', (e.target as HTMLInputElement).checked));

    addSlider('UW Fog Near', 'cfg-uw-near', 0, 50, 0.5, CONFIG.uwFogNear, (v) => this.onConfigUpdate('uwFogNear', v));
    addSlider('UW Fog Far', 'cfg-uw-far', 5, 300, 1, CONFIG.uwFogFar, (v) => this.onConfigUpdate('uwFogFar', v));

    const uwColorRow = document.createElement('div');
    uwColorRow.className = 'fog-row';
    uwColorRow.innerHTML = `
      <label>Fog</label><input type="color" id="cfg-uw-fog-color" value="#${CONFIG.uwFogColor.toString(16).padStart(6, '0')}">
      <label>BG</label><input type="color" id="cfg-uw-bg-color" value="#${CONFIG.uwBgColor.toString(16).padStart(6, '0')}">
    `;
    panel.appendChild(uwColorRow);
    document.getElementById('cfg-uw-fog-color')?.addEventListener('input', (e) => this.onConfigUpdate('uwFogColor', parseInt((e.target as HTMLInputElement).value.replace('#', '0x'), 16)));
    document.getElementById('cfg-uw-bg-color')?.addEventListener('input', (e) => this.onConfigUpdate('uwBgColor', parseInt((e.target as HTMLInputElement).value.replace('#', '0x'), 16)));
  }

  private createControlsHUD() {
    const hud = document.createElement('div');
    hud.id = 'controls-hud';
    hud.innerHTML = `
      <style>
        #controls-hud { position: fixed; bottom: 24px; left: 24px; background: rgba(0,0,0,0.45); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; color: #fff; font-family: 'Inter', system-ui, sans-serif; font-size: 12px; line-height: 1.8; user-select: none; z-index: 9999; pointer-events: none; }
        #controls-hud .key { display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 5px; padding: 1px 7px; font-weight: 600; font-size: 11px; margin-right: 4px; }
      </style>
      <div><span class="key">W</span> Forward &nbsp; <span class="key">S</span> Backward</div>
      <div><span class="key">A</span> Turn left &nbsp; <span class="key">D</span> Turn right</div>
    `;
    document.body.appendChild(hud);
  }

  private createCameraToggle() {
    const btn = document.createElement('button');
    btn.id = 'cam-toggle';
    btn.textContent = '🌍 Orbit View';
    const style = document.createElement('style');
    style.textContent = `
      #cam-toggle { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; padding: 8px 22px; color: #fff; font-family: 'Inter', system-ui, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; z-index: 9999; transition: background 0.2s, border-color 0.2s, transform 0.12s; user-select: none; white-space: nowrap; }
      #cam-toggle:hover { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.4); }
      #cam-toggle:active { transform: translateX(-50%) scale(0.95); }
      #cam-toggle.orbit-active { background: rgba(64, 176, 255, 0.25); border-color: rgba(64, 176, 255, 0.6); color: #a8dfff; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(btn);
    btn.addEventListener('click', () => {
      this.onCameraToggle();
      if (btn.classList.contains('orbit-active')) {
        btn.textContent = '🌍 Orbit View';
        btn.classList.remove('orbit-active');
      } else {
        btn.textContent = '🚢 Follow Cam';
        btn.classList.add('orbit-active');
      }
    });
  }
}
