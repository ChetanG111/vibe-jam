import { CONFIG } from '../config';

export function getWaterHeight(worldX: number, worldZ: number, time: number): number {
  return (
    Math.sin(worldX * 0.2 + time * 0.6 * CONFIG.waveSpeed) * 0.18 * CONFIG.waveHeight +
    Math.sin(worldZ * 0.25 + time * 0.45 * CONFIG.waveSpeed) * 0.14 * CONFIG.waveHeight +
    Math.sin((worldX + worldZ) * 0.15 + time * 0.5 * CONFIG.waveSpeed) * 0.1 * CONFIG.waveHeight
  );
}

export function getFloorHeight(x: number, z: number): number {
  const noise = 
    Math.sin(x * 0.05) * 2.5 + 
    Math.sin(z * 0.04) * 2.2 + 
    Math.sin((x + z) * 0.25) * 0.8;
  return CONFIG.floorDepth + noise;
}
