import * as THREE from 'three';
import { CONFIG } from '../config';
import { getFloorHeight, getFacetedFloorHeight } from '../utils/math';
import { FLOOR_VERTEX_SHADER, FLOOR_FRAGMENT_SHADER } from '../shaders/floorShader';

export class Terrain {
  public floorGroup = new THREE.Group();
  public rockGroup = new THREE.Group();
  public coralGroup = new THREE.Group();
  public waterGroup = new THREE.Group();
  
  private waterChunks = new Map<string, THREE.Mesh>();
  private floorChunks = new Map<string, THREE.Mesh>();
  private waterMat: THREE.ShaderMaterial;
  public floorMat: THREE.ShaderMaterial;
  
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, waterMat: THREE.ShaderMaterial) {
    this.scene = scene;
    this.waterMat = waterMat;
    
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xc2b280) },
        uSunDir: { value: new THREE.Vector3(0.5, 1, 0.5).normalize() },
        uSunColor: { value: new THREE.Color(0xfffbe8) },
        uAmbientColor: { value: new THREE.Color(0x88ddff).multiplyScalar(0.5) },
        fogColor: { value: new THREE.Color(0x002233) },
        fogNear: { value: 2 },
        fogFar: { value: 150 },
        uFloorBase: { value: CONFIG.floorDepth }
      },
      vertexShader: FLOOR_VERTEX_SHADER,
      fragmentShader: FLOOR_FRAGMENT_SHADER,
      transparent: false
    });

    this.scene.add(this.waterGroup);
    this.scene.add(this.floorGroup);
    this.scene.add(this.coralGroup);
    this.scene.add(this.rockGroup);

    this.createIslands();
    this.createCorals();
    this.createRocks();
  }

  public getFloorData(x: number, z: number): { y: number; normal: THREE.Vector3 } | null {
    return getFacetedFloorHeight(x, z);
  }

  public createRocks() {
    while(this.rockGroup.children.length > 0) {
      this.rockGroup.remove(this.rockGroup.children[0]);
    }

    const rockColors = [0x888888, 0x999999, 0x777777, 0xaaaaaa, 0x666666];

    for (let i = 0; i < CONFIG.rockCount; i++) {
      const x = (Math.random() - 0.5) * 350;
      const z = (Math.random() - 0.5) * 350;
      const scale = 0.6 + Math.random() * 1.6;

      const surface = this.getFloorData(x, z);
      if (!surface) continue;

      const group = new THREE.Group();
      const sink = 0.25 - ((scale - 0.6) / 1.6) * 0.15;
      group.position.set(x, surface.y - sink, z);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
      group.rotateY(Math.random() * Math.PI * 2);

      const color = rockColors[Math.floor(Math.random() * rockColors.length)];
      const rockMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });

      const mainGeo = new THREE.IcosahedronGeometry(scale, 1);
      const main = new THREE.Mesh(mainGeo, rockMat);
      const yScale = 0.55 + Math.random() * 0.2;
      main.scale.set(1, yScale, 1);
      main.position.y = scale * yScale * 0.7;
      
      main.rotation.y = Math.random() * Math.PI;
      main.castShadow = true;
      main.receiveShadow = true;
      group.add(main);

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

  public createCorals() {
    while(this.coralGroup.children.length > 0) {
      this.coralGroup.remove(this.coralGroup.children[0]);
    }

    const coralColors = [0xff5e00, 0xff007f, 0x7f00ff, 0x00ff7f, 0xffd700, 0x40b0ff];

    for (let i = 0; i < CONFIG.coralCount; i++) {
      const color = coralColors[Math.floor(Math.random() * coralColors.length)];
      const coralMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
      const group = new THREE.Group();
      
      const x = (Math.random() - 0.5) * 350;
      const z = (Math.random() - 0.5) * 350;
      
      const surface = this.getFloorData(x, z);
      if (!surface) continue;

      const totalScale = 0.7 + Math.random() * 0.8;
      const sink = 0.2 - ((totalScale - 0.7) / 0.8) * 0.1;
      group.position.set(x, surface.y - sink, z);
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
      group.rotateY(Math.random() * Math.PI * 2);

      const species = Math.random();
      if (species < 0.4) {
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
        const size = 0.4 + Math.random() * 0.6;
        const brainGeo = new THREE.IcosahedronGeometry(size, 1);
        const brain = new THREE.Mesh(brainGeo, coralMat);
        brain.position.y = size * 0.5;
        brain.scale.set(1.2, 0.7, 1.1);
        brain.castShadow = true;
        group.add(brain);
      }
      group.scale.setScalar(totalScale);
      this.coralGroup.add(group);
    }
  }

  private createIslands() {
    this.addIsland(-40, -0.5, -30, 22, 0x996633);
    this.addIsland(50, -0.5, -20, 18, 0x996633);
    this.addIsland(-80, -1.0, -90, 35, 0x777777);
    this.addIsland(90, -1.0, -70, 25, 0x777777);
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

    const baseHeight = Math.abs(y - (CONFIG.floorDepth - 15));
    const baseGeo = new THREE.CylinderGeometry(scale * 0.8, scale * 1.5, baseHeight, 10);
    const base = new THREE.Mesh(baseGeo, rockMat);
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

      const treeCount = Math.floor(scale * 0.8);
      for (let i = 0; i < treeCount; i++) {
        const tree = this.createPalmTree();
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (scale * 0.75);
        const normDist = dist / scale;
        const surfaceHeight = Math.sqrt(Math.max(0, 1 - normDist * normDist)) * scale * 0.6;
        tree.position.set(Math.cos(angle) * dist, surfaceHeight, Math.sin(angle) * dist);
        tree.rotation.y = Math.random() * Math.PI;
        tree.scale.setScalar(0.8 + Math.random() * 0.5);
        islandGroup.add(tree);
      }
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

  public updateChunks(positions: THREE.Vector3[]) {
    const required = new Set<string>();
    const dist = CONFIG.renderDistance;
    const size = CONFIG.chunkSize;

    positions.forEach(pos => {
      const cx = Math.round(pos.x / size);
      const cz = Math.round(pos.z / size);
      for (let x = cx - dist; x <= cx + dist; x++) {
        for (let z = cz - dist; z <= cz + dist; z++) {
          required.add(`${x},${z}`);
        }
      }
    });

    required.forEach(key => {
      if (!this.waterChunks.has(key)) {
        const [x, z] = key.split(',').map(Number);
        this.addChunk(x, z);
      }
    });

    this.waterChunks.forEach((_, key) => {
      if (!required.has(key)) {
        this.removeChunk(key);
      }
    });
  }

  private addChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const size = CONFIG.chunkSize;
    const segments = CONFIG.terrainSegments; 
    const xOffset = cx * size;
    const zOffset = cz * size;

    const waterGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    const waterChunk = new THREE.Mesh(waterGeo, this.waterMat);
    waterChunk.rotation.x = -Math.PI / 2;
    waterChunk.position.set(xOffset, 0, zOffset);
    this.waterGroup.add(waterChunk);
    this.waterChunks.set(key, waterChunk);

    // Floor is now a flat plane in JS, displaced in Shader for perfect stitching
    const floorGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    floorGeo.computeBoundingSphere();
    if (floorGeo.boundingSphere) floorGeo.boundingSphere.radius += 10.0; // Account for shader displacement
    const floorChunk = new THREE.Mesh(floorGeo, this.floorMat);
    floorChunk.rotation.x = -Math.PI / 2;
    floorChunk.position.set(xOffset, CONFIG.floorDepth, zOffset);
    this.floorGroup.add(floorChunk);
    this.floorChunks.set(key, floorChunk);
  }

  private removeChunk(key: string) {
    const wChunk = this.waterChunks.get(key);
    if (wChunk) {
      this.waterGroup.remove(wChunk);
      wChunk.geometry.dispose();
      this.waterChunks.delete(key);
    }
    const fChunk = this.floorChunks.get(key);
    if (fChunk) {
      this.floorGroup.remove(fChunk);
      fChunk.geometry.dispose();
      this.floorChunks.delete(key);
    }
  }
}
