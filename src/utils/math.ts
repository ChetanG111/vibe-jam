import * as THREE from 'three';
import { CONFIG } from '../config';

// Matching JS implementation of the shader noise for perfect object placement
function hash(x: number, y: number): number {
    const pX = fract(x * 123.34);
    const pY = fract(y * 456.21);
    const d = pX * (pX + 45.32) + pY * (pY + 45.32);
    return fract((pX + d) * (pY + d));
}

function fract(x: number): number {
    return x - Math.floor(x);
}

function mix(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
}

function noise(x: number, z: number): number {
    const iX = Math.floor(x);
    const iZ = Math.floor(z);
    const fX = x - iX;
    const fZ = z - iZ;

    const a = hash(iX, iZ);
    const b = hash(iX + 1, iZ);
    const c = hash(iX, iZ + 1);
    const d = hash(iX + 1, iZ + 1);

    const uX = fX * fX * (3.0 - 2.0 * fX);
    const uZ = fZ * fZ * (3.0 - 2.0 * fZ);

    return mix(a, b, uX) + (c - a) * uZ * (1.0 - uX) + (d - b) * uX * uZ;
}

export function getWaterHeight(worldX: number, worldZ: number, time: number): number {
  return (
    Math.sin(worldX * 0.2 + time * 0.6 * CONFIG.waveSpeed) * 0.18 * CONFIG.waveHeight +
    Math.sin(worldZ * 0.25 + time * 0.45 * CONFIG.waveSpeed) * 0.14 * CONFIG.waveHeight +
    Math.sin((worldX + worldZ) * 0.15 + time * 0.5 * CONFIG.waveSpeed) * 0.1 * CONFIG.waveHeight
  );
}

export function getFloorHeight(x: number, z: number): number {
  let h = 0;
  h += noise(x * 0.05, z * 0.05) * 4.0;
  h += noise(x * 0.1, z * 0.1) * 2.0;
  h += noise(x * 0.2, z * 0.2) * 1.0;
  return h;
}

/**
 * Calculates the exact height on the faceted (triangulated) terrain mesh.
 * Matches the GPU's linear interpolation across triangles.
 */
export function getFacetedFloorHeight(x: number, z: number): { y: number; normal: THREE.Vector3 } {
  const size = CONFIG.chunkSize;
  const segments = CONFIG.terrainSegments;
  const res = size / segments;

  // Vertex grid coordinates
  const x0 = Math.floor(x / res) * res;
  const x1 = x0 + res;
  const z0 = Math.floor(z / res) * res;
  const z1 = z0 + res;

  // Heights at 4 corners
  const h00 = getFloorHeight(x0, z0);
  const h10 = getFloorHeight(x1, z0);
  const h01 = getFloorHeight(x0, z1);
  const h11 = getFloorHeight(x1, z1);

  const fx = (x - x0) / res;
  const fz = (z - z0) / res;

  let y: number;
  const normal = new THREE.Vector3();

  // Match Three.js PlaneGeometry triangle split (fx + fz <= 1)
  if (fx + fz <= 1) {
    // Triangle 1: (0,0), (1,0), (0,1)
    y = h00 + fx * (h10 - h00) + fz * (h01 - h00);
    const v1 = new THREE.Vector3(res, h10 - h00, 0);
    const v2 = new THREE.Vector3(0, h01 - h00, res);
    normal.crossVectors(v2, v1).normalize();
  } else {
    // Triangle 2: (1,1), (0,1), (1,0)
    y = h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
    const v1 = new THREE.Vector3(-res, h01 - h11, 0);
    const v2 = new THREE.Vector3(0, h10 - h11, -res);
    normal.crossVectors(v2, v1).normalize();
  }

  return { y: y + CONFIG.floorDepth, normal };
}



