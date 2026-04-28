import { useFrame } from "@react-three/fiber";
import { gameBridge } from "./bridge";
import { rippleStore } from "./components/WaterFloor/stores/rippleStore";
import { useRef } from "react";
import * as THREE from "three";

const WATER_Y = 8.0; // Matches our water level in startGame.ts

export function SubmarineRippleEmitter() {
  const lastRippleRef = useRef<number>(-99);
  const prevYRef = useRef<number | null>(null);
  const worldPos = new THREE.Vector3();

  useFrame(({ clock }) => {
    if (!gameBridge.submarine) return;

    gameBridge.submarine.getWorldPosition(worldPos);
    const t = clock.getElapsedTime();
    const currentY = worldPos.y;

    if (prevYRef.current === null) {
      prevYRef.current = currentY;
      return;
    }

    const prevY = prevYRef.current;
    prevYRef.current = currentY;

    // Entry splash: Submarine crosses water surface (simplified)
    if (prevY > WATER_Y && currentY <= WATER_Y) {
      rippleStore.add(worldPos.x, worldPos.z, t);
      lastRippleRef.current = t;
    }

    // Periodic ripples while submerged/touching surface
    // Since our sub is often at WATER_LEVEL + SURFACE_OFFSET (9.0), 
    // let's trigger ripples if it's within a certain range of WATER_Y.
    const isAtSurface = Math.abs(currentY - WATER_Y) < 1.5;
    
    if (isAtSurface && t - lastRippleRef.current > 1.2) {
      rippleStore.add(worldPos.x, worldPos.z, t);
      lastRippleRef.current = t;
    }
  });

  return null;
}
