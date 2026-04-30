import * as THREE from 'three';
import { CONFIG } from '../config';
import { getWaterHeight } from '../utils/math';

export class WakeParticles {
  public mesh: THREE.InstancedMesh;
  private data: Array<{
    active: boolean;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
    scale: number;
  }> = [];
  private nextIndex = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x444444,
      transparent: true,
      opacity: CONFIG.wakeOpacity,
      flatShading: true,
      roughness: 0.2
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, CONFIG.wakeCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    for (let i = 0; i < CONFIG.wakeCount; i++) {
      this.data.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
        scale: 0
      });
      const dummy = new THREE.Object3D();
      dummy.position.set(0, -100, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
  }

  public spawn(subPos: THREE.Vector3, heading: number, time: number) {
    if (!CONFIG.wakeEnabled) return;

    const data = this.data[this.nextIndex];
    data.active = true;
    
    const fwdX = Math.cos(heading);
    const fwdZ = -Math.sin(heading);
    
    data.pos.set(
      subPos.x - fwdX * 1.8,
      0,
      subPos.z - fwdZ * 1.8
    );

    data.pos.x += (Math.random() - 0.5) * CONFIG.wakeSpread;
    data.pos.z += (Math.random() - 0.5) * CONFIG.wakeSpread;
    data.pos.y = getWaterHeight(data.pos.x, data.pos.z, time) + CONFIG.wakeOffset;

    const speed = CONFIG.wakeSpeed * (0.8 + Math.random() * 0.4);
    data.vel.set(
      -fwdX * speed + (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 0.5,
      -fwdZ * speed + (Math.random() - 0.5) * 0.5
    );

    data.maxLife = CONFIG.wakeLifetime * (0.8 + Math.random() * 0.4);
    data.life = data.maxLife;
    data.scale = CONFIG.wakeSize * (0.6 + Math.random() * 0.8);

    this.nextIndex = (this.nextIndex + 1) % CONFIG.wakeCount;
  }

  public update(dt: number) {
    const dummy = new THREE.Object3D();
    let needsUpdate = false;

    for (let i = 0; i < CONFIG.wakeCount; i++) {
      const data = this.data[i];
      if (!data.active) continue;

      data.life -= dt;
      if (data.life <= 0) {
        data.active = false;
        dummy.position.set(0, -100, 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
        continue;
      }

      data.pos.addScaledVector(data.vel, dt);
      data.vel.y += CONFIG.wakeBuoyancy * dt;
      data.vel.multiplyScalar(0.98);

      const lifePct = data.life / data.maxLife;
      const s = data.scale * Math.sin(Math.pow(1.0 - lifePct, 0.5) * Math.PI);

      dummy.position.copy(data.pos);
      dummy.scale.setScalar(s);
      dummy.rotation.y += dt * 2;
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean) {
    this.mesh.visible = visible;
  }

  public setOpacity(opacity: number) {
    (this.mesh.material as THREE.MeshStandardMaterial).opacity = opacity;
  }
}
