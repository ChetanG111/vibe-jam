import { useFrame } from "@react-three/fiber";
import { rippleStore } from "./components/WaterFloor/stores/rippleStore";
import { useRef } from "react";
import * as THREE from "three";

export function SphereRippleEmitter({ position }: { position: [number, number, number] }) {
  const lastRippleRef = useRef<number>(-99);
  
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Trigger ripple every 1.5 seconds if the sphere is near the surface
    if (t - lastRippleRef.current > 1.5) {
      rippleStore.add(position[0], position[2], t);
      lastRippleRef.current = t;
    }
  });

  return null;
}
