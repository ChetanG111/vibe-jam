"use client";

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useRockControls } from "./utils/controls";
import { useSeabedControls } from "../SeabedFloor/utils/controls";

// Simple hash and noise to match GLSL exactly
function hash(x: number, y: number) {
  const dot = x * 127.1 + y * 311.7;
  const s = Math.sin(dot) * 43758.5453123;
  return s - Math.floor(s);
}

function lerp(a: number, b: number, t: number) {
  return a + t * (b - a);
}

function fade(t: number) {
  return t * t * (3.0 - 2.0 * t);
}

function noise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fade(fx);
  const uy = fade(fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function getSeabedHeight(x: number, z: number) {
  let h = noise(x * 0.05, z * 0.05) * 8.0;
  h += noise(x * 0.1, z * 0.1) * 3.0;
  return h;
}

interface RocksProps {
  seabedDepthOverride?: number;
}

export default function Rocks({ seabedDepthOverride }: RocksProps) {
  const { count, spread, minSize, maxSize, detail, color, randomSeed } = useRockControls();
  const { seabedDepth } = useSeabedControls();
  
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const finalSeabedDepth = seabedDepthOverride ?? seabedDepth;

  // Generate instances
  useEffect(() => {
    if (!meshRef.current) return;

    let seed = randomSeed;
    function random() {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    }

    const baseColor = new THREE.Color(color);
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * spread;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const height = getSeabedHeight(x, z);
      const s = minSize + random() * (maxSize - minSize);
      const y = finalSeabedDepth + height - (s * 0.2);

      dummy.position.set(x, y, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const lightness = 0.8 + random() * 0.4;
      tempColor.copy(baseColor).multiplyScalar(lightness);
      meshRef.current.setColorAt(i, tempColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [count, spread, minSize, maxSize, finalSeabedDepth, randomSeed, color, dummy]);

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
      frustumCulled={false}
      renderOrder={1}
    >
      <icosahedronGeometry args={[1, detail]} />
      <meshStandardMaterial flatShading />
    </instancedMesh>
  );
}
