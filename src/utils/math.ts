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

