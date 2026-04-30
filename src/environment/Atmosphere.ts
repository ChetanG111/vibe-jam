import * as THREE from 'three';

export class Atmosphere {
  public sun!: THREE.DirectionalLight;
  public sunRays: THREE.Group = new THREE.Group();
  public clouds: THREE.Group[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupLighting();
    this.createSunRays();
    this.createClouds();
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

  private createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 1,
    });

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

      const isLow = i < cloudCount * 0.4;
      const yPos = isLow ? 8 + Math.random() * 6 : 18 + Math.random() * 14;

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

  public update(dt: number, time: number) {
    // Drift clouds
    this.clouds.forEach((cloud, index) => {
      cloud.position.x += 0.008 * (1 + (index % 3) * 0.4);
      if (cloud.position.x > 110) cloud.position.x = -110;
    });

    // Animate Sun Rays
    this.sunRays.children.forEach((ray, i) => {
      ray.rotation.y += dt * 0.1;
      const pulse = Math.sin(time * 0.5 + i) * 0.02;
      ((ray as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.06 + pulse;
    });
  }
}
