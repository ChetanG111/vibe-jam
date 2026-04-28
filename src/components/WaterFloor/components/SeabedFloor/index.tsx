"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSeabedControls } from "./utils/controls";

// Match the noise function from Rocks/index.tsx exactly
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

export default function SeabedFloor({
  seabedDepthOverride,
  colorOverride,
}: {
  seabedDepthOverride?: number;
  colorOverride?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const geomRef = useRef<THREE.PlaneGeometry>(null!);
  const { seabedDepth, deepColor } = useSeabedControls();

  // Apply displacement once
  useEffect(() => {
    if (!geomRef.current) return;
    
    const pos = geomRef.current.attributes.position;
    const v3 = new THREE.Vector3();
    
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      // In PlaneGeometry, before rotation, X and Y are the plane coordinates
      const h = getSeabedHeight(v3.x, v3.y);
      pos.setZ(i, h);
    }
    
    geomRef.current.computeVertexNormals();
    pos.needsUpdate = true;
  }, []);

  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    // The floor follows the camera for "infinity" effect
    // But since the displacement is based on world coordinates (v3.x, v3.y)
    // we should actually move the geometry or use a shader.
    // Wait, if I move the mesh, the noise "slides" across the geometry.
    // To keep the noise anchored to world space, I have to offset the UVs or vertices.
    
    // For now, I'll keep the mesh static at 0,0 to avoid sliding noise.
    // The user can increase the plane size if needed.
    meshRef.current.position.y = seabedDepthOverride ?? seabedDepth;
  });

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position={[0, -60, 0]}
      receiveShadow
    >
      <planeGeometry ref={geomRef} args={[2000, 2000, 150, 150]} />
      <meshStandardMaterial
        color={colorOverride ?? deepColor}
        flatShading
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}
