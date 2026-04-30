import * as THREE from 'three';
import { SKY_VERTEX_SHADER, SKY_FRAGMENT_SHADER } from '../shaders/skyShader';
import { SKY_PRESETS, CONFIG } from '../config';
import { CLOUD_VERTEX_SHADER, CLOUD_FRAGMENT_SHADER } from '../shaders/cloudShader';

export class Atmosphere {
  public sun!: THREE.DirectionalLight;
  public sunRays: THREE.Group = new THREE.Group();
  public clouds: THREE.Group[] = [];
  private skyMesh!: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private cloudMat!: THREE.ShaderMaterial;
  private cloudGroup: THREE.Group = new THREE.Group();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupLighting();
    this.createSky();
    this.createSunRays();
    this.createClouds(CONFIG.cloudCount);
  }

  private createSky() {
    const skyGeo = new THREE.SphereGeometry(450, 32, 15);
    const preset = SKY_PRESETS[CONFIG.skyPreset];
    
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: new THREE.Color('#0A0A28') }, // Deep Top (Midnight Blue)
        uColor2: { value: new THREE.Color('#3C2864') }, // Purple
        uColor3: { value: new THREE.Color('#7B3B6B') }, // Magenta/Pink
        uColor4: { value: new THREE.Color('#FF7850') }, // Orange
        uColor5: { value: new THREE.Color('#FFD0A1') }, // Horizon Glow
      },
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(this.skyMesh);
  }

  public updateSkyColors(presetIndex: number) {
    // Ditching the multi-preset system for now to focus on the reference gradient
    // as requested by the user.
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
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);

    const hemi = new THREE.HemisphereLight(0x88ddff, 0x0066cc, 0.6);
    this.scene.add(hemi);
  }

  private createSunRays() {
    const rayCount = 35;
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    for (let i = 0; i < rayCount; i++) {
      const h = 60 + Math.random() * 30;
      const r = 1.5 + Math.random() * 4;
      const rayGeo = new THREE.ConeGeometry(r, h, 8, 1, true);
      const ray = new THREE.Mesh(rayGeo, rayMat);
      
      ray.position.set(
        (Math.random() - 0.5) * 120,
        -h / 2, 
        (Math.random() - 0.5) * 120
      );
      
      ray.rotation.x = (Math.random() - 0.5) * 0.4;
      ray.rotation.z = (Math.random() - 0.5) * 0.4;
      
      this.sunRays.add(ray);
    }
    this.scene.add(this.sunRays);
  }

  private createSingleCloud() {
    const cloud = new THREE.Group();
    const blobCount = 5 + Math.floor(Math.random() * 7);

    for (let j = 0; j < blobCount; j++) {
      const blobGeo = new THREE.IcosahedronGeometry(1.5 + Math.random() * 1.2, 1);
      const blob = new THREE.Mesh(blobGeo, this.cloudMat);
      const s = 0.8 + Math.random() * 1.2;
      blob.scale.set(s * (1.2 + Math.random() * 0.5), s * (0.8 + Math.random() * 0.4), s * (1.1 + Math.random() * 0.4));
      const angle = (j / blobCount) * Math.PI * 2;
      const radius = Math.random() * 3.0;
      blob.position.set(
        Math.cos(angle) * radius + (j - blobCount/2) * 1.5,
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 3.5,
      );
      cloud.add(blob);
    }

    const ringRadius = 150 + Math.random() * 300;
    const ringAngle = Math.random() * Math.PI * 2;
    const yPos = 8 + Math.random() * 65;

    cloud.position.set(
      Math.cos(ringAngle) * ringRadius,
      yPos,
      Math.sin(ringAngle) * ringRadius,
    );
    
    const sizeScale = Math.random() > 0.7 ? 0.3 + Math.random() * 0.5 : 0.8 + Math.random() * 1.4;
    cloud.scale.setScalar(sizeScale);

    this.cloudGroup.add(cloud);
    this.clouds.push(cloud);
  }

  private createClouds(count: number) {
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        uSkyTop: { value: new THREE.Color('#3C2864') },
        uSkyMid: { value: new THREE.Color('#7B3B6B') },
        uSkyBottom: { value: new THREE.Color('#FF7850') },
        uHorizonColor: { value: new THREE.Color('#FFD0A1') },
      },
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
    });

    for (let i = 0; i < count; i++) {
      this.createSingleCloud();
    }
    this.scene.add(this.cloudGroup);
  }

  public updateCloudCount(count: number) {
    const current = this.clouds.length;
    if (count > current) {
      for (let i = 0; i < count - current; i++) {
        this.createSingleCloud();
      }
    } else if (count < current) {
      for (let i = 0; i < current - count; i++) {
        const cloud = this.clouds.pop();
        if (cloud) {
          this.cloudGroup.remove(cloud);
        }
      }
    }
  }

  public update(dt: number, time: number, camPos: THREE.Vector3) {
    // Keep sky and cloud group centered on camera
    this.skyMesh.position.copy(camPos);
    this.cloudGroup.position.copy(camPos);

    // Drift clouds in local space
    this.clouds.forEach((cloud, index) => {
      cloud.position.x += 0.05 * (1 + (index % 3) * 0.4);
      // Wrap in a large enough radius
      if (cloud.position.x > 500) cloud.position.x = -500;
    });

    // But for infinite feel, we can follow camera

    // Animate Sun Rays
    this.sunRays.children.forEach((ray, i) => {
      ray.rotation.y += dt * 0.1;
      const pulse = Math.sin(time * 0.5 + i) * 0.02;
      ((ray as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.06 + pulse;
    });
  }
}
