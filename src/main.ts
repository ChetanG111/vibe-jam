import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class VibeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private submarine!: THREE.Group;
  private water!: THREE.Mesh;
  private clouds: THREE.Group[] = [];
  private depthTarget!: THREE.WebGLRenderTarget;
  private depthMaterial!: THREE.MeshDepthMaterial;
  private sun!: THREE.DirectionalLight;
  private propeller!: THREE.Group;
  private sunRays: THREE.Group = new THREE.Group();
  private currentPropSpeed = 0;
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

  // --- Live Configurable Parameters ---
  private config = {
    moveSpeed: 8,
    turnSpeed: 1.8,
    propMaxSpeed: 22,
    waveSpeed: 1.0,
    waveHeight: 1.0,
    waterOpacity: 0.85,
    subSink: -0.1, // New default for better water contact
    foamIntensity: 2.0,
    camDist: 12,
    camHeight: 5,
    camFOV: 50,
    // Wake Particles
    wakeEnabled: true,
    wakeCount: 500,
    wakeSize: 0.3,
    wakeLifetime: 0.7,
    wakeSpeed: 1.2,
    wakeSpread: 0.6,
    wakeBuoyancy: -0.1,
    wakeOpacity: 0.6,
    wakeOffset: 0.45,
    floorDepth: -32, // Lowered slightly for deeper feel
    rockCount: 20,
    coralCount: 75,
    // Sky Atmosphere
    skyFogEnabled: true,
    skyFogNear: 30,
    skyFogFar: 350,
    // Underwater Atmosphere
    uwFogEnabled: true,
    uwFogColor: 0x004466,
    uwFogNear: 2,
    uwFogFar: 80,
    uwBgColor: 0x002233,
  };

  // --- Particles state ---
  private wakeMesh!: THREE.InstancedMesh;
  private wakeData: Array<{
    active: boolean;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
    scale: number;
  }> = [];
  private floorMesh!: THREE.Mesh;
  private rockGroup: THREE.Group = new THREE.Group();
  private coralGroup: THREE.Group = new THREE.Group();
  private nextWakeIndex = 0;
  private spawnAccumulator = 0;
  private raycaster = new THREE.Raycaster();

  constructor() {
    // 1. Basic Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.skyColor);

    // Horizon fog matches sky - increased distance for larger world
    this.scene.fog = new THREE.Fog(this.skyColor, 30, 350);

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
    this.createOceanFloor();
    
    this.scene.add(this.coralGroup);
    this.scene.add(this.rockGroup);
    
    this.createCorals();
    this.createRocks();
    this.createClouds();

    // 4. Submarine (Code-based model)
    this.submarine = this.createCartoonSubmarine();
    this.scene.add(this.submarine);
    
    // 5. Sun Rays
    this.createSunRays();
    this.scene.add(this.sunRays);
    
    // 6. Wake Particles
    this.createWakeParticles();
    
    // 6. UI Controls
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

    this.sun = new THREE.DirectionalLight(0xfffbe8, 1.5);
    this.sun.position.set(30, 50, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.scene.add(this.sun);

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
      const wave =
        Math.sin(x * 0.18 + 0.5) * waveAmplitude * 0.6 +
        Math.sin(z * 0.22 + 1.2) * waveAmplitude * 0.5 +
        Math.sin((x + z) * 0.12) * waveAmplitude * 0.4 +
        (Math.random() - 0.5) * waveAmplitude * 0.9;
      pos.setZ(i, wave);
    }

    // Store original positions for animation
    this.waterVertices = new Float32Array(pos.array);
    this.waterOrigY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this.waterOrigY[i] = pos.getZ(i);
    }

    // --- Depth render target for foam ---
    const dpr = this.renderer.getPixelRatio();
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    
    this.depthTarget = new THREE.WebGLRenderTarget(w, h);
    this.depthTarget.depthTexture = new THREE.DepthTexture(w, h);
    this.depthTarget.depthTexture.format = THREE.DepthFormat;
    this.depthTarget.depthTexture.type = THREE.UnsignedIntType;
    
    // Dedicated depth material for the first pass (performance boost)
    this.depthMaterial = new THREE.MeshDepthMaterial();

    // --- Custom ShaderMaterial with depth-based foam ---
    const waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime:       { value: 0 },
        uDepthTex:   { value: this.depthTarget.depthTexture },
        uResolution: { value: new THREE.Vector2(w, h) },
        uCameraNear: { value: this.camera.near },
        uCameraFar:  { value: this.camera.far },
        uWaterColor: { value: new THREE.Color(0x14b8e0) },
        uFoamColor:  { value: new THREE.Color(0xffffff) },
        uSunDir:     { value: new THREE.Vector3().copy(this.sun.position).normalize() },
        uOpacity:    { value: this.config.waterOpacity },
        uFoamStrength: { value: this.config.foamIntensity },
        fogColor:    { value: (this.scene.fog as THREE.Fog).color },
        fogNear:     { value: (this.scene.fog as THREE.Fog).near },
        fogFar:      { value: (this.scene.fog as THREE.Fog).far },
      },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying float vViewZ;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vec4 mvPos = viewMatrix * worldPos;
          vViewZ = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uDepthTex;
        uniform vec2 uResolution;
        uniform float uCameraNear;
        uniform float uCameraFar;
        uniform vec3 uWaterColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSunDir;
        uniform float uOpacity;
        uniform float uFoamStrength;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;

        varying vec3 vWorldPos;
        varying float vViewZ;

        float linearizeDepth(float d) {
          float z = 2.0 * d - 1.0;
          return (2.0 * uCameraNear * uCameraFar) /
                 (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
        }

        void main() {
          // Flat-shading: derive face normal from screen-space derivatives
          vec3 fdx = dFdx(vWorldPos);
          vec3 fdy = dFdy(vWorldPos);
          vec3 normal = normalize(cross(fdx, fdy));
          if (normal.y < 0.0) normal = -normal;

          // Simple directional + ambient lighting
          float NdotL = max(dot(normal, uSunDir), 0.0);
          float light = 0.45 + NdotL * 0.55;
          vec3 baseColor = uWaterColor * light;

          // --- Depth-based foam ---
          vec2 screenUV = gl_FragCoord.xy / uResolution;
          float sceneDepth = linearizeDepth(texture2D(uDepthTex, screenUV).r);
          float depthDiff = sceneDepth - vViewZ;

          // Outer foam: fades over ~2 world-units from intersection
          float outerFoam = 1.0 - smoothstep(0.0, 2.0, depthDiff);
          // Animated ripple pattern
          float wave1 = sin(vWorldPos.x * 4.0 + uTime * 1.5) * 0.5 + 0.5;
          float wave2 = sin(vWorldPos.z * 3.5 - uTime * 1.2) * 0.5 + 0.5;
          float wave3 = sin((vWorldPos.x + vWorldPos.z) * 2.5 + uTime * 2.0) * 0.5 + 0.5;
          float pattern = wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25;

          // Inner foam (very close, solid white edge)
          float innerFoam = 1.0 - smoothstep(0.0, 0.6, depthDiff);
 
          float foam = max(innerFoam * uFoamStrength, outerFoam * pattern * (uFoamStrength - 0.15));
          foam = clamp(foam, 0.0, 1.0);
 
          vec3 color = mix(baseColor, uFoamColor, foam);
 
          // --- Fog ---
          float fogFactor = smoothstep(fogNear, fogFar, vViewZ);
          color = mix(color, fogColor, fogFactor);
 
          gl_FragColor = vec4(color, uOpacity);
        }
      `,
    });

    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);
  }

  private createCartoonSubmarine() {
    const sub = new THREE.Group();
    // Use flatShading: true to match the faceted low-poly look of the reference
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, flatShading: true });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1a5fff, metalness: 0.8, roughness: 0.2, flatShading: true });

    // Main Body: Lower segment count for distinct "poly-ness"
    const bodyGeo = new THREE.CapsuleGeometry(0.8, 1.8, 4, 12);
    const body = new THREE.Mesh(bodyGeo, yellowMat);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    sub.add(body);

    // Turret
    const turretGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.8, 8);
    const turret = new THREE.Mesh(turretGeo, yellowMat);
    turret.position.y = 0.8;
    turret.position.x = 0.2;
    turret.castShadow = true;
    sub.add(turret);

    // Periscope
    const pScopeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
    const pScope = new THREE.Mesh(pScopeGeo, darkMat);
    pScope.position.set(0.2, 1.4, 0);
    sub.add(pScope);

    const pScopeLensGeo = new THREE.BoxGeometry(0.15, 0.1, 0.25);
    const pScopeLens = new THREE.Mesh(pScopeLensGeo, darkMat);
    pScopeLens.position.set(0.25, 1.7, 0);
    sub.add(pScopeLens);

    // Faceted Portholes with dark borders (both sides)
    [0.78, -0.78].forEach(zPos => {
      for (let i = 0; i < 3; i++) {
        const portGroup = new THREE.Group();
        portGroup.position.set(-0.6 + i * 0.7, 0, zPos);
        
        // Border/Frame
        const frameGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8);
        const frame = new THREE.Mesh(frameGeo, darkMat);
        frame.rotation.x = Math.PI / 2;
        portGroup.add(frame);

        // Glass (faceted cylinder)
        const glassGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8);
        const glass = new THREE.Mesh(glassGeo, blueMat);
        glass.rotation.x = Math.PI / 2;
        portGroup.add(glass);

        sub.add(portGroup);
      }
    });

    // Propeller base
    const propBaseGeo = new THREE.CylinderGeometry(0.15, 0.3, 0.4, 6);
    const propBase = new THREE.Mesh(propBaseGeo, yellowMat);
    propBase.position.x = -1.8;
    propBase.rotation.z = Math.PI / 2;
    sub.add(propBase);

    // Propeller Blades
    const bladeGeo = new THREE.BoxGeometry(0.05, 0.8, 0.2);
    const blade1 = new THREE.Mesh(bladeGeo, darkMat);
    const blade2 = new THREE.Mesh(bladeGeo, darkMat);
    blade2.rotation.x = Math.PI / 2;

    this.propeller = new THREE.Group();
    this.propeller.add(blade1, blade2);
    this.propeller.position.x = -2;
    sub.add(this.propeller);

    // Tail Fins
    const finGeo = new THREE.BoxGeometry(0.4, 0.05, 1.2);
    const fin = new THREE.Mesh(finGeo, yellowMat);
    fin.position.x = -1.5;
    sub.add(fin);

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
      Math.sin(worldX * 0.2 + t * 0.6 * this.config.waveSpeed) * 0.18 * this.config.waveHeight +
      Math.sin(worldZ * 0.25 + t * 0.45 * this.config.waveSpeed) * 0.14 * this.config.waveHeight +
      Math.sin((worldX + worldZ) * 0.15 + t * 0.5 * this.config.waveSpeed) * 0.1 * this.config.waveHeight
    );
  }

  /** Returns the floor height at world (x, z) */
  private getFloorHeight(x: number, z: number): number {
    const noise = 
      Math.sin(x * 0.05) * 2.5 + 
      Math.sin(z * 0.04) * 2.2 + 
      Math.sin((x + z) * 0.25) * 0.8; // High frequency "crunch"
    return this.config.floorDepth + noise;
  }

  /**
   * Samples the actual floor mesh using raycasting.
   * This is much more accurate than the mathematical height function
   * because it accounts for the flat triangle surfaces of the low-poly mesh.
   */
  private getFloorData(x: number, z: number): { y: number; normal: THREE.Vector3 } | null {
    if (!this.floorMesh) return null;
    
    // Raycast from well above the floor down towards it
    this.raycaster.set(
      new THREE.Vector3(x, 20, z), 
      new THREE.Vector3(0, -1, 0)
    );
    
    // Ensure the matrix is up to date for accurate intersection
    this.floorMesh.updateMatrixWorld();
    const intersects = this.raycaster.intersectObject(this.floorMesh);
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      // Get the face normal and transform it to world space
      const normal = hit.face!.normal.clone();
      normal.applyQuaternion(this.floorMesh.quaternion);
      
      return { y: hit.point.y, normal };
    }
    
    return null;
  }

  private createIslands() {
    // Making islands significantly larger (3x-5x) and spreading them out
    this.addIsland(-40, -0.5, -30, 22, 0x996633); // Main tropical island
    this.addIsland(50, -0.5, -20, 18, 0x996633);  // Smaller tropical island
    this.addIsland(-80, -1.0, -90, 35, 0x777777); // Huge rocky island
    this.addIsland(90, -1.0, -70, 25, 0x777777);  // Distant rock massif
  }

  /** Scattered small to medium rocks in the water */
  private createRocks() {
    // Clear existing rocks
    while(this.rockGroup.children.length > 0) {
      const obj = this.rockGroup.children[0];
      this.rockGroup.remove(obj);
    }

    const rockColors = [0x888888, 0x999999, 0x777777, 0xaaaaaa, 0x666666];

    for (let i = 0; i < this.config.rockCount; i++) {
      const x = (Math.random() - 0.5) * 350;
      const z = (Math.random() - 0.5) * 350;
      const scale = 0.6 + Math.random() * 1.6;

      const surface = this.getFloorData(x, z);
      if (!surface) continue;

      const group = new THREE.Group();
      // Position rocks accurately on the mesh surface
      group.position.set(x, surface.y - 0.05, z); // Minimal sink for contact
      
      // Align to the actual face normal of the mesh
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
      group.rotateY(Math.random() * Math.PI * 2); // Random spin around local UP

      const color = rockColors[Math.floor(Math.random() * rockColors.length)];
      const rockMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });

      // Main rock mass
      const mainGeo = new THREE.IcosahedronGeometry(scale, 1);
      const main = new THREE.Mesh(mainGeo, rockMat);
      
      // Pivot correction: raise the mesh so its bottom is roughly at the group's pivot
      const yScale = 0.55 + Math.random() * 0.2;
      main.scale.set(1, yScale, 1);
      main.position.y = scale * yScale * 0.7; // Pull up to stay above ground
      
      main.rotation.y = Math.random() * Math.PI;
      main.castShadow = true;
      main.receiveShadow = true;
      group.add(main);

      // Small companion rock ~50% of the time
      if (Math.random() > 0.5) {
        const smallScale = scale * 0.45;
        const smallGeo = new THREE.IcosahedronGeometry(smallScale, 1);
        const small = new THREE.Mesh(smallGeo, rockMat);
        const angle = Math.random() * Math.PI * 2;
        
        small.position.set(Math.cos(angle) * scale * 0.9, smallScale * 0.4, Math.sin(angle) * scale * 0.5);
        small.scale.y = 0.5;
        small.castShadow = true;
        group.add(small);
      }

      this.rockGroup.add(group);
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

    // Underwater base extending well below the ocean floor to handle undulations
    const floorY = this.config.floorDepth;
    const islandTopY = y;
    const baseHeight = Math.abs(islandTopY - (floorY - 15)); // Extra depth
    
    // Tapered cylinder for a more natural volcanic/island base look
    const baseGeo = new THREE.CylinderGeometry(scale * 0.8, scale * 1.5, baseHeight, 10);
    const base = new THREE.Mesh(baseGeo, rockMat);
    // Position base so its top meets the island rock and it goes deep enough
    base.position.y = -baseHeight / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    islandGroup.add(base);

    if (color !== 0x777777) {
      const grassGeo = new THREE.IcosahedronGeometry(scale * 0.95, 1);
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x55aa00, roughness: 1, flatShading: true });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.position.y = scale * 0.4;
      grass.scale.y = 0.25;
      grass.castShadow = true;
      grass.receiveShadow = true;
      islandGroup.add(grass);

      // Tree count scales with island size
      const treeCount = Math.floor(scale * 0.8);
      for (let i = 0; i < treeCount; i++) {
        const tree = this.createPalmTree();
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (scale * 0.75);
        
        // Calculate height on the ellipsoid surface for better placement
        const normDist = dist / scale;
        const surfaceHeight = Math.sqrt(Math.max(0, 1 - normDist * normDist)) * scale * 0.6;
        
        tree.position.set(Math.cos(angle) * dist, surfaceHeight, Math.sin(angle) * dist);
        tree.rotation.y = Math.random() * Math.PI;
        tree.scale.setScalar(0.8 + Math.random() * 0.5);
        islandGroup.add(tree);
      }

      // (foam is now generated by the water's depth-based shader)
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

  private createOceanFloor() {
    const segments = 120; // Increased resolution to better match artifact positioning
    const size = 600; // Large floor
    const floorGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Displace vertices for low-poly terrain look
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i); // Plane Y is world Z after rotation
      pos.setZ(i, this.getFloorHeight(x, z) - this.config.floorDepth);
    }
    floorGeo.computeVertexNormals();

    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0xc2b280, // Sandy color
      roughness: 0.9,
      flatShading: true 
    });

    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = this.config.floorDepth;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);
  }

  private createCorals() {
    // Clear existing corals
    while(this.coralGroup.children.length > 0) {
      const obj = this.coralGroup.children[0];
      this.coralGroup.remove(obj);
    }

    const coralColors = [0xff5e00, 0xff007f, 0x7f00ff, 0x00ff7f, 0xffd700, 0x40b0ff];

    for (let i = 0; i < this.config.coralCount; i++) {
      const color = coralColors[Math.floor(Math.random() * coralColors.length)];
      const coralMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
      const group = new THREE.Group();
      
      const x = (Math.random() - 0.5) * 350; // Increased spread for better density
      const z = (Math.random() - 0.5) * 350;
      
      const surface = this.getFloorData(x, z);
      if (!surface) continue;

      group.position.set(x, surface.y - 0.05, z); // Minimal sink for contact

      // Align to actual mesh surface normal
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
      group.rotateY(Math.random() * Math.PI * 2);

      // Choose a coral species
      const species = Math.random();
      
      if (species < 0.4) {
        // --- TYPE A: TUBE CORAL ---
        const tubeCount = 2 + Math.floor(Math.random() * 3);
        for (let j = 0; j < tubeCount; j++) {
          const h = 0.5 + Math.random() * 1.5;
          const r = 0.15 + Math.random() * 0.15;
          const tubeGeo = new THREE.CylinderGeometry(r * 1.1, r, h, 6);
          const tube = new THREE.Mesh(tubeGeo, coralMat);
          tube.position.set((Math.random() - 0.5) * 0.6, h / 2, (Math.random() - 0.5) * 0.6);
          tube.rotation.x = (Math.random() - 0.5) * 0.3;
          tube.rotation.z = (Math.random() - 0.5) * 0.3;
          tube.castShadow = true;
          group.add(tube);
        }
      } else if (species < 0.8) {
        // --- TYPE B: BRANCHING CORAL ---
        const branchCount = 4 + Math.floor(Math.random() * 5);
        for (let j = 0; j < branchCount; j++) {
          const h = 0.8 + Math.random() * 1.2;
          const w = 0.1 + Math.random() * 0.1;
          const branchGeo = new THREE.CylinderGeometry(w * 0.4, w, h, 5);
          const branch = new THREE.Mesh(branchGeo, coralMat);
          branch.position.set((Math.random() - 0.5) * 0.3, h / 2, (Math.random() - 0.5) * 0.3);
          branch.rotation.x = (Math.random() - 0.5) * 1.5;
          branch.rotation.z = (Math.random() - 0.5) * 1.5;
          branch.castShadow = true;
          group.add(branch);
        }
      } else {
        // --- TYPE C: BRAIN/ROCK CORAL ---
        const size = 0.4 + Math.random() * 0.6;
        const brainGeo = new THREE.IcosahedronGeometry(size, 1);
        const brain = new THREE.Mesh(brainGeo, coralMat);
        brain.position.y = size * 0.5;
        brain.scale.set(1.2, 0.7, 1.1);
        brain.castShadow = true;
        group.add(brain);
      }
      
      group.scale.setScalar(0.7 + Math.random() * 0.8);
      this.coralGroup.add(group);
    }
  }

  private createWakeParticles() {
    const geo = new THREE.IcosahedronGeometry(1, 0); // Low-poly sphere
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x444444,
      transparent: true,
      opacity: this.config.wakeOpacity,
      flatShading: true,
      roughness: 0.2
    });

    this.wakeMesh = new THREE.InstancedMesh(geo, mat, this.config.wakeCount);
    this.wakeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wakeMesh.frustumCulled = false; // Prevent disappearing when sub is at edge
    this.scene.add(this.wakeMesh);

    // Initialize data
    for (let i = 0; i < this.config.wakeCount; i++) {
      this.wakeData.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
        scale: 0
      });
      
      // Initially hide them far away
      const dummy = new THREE.Object3D();
      dummy.position.set(0, -100, 0);
      dummy.updateMatrix();
      this.wakeMesh.setMatrixAt(i, dummy.matrix);
    }
    this.wakeMesh.instanceMatrix.needsUpdate = true;
  }

  private spawnWakeParticle() {
    if (!this.config.wakeEnabled) return;

    const data = this.wakeData[this.nextWakeIndex];
    data.active = true;
    
    // Position at propeller
    const fwdX = Math.cos(this.submarineHeading);
    const fwdZ = -Math.sin(this.submarineHeading);
    
    // Behind the sub
    data.pos.set(
      this.submarine.position.x - fwdX * 1.8,
      0, // Will be set below
      this.submarine.position.z - fwdZ * 1.8
    );

    // Add some spread
    data.pos.x += (Math.random() - 0.5) * this.config.wakeSpread;
    data.pos.z += (Math.random() - 0.5) * this.config.wakeSpread;
    
    // Start exactly at water surface + custom offset
    data.pos.y = this.getWaterHeight(data.pos.x, data.pos.z) + this.config.wakeOffset;

    // Velocity: mostly backwards + some random spread
    const speed = this.config.wakeSpeed * (0.8 + Math.random() * 0.4);
    data.vel.set(
      -fwdX * speed + (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      -fwdZ * speed + (Math.random() - 0.5) * 0.5
    );

    data.maxLife = this.config.wakeLifetime * (0.8 + Math.random() * 0.4);
    data.life = data.maxLife;
    data.scale = this.config.wakeSize * (0.6 + Math.random() * 0.8);

    this.nextWakeIndex = (this.nextWakeIndex + 1) % this.config.wakeCount;
  }

  private updateWakeParticles(dt: number) {
    const dummy = new THREE.Object3D();
    let needsUpdate = false;

    for (let i = 0; i < this.config.wakeCount; i++) {
      const data = this.wakeData[i];
      if (!data.active) continue;

      data.life -= dt;
      if (data.life <= 0) {
        data.active = false;
        dummy.position.set(0, -100, 0);
        dummy.updateMatrix();
        this.wakeMesh.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
        continue;
      }

      // Physics
      data.pos.addScaledVector(data.vel, dt);
      data.vel.y += this.config.wakeBuoyancy * dt; // Float up
      data.vel.multiplyScalar(0.98); // Drag

      // Scale over life: grow fast, then stay visible, then shrink
      const lifePct = data.life / data.maxLife; // 1.0 -> 0.0
      const s = data.scale * Math.sin(Math.pow(1.0 - lifePct, 0.5) * Math.PI);

      dummy.position.copy(data.pos);
      dummy.scale.setScalar(s);
      dummy.rotation.y += dt * 2;
      dummy.updateMatrix();
      this.wakeMesh.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.wakeMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private createSunRays() {
    const rayCount = 35; // More rays for better atmosphere
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    for (let i = 0; i < rayCount; i++) {
      const h = 60 + Math.random() * 30; // Much taller rays to reach the deep floor
      const r = 1.5 + Math.random() * 4;
      // Use cones instead of cylinders to avoid visible top caps
      const rayGeo = new THREE.ConeGeometry(r, h, 8, 1, true);
      const ray = new THREE.Mesh(rayGeo, rayMat);
      
      // Position top at surface and reach far below
      ray.position.set(
        (Math.random() - 0.5) * 120,
        -h / 2, 
        (Math.random() - 0.5) * 120
      );
      
      // Slight random tilt
      ray.rotation.x = (Math.random() - 0.5) * 0.4;
      ray.rotation.z = (Math.random() - 0.5) * 0.4;
      
      this.sunRays.add(ray);
    }
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

    // Resize depth render target to match
    const dpr = this.renderer.getPixelRatio();
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    this.depthTarget.setSize(w, h);
    const mat = this.water.material as THREE.ShaderMaterial;
    mat.uniforms.uResolution.value.set(w, h);
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
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(64, 176, 255, 0.5) transparent;
        }
        #fog-panel::-webkit-scrollbar {
          width: 6px;
        }
        #fog-panel::-webkit-scrollbar-thumb {
          background: rgba(64, 176, 255, 0.3);
          border-radius: 10px;
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
      <h3>🌍 Sky Atmosphere</h3>
      <div class="fog-row">
        <label>Enabled</label>
        <input type="checkbox" id="cfg-sky-fog-toggle" ${this.config.skyFogEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #40b0ff;">
      </div>
      <div class="fog-row">
        <label>Near</label>
        <input type="range" id="fog-near" min="0" max="100" step="1" value="${this.config.skyFogNear}">
        <span class="val" id="fog-near-val">${this.config.skyFogNear}</span>
      </div>
      <div class="fog-row">
        <label>Far</label>
        <input type="range" id="fog-far" min="10" max="600" step="5" value="${this.config.skyFogFar}">
        <span class="val" id="fog-far-val">${this.config.skyFogFar}</span>
      </div>
      <div class="fog-row">
        <label>Color</label>
        <input type="color" id="fog-color" value="#${this.skyColor.toString(16).padStart(6, '0')}">
        <span class="val">sky</span>
      </div>
    `;
    document.body.appendChild(panel);
    
    // Sky Fog Toggle
    const skyFogToggle = document.getElementById('cfg-sky-fog-toggle') as HTMLInputElement;
    skyFogToggle.addEventListener('change', () => this.config.skyFogEnabled = skyFogToggle.checked);

    // Near slider
    const nearSlider = document.getElementById('fog-near') as HTMLInputElement;
    const nearVal = document.getElementById('fog-near-val')!;
    nearSlider.addEventListener('input', () => {
      this.config.skyFogNear = parseFloat(nearSlider.value);
      nearVal.textContent = nearSlider.value;
    });

    // Far slider
    const farSlider = document.getElementById('fog-far') as HTMLInputElement;
    const farVal = document.getElementById('fog-far-val')!;
    farSlider.addEventListener('input', () => {
      this.config.skyFogFar = parseFloat(farSlider.value);
      farVal.textContent = farSlider.value;
    });

    // Color picker
    const colorPicker = document.getElementById('fog-color') as HTMLInputElement;
    colorPicker.addEventListener('input', () => {
      const c = new THREE.Color(colorPicker.value);
      this.skyColor = c.getHex();
    });

    // --- New Simulation Controls ---
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

      // --- Drag-to-change logic for numeric boxes ---
      numInput.style.cursor = 'ew-resize';
      let isDragging = false;
      let startX = 0;
      let startVal = 0;

      numInput.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startVal = parseFloat(numInput.value) || 0;
        document.body.style.cursor = 'ew-resize';
        e.preventDefault(); // Prevent text selection
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const sensitivity = step;
        const newVal = startVal + dx * sensitivity;
        numInput.value = newVal.toFixed(2).replace(/\.?0+$/, '');
        update(newVal, 'num');
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = 'default';
        }
      });
    };

    const hr = document.createElement('hr');
    hr.style.border = '0';
    hr.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    hr.style.margin = '16px 0';
    panel.appendChild(hr);

    addSlider('Opacity', 'cfg-opacity', 0.1, 1, 0.01, this.config.waterOpacity, (v) => {
      this.config.waterOpacity = v;
      const mat = this.water.material as THREE.ShaderMaterial;
      mat.uniforms.uOpacity.value = v;
    });

    addSlider('Sub Speed', 'cfg-speed', 1, 30, 0.5, this.config.moveSpeed, (v) => this.config.moveSpeed = v);
    addSlider('Turn Spd', 'cfg-turn', 0.5, 4.0, 0.1, this.config.turnSpeed, (v) => this.config.turnSpeed = v);
    addSlider('Prop Max', 'cfg-prop', 5, 50, 1, this.config.propMaxSpeed, (v) => this.config.propMaxSpeed = v);
    addSlider('Wave Spd', 'cfg-w-spd', 0, 3, 0.1, this.config.waveSpeed, (v) => this.config.waveSpeed = v);
    addSlider('Wave Hgt', 'cfg-w-hgt', 0, 5, 0.1, this.config.waveHeight, (v) => this.config.waveHeight = v);
    addSlider('Sub Sink', 'cfg-sink', -2, 1.5, 0.05, this.config.subSink, (v) => this.config.subSink = v);
    addSlider('Foam', 'cfg-foam', 0, 5, 0.05, this.config.foamIntensity, (v) => {
      this.config.foamIntensity = v;
      const mat = this.water.material as THREE.ShaderMaterial;
      mat.uniforms.uFoamStrength.value = v;
    });

    addSlider('Cam Dist', 'cfg-cam-d', 2, 40, 0.5, this.config.camDist, (v) => this.config.camDist = v);
    addSlider('Cam Hgt', 'cfg-cam-h', 0, 20, 0.2, this.config.camHeight, (v) => this.config.camHeight = v);
    addSlider('Cam FOV', 'cfg-cam-f', 20, 120, 1, this.config.camFOV, (v) => {
      this.config.camFOV = v;
      this.camera.fov = v;
      this.camera.updateProjectionMatrix();
    });

    const hr2 = document.createElement('hr');
    hr2.style.border = '0';
    hr2.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    hr2.style.margin = '16px 0';
    panel.appendChild(hr2);

    // Toggle for Wake
    const wakeRow = document.createElement('div');
    wakeRow.className = 'fog-row';
    wakeRow.innerHTML = `
      <label>Wake</label>
      <input type="checkbox" id="cfg-wake-toggle" ${this.config.wakeEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #40b0ff;">
    `;
    panel.appendChild(wakeRow);
    const wakeToggle = document.getElementById('cfg-wake-toggle') as HTMLInputElement;
    wakeToggle.addEventListener('change', () => {
      this.config.wakeEnabled = wakeToggle.checked;
      this.wakeMesh.visible = wakeToggle.checked;
    });

    addSlider('Wake Size', 'cfg-wake-size', 0.05, 1.0, 0.05, this.config.wakeSize, (v) => this.config.wakeSize = v);
    addSlider('Wake Life', 'cfg-wake-life', 0.2, 5.0, 0.1, this.config.wakeLifetime, (v) => this.config.wakeLifetime = v);
    addSlider('Wake Spd', 'cfg-wake-spd', 0, 5, 0.1, this.config.wakeSpeed, (v) => this.config.wakeSpeed = v);
    addSlider('Wake Sprd', 'cfg-wake-sprd', 0, 2, 0.1, this.config.wakeSpread, (v) => this.config.wakeSpread = v);
    addSlider('Wake Hgt', 'cfg-wake-hgt-off', -1, 1, 0.05, this.config.wakeOffset, (v) => this.config.wakeOffset = v);
    addSlider('Buoyancy', 'cfg-wake-buoy', -0.5, 1.0, 0.05, this.config.wakeBuoyancy, (v) => this.config.wakeBuoyancy = v);
    addSlider('Wake Opac', 'cfg-wake-opac', 0, 1, 0.05, this.config.wakeOpacity, (v) => {
      this.config.wakeOpacity = v;
      (this.wakeMesh.material as THREE.MeshStandardMaterial).opacity = v;
    });

    const hr3 = document.createElement('hr');
    hr3.style.border = '0';
    hr3.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    hr3.style.margin = '16px 0';
    panel.appendChild(hr3);

    addSlider('Rocks', 'cfg-rocks', 0, 100, 1, this.config.rockCount, (v) => {
      this.config.rockCount = Math.floor(v);
      this.createRocks();
    });

    addSlider('Corals', 'cfg-corals', 0, 200, 1, this.config.coralCount, (v) => {
      this.config.coralCount = Math.floor(v);
      this.createCorals();
    });

    const hr4 = document.createElement('hr');
    hr4.style.border = '0';
    hr4.style.borderTop = '1px solid rgba(255,255,255,0.1)';
    hr4.style.margin = '16px 0';
    panel.appendChild(hr4);

    const uwHeader = document.createElement('h3');
    uwHeader.textContent = '🌊 Underwater Atmos';
    panel.appendChild(uwHeader);

    const uwToggleRow = document.createElement('div');
    uwToggleRow.className = 'fog-row';
    uwToggleRow.innerHTML = `
      <label>Enabled</label>
      <input type="checkbox" id="cfg-uw-fog-toggle" ${this.config.uwFogEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #40b0ff;">
    `;
    panel.appendChild(uwToggleRow);
    const uwFogToggle = document.getElementById('cfg-uw-fog-toggle') as HTMLInputElement;
    uwFogToggle.addEventListener('change', () => this.config.uwFogEnabled = uwFogToggle.checked);

    addSlider('UW Fog Near', 'cfg-uw-near', 0, 50, 0.5, this.config.uwFogNear, (v) => this.config.uwFogNear = v);
    addSlider('UW Fog Far', 'cfg-uw-far', 5, 300, 1, this.config.uwFogFar, (v) => this.config.uwFogFar = v);

    const uwColorRow = document.createElement('div');
    uwColorRow.className = 'fog-row';
    uwColorRow.innerHTML = `
      <label>Fog</label>
      <input type="color" id="cfg-uw-fog-color" value="#${this.config.uwFogColor.toString(16).padStart(6, '0')}">
      <label>BG</label>
      <input type="color" id="cfg-uw-bg-color" value="#${this.config.uwBgColor.toString(16).padStart(6, '0')}">
    `;
    panel.appendChild(uwColorRow);

    document.getElementById('cfg-uw-fog-color')?.addEventListener('input', (e) => {
      this.config.uwFogColor = parseInt((e.target as HTMLInputElement).value.replace('#', '0x'), 16);
    });
    document.getElementById('cfg-uw-bg-color')?.addEventListener('input', (e) => {
      this.config.uwBgColor = parseInt((e.target as HTMLInputElement).value.replace('#', '0x'), 16);
    });
  }

  /** Move & rotate the submarine based on currently held keys. */
  private processInput(dt: number) {
    if (this.keys.has('KeyA')) this.submarineHeading += this.config.turnSpeed * dt;
    if (this.keys.has('KeyD')) this.submarineHeading -= this.config.turnSpeed * dt;
 
    const fwdX = Math.cos(this.submarineHeading);
    const fwdZ = -Math.sin(this.submarineHeading);
 
    if (this.keys.has('KeyW')) {
      this.submarine.position.x += fwdX * this.config.moveSpeed * dt;
      this.submarine.position.z += fwdZ * this.config.moveSpeed * dt;
    }
    if (this.keys.has('KeyS')) {
      this.submarine.position.x -= fwdX * this.config.moveSpeed * dt;
      this.submarine.position.z -= fwdZ * this.config.moveSpeed * dt;
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    const t = this.clock.getElapsedTime();
    const dt = Math.min(t - this.lastElapsed, 0.05);
    this.lastElapsed = t;

    // --- Input (WASD always active regardless of camera mode) ---
    this.processInput(dt);

    // --- Submarine placement & orientation ---
    this.submarine.rotation.y = this.submarineHeading;
    this.submarine.rotation.z = Math.sin(t * 0.8) * 0.04;

    // Multi-point sampling for better hull contact and wave-following pitch
    const fwdX = Math.cos(this.submarineHeading);
    const fwdZ = -Math.sin(this.submarineHeading);
    const sampleDist = 1.4; // nose/tail offset

    const noseY = this.getWaterHeight(this.submarine.position.x + fwdX * sampleDist, this.submarine.position.z + fwdZ * sampleDist);
    const tailY = this.getWaterHeight(this.submarine.position.x - fwdX * sampleDist, this.submarine.position.z - fwdZ * sampleDist);
    const midY  = this.getWaterHeight(this.submarine.position.x, this.submarine.position.z);
    
    const avgSurfaceY = (noseY + midY + tailY) / 3;
    const wavePitch = Math.atan2(noseY - tailY, sampleDist * 2);

    // --- User's Requested Approach: Wave Envelope Buoyancy ---
    // 1. Calculate the theoretical maximum and minimum water height 
    // based on the wave function coefficients (0.18 + 0.14 + 0.1 = 0.42).
    const maxWaveAmp = (0.18 + 0.14 + 0.1) * this.config.waveHeight;
    const minWaveAmp = -maxWaveAmp;

    // 2. Calculate the "Propeller Gap" (how much lower/higher the tail is than the average)
    const propellerGap = tailY - avgSurfaceY;

    // 3. Create a dynamic sink that compensates for the gap, 
    // ensuring the sub "dips" into troughs to keep the propeller in water.
    // We clamp it within the theoretical wave range.
    const dynamicSink = THREE.MathUtils.clamp(propellerGap, minWaveAmp, maxWaveAmp);

    // 4. Apply the dynamic sink + the user's base subSink.
    // We use a high lerp factor (0.9) to make it snappy and responsive.
    const targetY = avgSurfaceY + dynamicSink + this.config.subSink;
    this.submarine.position.y += (targetY - this.submarine.position.y) * 0.8;

    let targetPitch = Math.sin(t * 0.6) * 0.02 + wavePitch;
    if (this.keys.has('KeyW')) targetPitch -= 0.08; // More aggressive tilt
    if (this.keys.has('KeyS')) targetPitch += 0.06;
    this.submarine.rotation.x += (targetPitch - this.submarine.rotation.x) * 0.25; // Faster pitch response

    // --- Water animation (vertex displacement) ---
    const waterPos = this.water.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < waterPos.count; i++) {
      const vx = this.waterVertices[i * 3];
      const vz = this.waterVertices[i * 3 + 1];
      const base = this.waterOrigY[i];
      const newZ =
        base +
        Math.sin(vx * 0.2 + t * 0.6 * this.config.waveSpeed) * 0.18 * this.config.waveHeight +
        Math.sin(vz * 0.25 + t * 0.45 * this.config.waveSpeed) * 0.14 * this.config.waveHeight +
        Math.sin((vx + vz) * 0.15 + t * 0.5 * this.config.waveSpeed) * 0.1 * this.config.waveHeight;
      waterPos.setZ(i, newZ);
    }
    waterPos.needsUpdate = true;
 
    // --- Camera ---
    if (this.cameraMode === 'orbit') {
      this.controls.update();
    } else {
      const fwdX = Math.cos(this.submarineHeading);
      const fwdZ = -Math.sin(this.submarineHeading);

      const targetCamX = this.submarine.position.x - fwdX * this.config.camDist;
      const targetCamY = this.submarine.position.y + this.config.camHeight;
      const targetCamZ = this.submarine.position.z - fwdZ * this.config.camDist;

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

    // --- Propeller spin logic with inertia & direction ---
    let targetSpeed = 0;
    if (this.keys.has('KeyW')) {
      targetSpeed = this.config.propMaxSpeed;
    } else if (this.keys.has('KeyS')) {
      targetSpeed = -this.config.propMaxSpeed; // Reverse!
    } else if (this.keys.has('KeyA') || this.keys.has('KeyD')) {
      targetSpeed = this.config.propMaxSpeed * 0.4;
    }
    
    // Smoothly ramp speed: faster acceleration, slower friction/coast
    const lerpSpeed = Math.abs(targetSpeed) > Math.abs(this.currentPropSpeed) ? 0.05 : 0.015;
    this.currentPropSpeed += (targetSpeed - this.currentPropSpeed) * lerpSpeed;
    this.propeller.rotation.x += this.currentPropSpeed * dt;

    // --- Depth pass: render scene into depth target ---
    const waterMat = this.water.material as THREE.ShaderMaterial;
    waterMat.uniforms.uTime.value = t;
    
    // Sync uniforms (sun direction and fog)
    waterMat.uniforms.uSunDir.value.copy(this.sun.position).normalize();
    const fog = this.scene.fog as THREE.Fog;
    waterMat.uniforms.fogColor.value.copy(fog.color);
    waterMat.uniforms.fogNear.value = fog.near;
    waterMat.uniforms.fogFar.value = fog.far;

    this.water.visible = false;
    this.scene.overrideMaterial = this.depthMaterial;
    
    this.renderer.setRenderTarget(this.depthTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    
    this.scene.overrideMaterial = null;
    this.water.visible = true;

    // --- Wake Particles ---
    if (this.config.wakeEnabled) {
      // Spawn based on propeller speed
      const absPropSpeed = Math.abs(this.currentPropSpeed);
      if (absPropSpeed > 2) {
        this.spawnAccumulator += dt * absPropSpeed * 4.0; // Higher spawn rate
        while (this.spawnAccumulator > 1) {
          this.spawnWakeParticle();
          this.spawnAccumulator -= 1;
        }
      }
      this.updateWakeParticles(dt);
    }

    // --- Drift clouds ---
    this.clouds.forEach((cloud, index) => {
      cloud.position.x += 0.008 * (1 + (index % 3) * 0.4);
      if (cloud.position.x > 110) cloud.position.x = -110;
    });

    // --- Animate Sun Rays ---
    this.sunRays.children.forEach((ray, i) => {
      ray.rotation.y += dt * 0.1;
      const pulse = Math.sin(t * 0.5 + i) * 0.02;
      ((ray as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.06 + pulse;
    });

    // --- Dynamic Underwater Atmosphere ---
    const isUnderwater = this.camera.position.y < 0;
    const fogState = this.scene.fog as THREE.Fog;
    const targetFogColor = isUnderwater ? new THREE.Color(this.config.uwFogColor) : new THREE.Color(this.skyColor);
    const targetBgColor = isUnderwater ? new THREE.Color(this.config.uwBgColor) : new THREE.Color(this.skyColor);
    let targetFogNear = isUnderwater ? this.config.uwFogNear : this.config.skyFogNear;
    let targetFogFar = isUnderwater ? this.config.uwFogFar : this.config.skyFogFar;

    // If fog is disabled for the current state, push it far out of view
    if (isUnderwater && !this.config.uwFogEnabled) {
      targetFogNear = 1000;
      targetFogFar = 2000;
    } else if (!isUnderwater && !this.config.skyFogEnabled) {
      targetFogNear = 1000;
      targetFogFar = 2000;
    }

    // Faster lerp (0.15) for more responsive slider feedback
    const lerpSpd = 0.15;
    fogState.color.lerp(targetFogColor, lerpSpd);
    fogState.near += (targetFogNear - fogState.near) * lerpSpd;
    fogState.far += (targetFogFar - fogState.far) * lerpSpd;
    
    // Smooth background transition
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(targetBgColor, lerpSpd);
    } else {
      this.scene.background = targetBgColor;
    }

    // --- Final render (water shader samples depth texture) ---
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
