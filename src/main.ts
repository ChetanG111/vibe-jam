import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG, SKY_COLOR } from './config';
import { WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER } from './shaders/waterShader';
import { getWaterHeight } from './utils/math';
import { Submarine } from './entities/Submarine';
import { WakeParticles } from './effects/WakeParticles';
import { Terrain } from './environment/Terrain';
import { Atmosphere } from './environment/Atmosphere';
import { UIManager } from './ui/UIManager';

class VibeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private submarine: Submarine;
  private terrain!: Terrain;
  private atmosphere: Atmosphere;
  private wakeParticles: WakeParticles;

  
  private controls!: OrbitControls;
  private cameraMode: 'follow' | 'orbit' = 'follow';
  private snapCamera = false;
  
  private depthTarget!: THREE.WebGLRenderTarget;
  private depthMaterial!: THREE.MeshDepthMaterial;
  private waterMat!: THREE.ShaderMaterial;
  
  private keys = new Set<string>();
  private submarineHeading = 0;
  private currentPropSpeed = 0;
  private clock = new THREE.Clock();
  private lastElapsed = 0;
  private spawnAccumulator = 0;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, CONFIG.skyFogNear, CONFIG.skyFogFar);

    this.camera = new THREE.PerspectiveCamera(CONFIG.camFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(20, 10, 25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enabled = false;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.setupWaterResources();
    this.atmosphere = new Atmosphere(this.scene);
    this.terrain = new Terrain(this.scene, this.waterMat);
    this.submarine = new Submarine();
    this.scene.add(this.submarine.mesh);
    
    this.wakeParticles = new WakeParticles(this.scene);

    new UIManager(
      (key, val) => (CONFIG as any)[key] = val,
      () => this.toggleCameraMode(),
      () => this.terrain.createRocks(),
      () => this.terrain.createCorals(),
      (v) => this.waterMat.uniforms.uOpacity.value = v,
      (v) => this.waterMat.uniforms.uFoamStrength.value = v
    );

    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  private setupWaterResources() {
    const dpr = this.renderer.getPixelRatio();
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    
    this.depthTarget = new THREE.WebGLRenderTarget(w, h);
    this.depthTarget.depthTexture = new THREE.DepthTexture(w, h);
    this.depthTarget.depthTexture.format = THREE.DepthFormat;
    this.depthTarget.depthTexture.type = THREE.UnsignedIntType;
    
    this.depthMaterial = new THREE.MeshDepthMaterial();

    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime:       { value: 0 },
        uDepthTex:   { value: this.depthTarget.depthTexture },
        uResolution: { value: new THREE.Vector2(w, h) },
        uCameraNear: { value: this.camera.near },
        uCameraFar:  { value: this.camera.far },
        uWaterColor: { value: new THREE.Color(0x14b8e0) },
        uFoamColor:  { value: new THREE.Color(0xffffff) },
        uSunDir:     { value: new THREE.Vector3(0,1,0) }, // Updated in animate
        uOpacity:    { value: CONFIG.waterOpacity },
        uFoamStrength: { value: CONFIG.foamIntensity },
        uWaveSpeed:  { value: CONFIG.waveSpeed },
        uWaveHeight: { value: CONFIG.waveHeight },
        fogColor:    { value: (this.scene.fog as THREE.Fog).color },
        fogNear:     { value: (this.scene.fog as THREE.Fog).near },
        fogFar:      { value: (this.scene.fog as THREE.Fog).far },
      },
      side: THREE.DoubleSide,
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
    });
  }

  private toggleCameraMode() {
    if (this.cameraMode === 'follow') {
      this.cameraMode = 'orbit';
      this.controls.enabled = true;
      this.controls.target.copy(this.submarine.mesh.position);
      this.controls.update();
    } else {
      this.cameraMode = 'follow';
      this.controls.enabled = false;
      this.snapCamera = true;
    }
  }

  private processInput(dt: number) {
    if (this.keys.has('KeyA')) this.submarineHeading += CONFIG.turnSpeed * dt;
    if (this.keys.has('KeyD')) this.submarineHeading -= CONFIG.turnSpeed * dt;
    const fwdX = Math.cos(this.submarineHeading);
    const fwdZ = -Math.sin(this.submarineHeading);
    if (this.keys.has('KeyW')) {
      this.submarine.mesh.position.x += fwdX * CONFIG.moveSpeed * dt;
      this.submarine.mesh.position.z += fwdZ * CONFIG.moveSpeed * dt;
    }
    if (this.keys.has('KeyS')) {
      this.submarine.mesh.position.x -= fwdX * CONFIG.moveSpeed * dt;
      this.submarine.mesh.position.z -= fwdZ * CONFIG.moveSpeed * dt;
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    const t = this.clock.getElapsedTime();
    const dt = Math.min(t - this.lastElapsed, 0.05);
    this.lastElapsed = t;

    this.processInput(dt);

    // Submarine physics
    this.submarine.mesh.rotation.y = this.submarineHeading;
    this.submarine.mesh.rotation.z = Math.sin(t * 0.8) * 0.04;

    const fwdX = Math.cos(this.submarineHeading);
    const fwdZ = -Math.sin(this.submarineHeading);
    const sampleDist = 1.4;

    const noseY = getWaterHeight(this.submarine.mesh.position.x + fwdX * sampleDist, this.submarine.mesh.position.z + fwdZ * sampleDist, t);
    const tailY = getWaterHeight(this.submarine.mesh.position.x - fwdX * sampleDist, this.submarine.mesh.position.z - fwdZ * sampleDist, t);
    const midY  = getWaterHeight(this.submarine.mesh.position.x, this.submarine.mesh.position.z, t);
    
    const avgSurfaceY = (noseY + midY + tailY) / 3;
    const wavePitch = Math.atan2(noseY - tailY, sampleDist * 2);

    const maxWaveAmp = (0.18 + 0.14 + 0.1) * CONFIG.waveHeight;
    const minWaveAmp = -maxWaveAmp;
    const propellerGap = tailY - avgSurfaceY;
    const dynamicSink = THREE.MathUtils.clamp(propellerGap, minWaveAmp, maxWaveAmp);
    const targetY = avgSurfaceY + dynamicSink + CONFIG.subSink;
    this.submarine.mesh.position.y += (targetY - this.submarine.mesh.position.y) * 0.8;

    let targetPitch = Math.sin(t * 0.6) * 0.02 + wavePitch;
    if (this.keys.has('KeyW')) targetPitch -= 0.08;
    if (this.keys.has('KeyS')) targetPitch += 0.06;
    this.submarine.mesh.rotation.x += (targetPitch - this.submarine.mesh.rotation.x) * 0.25;

    this.terrain.updateChunks([this.submarine.mesh.position, this.camera.position]);

    // Camera
    if (this.cameraMode === 'orbit') {
      this.controls.update();
    } else {
      const targetCamX = this.submarine.mesh.position.x - fwdX * CONFIG.camDist;
      const targetCamY = this.submarine.mesh.position.y + CONFIG.camHeight;
      const targetCamZ = this.submarine.mesh.position.z - fwdZ * CONFIG.camDist;
      const lerp = this.snapCamera ? 1.0 : 0.06;
      this.snapCamera = false;
      this.camera.position.x += (targetCamX - this.camera.position.x) * lerp;
      this.camera.position.y += (targetCamY - this.camera.position.y) * lerp;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * lerp;
      this.camera.lookAt(this.submarine.mesh.position.x + fwdX * 3, this.submarine.mesh.position.y + 0.8, this.submarine.mesh.position.z + fwdZ * 3);
    }

    // Propeller
    let targetSpeed = 0;
    if (this.keys.has('KeyW')) targetSpeed = CONFIG.propMaxSpeed;
    else if (this.keys.has('KeyS')) targetSpeed = -CONFIG.propMaxSpeed;
    else if (this.keys.has('KeyA') || this.keys.has('KeyD')) targetSpeed = CONFIG.propMaxSpeed * 0.4;
    const propLerp = Math.abs(targetSpeed) > Math.abs(this.currentPropSpeed) ? 0.05 : 0.015;
    this.currentPropSpeed += (targetSpeed - this.currentPropSpeed) * propLerp;
    this.submarine.propeller.rotation.x += this.currentPropSpeed * dt;

    // Sync shader uniforms
    this.waterMat.uniforms.uTime.value = t;
    this.waterMat.uniforms.uWaveSpeed.value = CONFIG.waveSpeed;
    this.waterMat.uniforms.uWaveHeight.value = CONFIG.waveHeight;
    this.waterMat.uniforms.uSunDir.value.copy(this.atmosphere.sun.position).normalize();
    
    const fUnifs = this.terrain.floorMat.uniforms;
    fUnifs.uSunDir.value.copy(this.atmosphere.sun.position).normalize();
    fUnifs.uSunColor.value.copy(this.atmosphere.sun.color);
    
    const fog = this.scene.fog as THREE.Fog;
    this.waterMat.uniforms.fogColor.value.copy(fog.color);
    this.waterMat.uniforms.fogNear.value = fog.near;
    this.waterMat.uniforms.fogFar.value = fog.far;

    fUnifs.fogColor.value.copy(fog.color);
    fUnifs.fogNear.value = fog.near;
    fUnifs.fogFar.value = fog.far;

    this.terrain.waterGroup.visible = false;
    this.scene.overrideMaterial = this.depthMaterial;
    this.renderer.setRenderTarget(this.depthTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.scene.overrideMaterial = null;
    this.terrain.waterGroup.visible = true;

    // Particles
    if (CONFIG.wakeEnabled) {
      const absPropSpeed = Math.abs(this.currentPropSpeed);
      if (absPropSpeed > 2) {
        this.spawnAccumulator += dt * absPropSpeed * 4.0;
        while (this.spawnAccumulator > 1) {
          this.wakeParticles.spawn(this.submarine.mesh.position, this.submarineHeading, t);
          this.spawnAccumulator -= 1;
        }
      }
      this.wakeParticles.update(dt);
    }
    this.wakeParticles.setVisible(CONFIG.wakeEnabled);
    this.wakeParticles.setOpacity(CONFIG.wakeOpacity);

    this.atmosphere.update(dt, t);

    // Underwater transition
    const isUnderwater = this.camera.position.y < 0;
    const targetFogColor = isUnderwater ? new THREE.Color(CONFIG.uwFogColor) : new THREE.Color(SKY_COLOR);
    const targetBgColor = isUnderwater ? new THREE.Color(CONFIG.uwBgColor) : new THREE.Color(SKY_COLOR);
    let targetFogNear = isUnderwater ? CONFIG.uwFogNear : CONFIG.skyFogNear;
    let targetFogFar = isUnderwater ? CONFIG.uwFogFar : CONFIG.skyFogFar;

    if (isUnderwater && !CONFIG.uwFogEnabled) { targetFogNear = 1000; targetFogFar = 2000; }
    else if (!isUnderwater && !CONFIG.skyFogEnabled) { targetFogNear = 1000; targetFogFar = 2000; }

    const lerpSpd = 0.15;
    fog.color.lerp(targetFogColor, lerpSpd);
    fog.near += (targetFogNear - fog.near) * lerpSpd;
    fog.far += (targetFogFar - fog.far) * lerpSpd;
    if (this.scene.background instanceof THREE.Color) this.scene.background.lerp(targetBgColor, lerpSpd);
    else this.scene.background = targetBgColor;

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = this.renderer.getPixelRatio();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    const rw = Math.floor(w * dpr);
    const rh = Math.floor(h * dpr);
    this.depthTarget.setSize(rw, rh);
    if (this.waterMat) this.waterMat.uniforms.uResolution.value.set(rw, rh);
  }
}

new VibeScene();
