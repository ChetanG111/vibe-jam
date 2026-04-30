import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

class VibeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private submarine!: THREE.Group;
  private water!: THREE.Mesh;
  private clouds: THREE.Group[] = [];
  private waterVertices!: Float32Array;
  private waterOrigY!: Float32Array;
  private clock = new THREE.Clock();
  private skyColor = 0x55ccff;

  // --- Camera & controls ---
  private controls!: OrbitControls;
  private cameraMode: 'follow' | 'orbit' = 'follow';
  private snapCamera = false; // when true, instantly position camera (no lerp)

  // --- Player input & submarine state ---
  private keys = new Set<string>();
  private submarineHeading = 0;   // Y-axis rotation in radians
  private lastElapsed = 0;        // for delta-time computation

  constructor() {
    // 1. Basic Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.skyColor);

    // Horizon fog matches sky
    this.scene.fog = new THREE.Fog(this.skyColor, 20, 100);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(20, 10, 25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    // OrbitControls (disabled by default — only active in orbit mode)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.enabled = false;

    // WASD key tracking — only preventDefault for movement keys
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // 2. Lighting
    this.setupLighting();

    // 3. Environment
    this.createWater();
    this.createIslands();
    this.createRocks();
    this.createClouds();

    // 4. Submarine (Code-based model)
    this.submarine = this.createCartoonSubmarine();
    this.scene.add(this.submarine);

    // 5. UI Controls
    this.createFogPanel();
    this.createControlsHUD();
    this.createCameraToggle();

    // 6. Run
    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xfffbe8, 1.5);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    this.scene.add(sun);

    // Sky hemisphere: blue sky above, deep blue below
    const hemi = new THREE.HemisphereLight(0x88ddff, 0x0066cc, 0.6);
    this.scene.add(hemi);
  }

  private createWater() {
    // Low-poly water: subdivided plane with vertex displacement for faceted look
    const segments = 80;
    const size = 300;
    const waterGeo = new THREE.PlaneGeometry(size, size, segments, segments);

    // Displace Y (Z before rotation) vertices randomly for low-poly faceted look
    const pos = waterGeo.attributes.position;
    const waveAmplitude = 0.45;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i); // before rotation, Y is the second planar axis
      // Layered sine waves for organic low-poly water
      const wave =
        Math.sin(x * 0.18 + 0.5) * waveAmplitude * 0.6 +
        Math.sin(z * 0.22 + 1.2) * waveAmplitude * 0.5 +
        Math.sin((x + z) * 0.12) * waveAmplitude * 0.4 +
        (Math.random() - 0.5) * waveAmplitude * 0.9;
      pos.setZ(i, wave);
    }

    // Store original positions for animation
    waterGeo.computeVertexNormals();
    this.waterVertices = new Float32Array(pos.array);
    this.waterOrigY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this.waterOrigY[i] = pos.getZ(i);
    }

    // Bright cyan-blue flat-shaded material matching the reference
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x14b8e0,       // bright tropical cyan-blue
      roughness: 0.35,
      metalness: 0.15,
      flatShading: true,     // KEY: flat shading gives the low-poly polygon facet look
    });

    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
  }

  private createCartoonSubmarine() {
    const sub = new THREE.Group();
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.3, flatShading: false });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x00ccff, metalness: 0.9, roughness: 0.1 });

    // Main Body (Capsule)
    const bodyGeo = new THREE.CapsuleGeometry(0.8, 1.8, 8, 24);
    const body = new THREE.Mesh(bodyGeo, yellowMat);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    sub.add(body);

    // Turret (Cylinder)
    const turretGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.8, 16);
    const turret = new THREE.Mesh(turretGeo, yellowMat);
    turret.position.y = 0.8;
    turret.position.x = 0.2;
    turret.castShadow = true;
    sub.add(turret);

    // Periscope
    const pScopeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
    const pScope = new THREE.Mesh(pScopeGeo, darkMat);
    pScope.position.set(0.2, 1.4, 0);
    sub.add(pScope);

    const pScopeLensGeo = new THREE.BoxGeometry(0.15, 0.1, 0.25);
    const pScopeLens = new THREE.Mesh(pScopeLensGeo, darkMat);
    pScopeLens.position.set(0.25, 1.7, 0);
    sub.add(pScopeLens);

    // Portholes (3 circles)
    for (let i = 0; i < 3; i++) {
      const portGeo = new THREE.CircleGeometry(0.2, 16);
      const port = new THREE.Mesh(portGeo, blueMat);
      port.position.set(-0.6 + i * 0.7, 0, 0.81);
      sub.add(port);
    }

    // Propeller base
    const propBaseGeo = new THREE.CylinderGeometry(0.15, 0.3, 0.4, 8);
    const propBase = new THREE.Mesh(propBaseGeo, yellowMat);
    propBase.position.x = -1.8;
    propBase.rotation.z = Math.PI / 2;
    sub.add(propBase);

    // Propeller Blades
    const bladeGeo = new THREE.BoxGeometry(0.05, 0.8, 0.2);
    const blade1 = new THREE.Mesh(bladeGeo, darkMat);
    const blade2 = new THREE.Mesh(bladeGeo, darkMat);
    blade2.rotation.x = Math.PI / 2;

    const prop = new THREE.Group();
    prop.add(blade1, blade2);
    prop.position.x = -2;
    sub.add(prop);

    // Tail Fins
    const finGeo = new THREE.BoxGeometry(0.4, 0.05, 1.2);
    const fin = new THREE.Mesh(finGeo, yellowMat);
    fin.position.x = -1.5;
    sub.add(fin);

    // Propeller spin — only child animation we keep via GSAP
    gsap.to(prop.rotation, { x: Math.PI * 2, duration: 1, repeat: -1, ease: 'none' });

    // All other sub rotation/position is driven manually in animate()
    sub.position.y = 0.7;
    return sub;
  }

  /**
   * Returns the animated water surface height at world (x, z) using the
   * same analytical formula that drives the vertex animation in animate().
   * The random per-vertex base offsets average near zero so we skip them
   * for a clean, continuous sample.
   */
  private getWaterHeight(worldX: number, worldZ: number): number {
    const t = this.clock.getElapsedTime();
    return (
      Math.sin(worldX * 0.2 + t * 0.6) * 0.18 +
      Math.sin(worldZ * 0.25 + t * 0.45) * 0.14 +
      Math.sin((worldX + worldZ) * 0.15 + t * 0.5) * 0.1
    );
  }

  private createIslands() {
    this.addIsland(-18, -0.2, -12, 7, 0x996633);
    this.addIsland(15, -0.2, -8, 5, 0x996633);
    this.addIsland(-45, -0.5, -40, 10, 0x777777);
    this.addIsland(40, -0.5, -35, 4, 0x777777);
  }

  /** Scattered small to medium rocks in the water */
  private createRocks() {
    const rockDefs: Array<{ x: number; z: number; scale: number }> = [
      // Close foreground rocks
      { x: -8,  z: 5,   scale: 1.0 },
      { x: 12,  z: 8,   scale: 0.7 },
      { x: 6,   z: -5,  scale: 0.9 },
      { x: -4,  z: -8,  scale: 1.2 },
      { x: 22,  z: 2,   scale: 0.8 },
      { x: -15, z: 3,   scale: 0.6 },
      // Mid-range rocks
      { x: 8,   z: -18, scale: 1.5 },
      { x: -22, z: -5,  scale: 1.1 },
      { x: 30,  z: -10, scale: 1.3 },
      { x: -30, z: 5,   scale: 0.9 },
      { x: 18,  z: 12,  scale: 0.7 },
      { x: -10, z: 15,  scale: 1.0 },
      // Distant background rocks
      { x: 5,   z: -30, scale: 2.0 },
      { x: -35, z: -20, scale: 1.8 },
      { x: 45,  z: -15, scale: 1.5 },
      { x: -50, z: 10,  scale: 2.2 },
      { x: 35,  z: 20,  scale: 1.2 },
    ];

    const rockColors = [0x888888, 0x999999, 0x777777, 0xaaaaaa, 0x666666];

    for (const def of rockDefs) {
      const group = new THREE.Group();
      group.position.set(def.x, -0.3, def.z);

      const color = rockColors[Math.floor(Math.random() * rockColors.length)];
      const rockMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });

      // Main rock mass
      const mainGeo = new THREE.IcosahedronGeometry(def.scale, 1);
      const main = new THREE.Mesh(mainGeo, rockMat);
      main.scale.y = 0.55 + Math.random() * 0.2;
      main.rotation.y = Math.random() * Math.PI;
      main.castShadow = true;
      main.receiveShadow = true;
      group.add(main);

      // Small companion rock ~50% of the time
      if (Math.random() > 0.5) {
        const smallGeo = new THREE.IcosahedronGeometry(def.scale * 0.45, 1);
        const small = new THREE.Mesh(smallGeo, rockMat);
        const angle = Math.random() * Math.PI * 2;
        small.position.set(Math.cos(angle) * def.scale * 0.9, -0.1, Math.sin(angle) * def.scale * 0.5);
        small.scale.y = 0.5;
        small.castShadow = true;
        group.add(small);
      }

      // Tiny white foam ring at the waterline
      const foamGeo = new THREE.TorusGeometry(def.scale * 1.1, 0.12, 6, 18);
      const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
      const foam = new THREE.Mesh(foamGeo, foamMat);
      foam.rotation.x = Math.PI / 2;
      foam.position.y = 0.05;
      group.add(foam);

      this.scene.add(group);
    }
  }

  private addIsland(x: number, y: number, z: number, scale: number, color: number) {
    const islandGroup = new THREE.Group();
    islandGroup.position.set(x, y, z);

    const rockGeo = new THREE.IcosahedronGeometry(scale, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.y = 0.6;
    rock.castShadow = true;
    rock.receiveShadow = true;
    islandGroup.add(rock);

    if (color !== 0x777777) {
      const grassGeo = new THREE.IcosahedronGeometry(scale * 0.9, 1);
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x55aa00, roughness: 1, flatShading: true });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.position.y = scale * 0.25;
      grass.scale.y = 0.3;
      grass.castShadow = true;
      grass.receiveShadow = true;
      islandGroup.add(grass);

      const treeCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < treeCount; i++) {
        const tree = this.createPalmTree();
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (scale * 0.6);
        tree.position.set(Math.cos(angle) * dist, scale * 0.3, Math.sin(angle) * dist);
        tree.rotation.y = Math.random() * Math.PI;
        tree.scale.setScalar(0.7 + Math.random() * 0.3);
        islandGroup.add(tree);
      }

      const sandGeo = new THREE.TorusGeometry(scale * 1.05, 0.2, 8, 32);
      const sandMat = new THREE.MeshStandardMaterial({ color: 0xeeddaa, flatShading: true });
      const sand = new THREE.Mesh(sandGeo, sandMat);
      sand.rotation.x = Math.PI / 2;
      sand.position.y = 0.1;
      islandGroup.add(sand);
    }

    this.scene.add(islandGroup);
  }

  private createPalmTree() {
    const tree = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x664422 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    tree.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228822, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const leafGeo = new THREE.SphereGeometry(0.8, 4, 4);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(1.5, 0.1, 0.5);
      leaf.position.y = 3;
      leaf.rotation.y = (i * Math.PI * 2) / 5;
      leaf.rotation.z = 0.4;
      leaf.position.x = Math.sin(leaf.rotation.y) * 0.6;
      leaf.position.z = Math.cos(leaf.rotation.y) * 0.6;
      leaf.castShadow = true;
      tree.add(leaf);
    }
    return tree;
  }

  private createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    });

    // Many more clouds, spread across different heights and distances
    const cloudCount = 55;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const blobCount = 3 + Math.floor(Math.random() * 5);

      for (let j = 0; j < blobCount; j++) {
        const blobGeo = new THREE.SphereGeometry(1.5 + Math.random() * 1.2, 7, 7);
        const blob = new THREE.Mesh(blobGeo, cloudMat);
        blob.scale.set(1.2 + Math.random() * 0.8, 0.7 + Math.random() * 0.4, 1.1 + Math.random() * 0.5);
        blob.position.set(
          j * (1.8 + Math.random() * 0.8) - blobCount * 0.9,
          (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.8,
        );
        cloud.add(blob);
      }

      // Mix of near-horizon clouds and higher clouds
      const isLow = i < cloudCount * 0.4; // 40% near the horizon
      const yPos = isLow
        ? 8 + Math.random() * 6      // lower, near horizon
        : 18 + Math.random() * 14;   // higher up

      cloud.position.set(
        (Math.random() - 0.5) * 220,
        yPos,
        (Math.random() - 0.5) * 180,
      );
      cloud.scale.setScalar(0.6 + Math.random() * 0.9);

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private createFogPanel() {
    const fog = this.scene.fog as THREE.Fog;

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
        }
        #fog-panel h3 {
          margin: 0 0 14px;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
        }
        .fog-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .fog-row label {
          min-width: 40px;
          color: rgba(255,255,255,0.8);
        }
        .fog-row input[type=range] {
          flex: 1;
          accent-color: #40b0ff;
          height: 4px;
          cursor: pointer;
        }
        .fog-row .val {
          min-width: 32px;
          text-align: right;
          color: #40b0ff;
          font-variant-numeric: tabular-nums;
        }
        .fog-row input[type=color] {
          width: 36px;
          height: 28px;
          border: none;
          background: none;
          cursor: pointer;
          border-radius: 6px;
        }
      </style>
      <h3>🌫 Fog</h3>
      <div class="fog-row">
        <label>Near</label>
        <input type="range" id="fog-near" min="0" max="100" step="1" value="${fog.near}">
        <span class="val" id="fog-near-val">${fog.near}</span>
      </div>
      <div class="fog-row">
        <label>Far</label>
        <input type="range" id="fog-far" min="10" max="400" step="5" value="${fog.far}">
        <span class="val" id="fog-far-val">${fog.far}</span>
      </div>
      <div class="fog-row">
        <label>Color</label>
        <input type="color" id="fog-color" value="#40b0ff">
        <span class="val">sky</span>
      </div>
    `;
    document.body.appendChild(panel);

    // Near slider
    const nearSlider = document.getElementById('fog-near') as HTMLInputElement;
    const nearVal = document.getElementById('fog-near-val')!;
    nearSlider.addEventListener('input', () => {
      fog.near = parseFloat(nearSlider.value);
      nearVal.textContent = nearSlider.value;
    });

    // Far slider
    const farSlider = document.getElementById('fog-far') as HTMLInputElement;
    const farVal = document.getElementById('fog-far-val')!;
    farSlider.addEventListener('input', () => {
      fog.far = parseFloat(farSlider.value);
      farVal.textContent = farSlider.value;
    });

    // Color picker
    const colorPicker = document.getElementById('fog-color') as HTMLInputElement;
    colorPicker.addEventListener('input', () => {
      const c = new THREE.Color(colorPicker.value);
      fog.color.set(c);
      this.scene.background = c;
    });
  }

  /** Move & rotate the submarine based on currently held keys. */
  private processInput(dt: number) {
    const MOVE_SPEED = 8;   // units per second
    const TURN_SPEED = 1.8; // radians per second

    if (this.keys.has('KeyA')) this.submarineHeading += TURN_SPEED * dt;
    if (this.keys.has('KeyD')) this.submarineHeading -= TURN_SPEED * dt;

    // Sub's local forward axis is +X.
    // After a Y-rotation by heading angle h:
    //   world forward = (cos h, 0, -sin h)
    const fwdX = Math.cos(this.submarineHeading);
    const fwdZ = -Math.sin(this.submarineHeading);

    if (this.keys.has('KeyW')) {
      this.submarine.position.x += fwdX * MOVE_SPEED * dt;
      this.submarine.position.z += fwdZ * MOVE_SPEED * dt;
    }
    if (this.keys.has('KeyS')) {
      this.submarine.position.x -= fwdX * MOVE_SPEED * dt;
      this.submarine.position.z -= fwdZ * MOVE_SPEED * dt;
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    const t = this.clock.getElapsedTime();
    const dt = Math.min(t - this.lastElapsed, 0.05);
    this.lastElapsed = t;

    // --- Input (WASD always active regardless of camera mode) ---
    this.processInput(dt);

    // --- Submarine orientation ---
    this.submarine.rotation.y = this.submarineHeading;
    this.submarine.rotation.z = Math.sin(t * 0.8) * 0.04;

    let targetPitch = Math.sin(t * 0.6) * 0.02;
    if (this.keys.has('KeyW')) targetPitch -= 0.06;
    if (this.keys.has('KeyS')) targetPitch += 0.04;
    this.submarine.rotation.x += (targetPitch - this.submarine.rotation.x) * 0.12;

    // --- Water animation ---
    const pos = this.water.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = this.waterVertices[i * 3];
      const z = this.waterVertices[i * 3 + 1];
      const base = this.waterOrigY[i];
      const newZ =
        base +
        Math.sin(x * 0.2 + t * 0.6) * 0.18 +
        Math.sin(z * 0.25 + t * 0.45) * 0.14 +
        Math.sin((x + z) * 0.15 + t * 0.5) * 0.1;
      pos.setZ(i, newZ);
    }
    pos.needsUpdate = true;
    this.water.geometry.computeVertexNormals();

    // --- Lock submarine to water surface ---
    const surfaceY = this.getWaterHeight(
      this.submarine.position.x,
      this.submarine.position.z,
    );
    this.submarine.position.y = surfaceY + 0.69;

    // --- Camera ---
    if (this.cameraMode === 'orbit') {
      // OrbitControls takes over — just let it update
      this.controls.update();
    } else {
      // Third-person follow camera
      const fwdX = Math.cos(this.submarineHeading);
      const fwdZ = -Math.sin(this.submarineHeading);

      const targetCamX = this.submarine.position.x - fwdX * 12;
      const targetCamY = this.submarine.position.y + 5;
      const targetCamZ = this.submarine.position.z - fwdZ * 12;

      // snapCamera = true means instant repositioning (used right after mode switch)
      const lerp = this.snapCamera ? 1.0 : 0.06;
      this.snapCamera = false;

      this.camera.position.x += (targetCamX - this.camera.position.x) * lerp;
      this.camera.position.y += (targetCamY - this.camera.position.y) * lerp;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * lerp;

      this.camera.lookAt(
        this.submarine.position.x + fwdX * 3,
        this.submarine.position.y + 0.8,
        this.submarine.position.z + fwdZ * 3,
      );
    }

    // --- Drift clouds ---
    this.clouds.forEach((cloud, index) => {
      cloud.position.x += 0.008 * (1 + (index % 3) * 0.4);
      if (cloud.position.x > 110) cloud.position.x = -110;
    });

    this.renderer.render(this.scene, this.camera);
  }

  /** Tiny WASD hint overlay in the bottom-left corner. */
  private createControlsHUD() {
    const hud = document.createElement('div');
    hud.id = 'controls-hud';
    hud.innerHTML = `
      <style>
        #controls-hud {
          position: fixed;
          bottom: 24px;
          left: 24px;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 12px 16px;
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 12px;
          line-height: 1.8;
          user-select: none;
          z-index: 9999;
          pointer-events: none;
        }
        #controls-hud .key {
          display: inline-block;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 5px;
          padding: 1px 7px;
          font-weight: 600;
          font-size: 11px;
          margin-right: 4px;
        }
      </style>
      <div><span class="key">W</span> Forward &nbsp; <span class="key">S</span> Backward</div>
      <div><span class="key">A</span> Turn left &nbsp; <span class="key">D</span> Turn right</div>
    `;
    document.body.appendChild(hud);
  }

  /** Camera mode toggle button — top-center of screen. */
  private createCameraToggle() {
    const btn = document.createElement('button');
    btn.id = 'cam-toggle';
    btn.textContent = '🌍 Orbit View';

    const style = document.createElement('style');
    style.textContent = `
      #cam-toggle {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 999px;
        padding: 8px 22px;
        color: #fff;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.04em;
        cursor: pointer;
        z-index: 9999;
        transition: background 0.2s, border-color 0.2s, transform 0.12s;
        user-select: none;
        white-space: nowrap;
      }
      #cam-toggle:hover {
        background: rgba(255,255,255,0.18);
        border-color: rgba(255,255,255,0.4);
      }
      #cam-toggle:active {
        transform: translateX(-50%) scale(0.95);
      }
      #cam-toggle.orbit-active {
        background: rgba(64, 176, 255, 0.25);
        border-color: rgba(64, 176, 255, 0.6);
        color: #a8dfff;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      if (this.cameraMode === 'follow') {
        // Switch to orbit
        this.cameraMode = 'orbit';
        this.controls.enabled = true;
        // Point orbit target at the submarine so it orbits around it
        this.controls.target.set(
          this.submarine.position.x,
          this.submarine.position.y,
          this.submarine.position.z,
        );
        this.controls.update();
        btn.textContent = '🚢 Follow Cam';
        btn.classList.add('orbit-active');
      } else {
        // Switch back to follow — snap camera instantly to behind-sub position
        this.cameraMode = 'follow';
        this.controls.enabled = false;
        this.snapCamera = true;
        btn.textContent = '🌍 Orbit View';
        btn.classList.remove('orbit-active');
      }
    });
  }
}

new VibeScene();
