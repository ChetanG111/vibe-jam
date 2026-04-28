"use client";

import { useRef, useMemo, useEffect } from "react";
import { rippleStore } from "./stores/rippleStore";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VERT } from "./shaders/vertex";
import { FRAG } from "./shaders/fragment";
import { useWaterFloorControls } from "./utils/controls";

// ─────────────────────────────────────────────────────────────────────────────
// WaterFloor — cel-shaded / anime water using Voronoi F1 − SmoothF1
// ─────────────────────────────────────────────────────────────────────────────

export interface WaterFloorProps {
  deepOpacityOverride?: number;
  fadeDistanceOverride?: number;
}

export default function WaterFloor({ deepOpacityOverride, fadeDistanceOverride }: WaterFloorProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const {
    waterScale,
    cellSmoothness,
    edgeThreshold,
    edgeSoftness,
    flowX,
    flowZ,
    cellSpeed,
    noiseScale,
    noiseFlowSpeed,
    distortAmount,
    deepColor,
    midColor,
    midPos,
    highlightColor,
    opacity,
    deepOpacity,
    fadeDistance,
    fadeStrength,
  } = useWaterFloorControls();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite:  false,
        side:        THREE.DoubleSide,
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime:          { value: 0 },
          uScale:         { value: 0.30 },
          uSmoothness:    { value: 0.55 },
          uEdgeThreshold: { value: 0.067 },
          uEdgeSoftness:  { value: 0.01 },
          uFlowX:         { value: 0 },
          uFlowZ:         { value: 0.05 },
          uCellSpeed:       { value: 0.30 },
          uNoiseScale:      { value: 1.52 },
          uNoiseFlowSpeed:  { value: 0.20 },
          uDistortAmount:   { value: 0.30 },
          uDeepColor:       { value: new THREE.Color("#1E5D7A") },
          uMidColor:        { value: new THREE.Color("#FFFFFF") },
          uMidPos:          { value: 0.40 },
          uHighlight:       { value: new THREE.Color("#ffffff") },
          uOpacity:       { value: 1.0 },
          uDeepOpacity:   { value: 0.90 },
          uFadeDistance:    { value: 1500.0 },
          uFadeStrength:    { value: 1.5 },
          uCamXZ:           { value: new THREE.Vector2() },
          uRippleCenters:  { value: Array.from({ length: 8 }, () => new THREE.Vector2()) },
          uRippleTimes:    { value: new Array(8).fill(0) },
          uRippleCount:    { value: 0 },
          uRippleSpeed:    { value: 1.5 },
          uRippleWidth:    { value: 0.12 },
          uRippleStrength: { value: 5.5 },
          uRippleDecay:    { value: 1.6 },
          uRippleRings:    { value: 2 },
          uRippleSpacing:  { value: 1.0 },
        },
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }) => {
    const u = material.uniforms;
    u.uTime.value           = clock.getElapsedTime();
    u.uScale.value          = waterScale;
    u.uSmoothness.value     = cellSmoothness;
    u.uEdgeThreshold.value  = edgeThreshold;
    u.uEdgeSoftness.value   = edgeSoftness;
    u.uFlowX.value          = flowX;
    u.uFlowZ.value          = flowZ;
    u.uCellSpeed.value        = cellSpeed;
    u.uNoiseScale.value       = noiseScale;
    u.uNoiseFlowSpeed.value   = noiseFlowSpeed;
    u.uDistortAmount.value    = distortAmount;
    u.uDeepColor.value.set(deepColor);
    u.uMidColor.value.set(midColor);
    u.uMidPos.value = midPos;
    u.uHighlight.value.set(highlightColor);
    u.uOpacity.value        = opacity;
    u.uDeepOpacity.value    = deepOpacityOverride ?? deepOpacity;
    u.uFadeDistance.value   = fadeDistanceOverride ?? fadeDistance;
    u.uFadeStrength.value   = fadeStrength;
    u.uCamXZ.value.set(camera.position.x, camera.position.z);

    const cfg = rippleStore.getConfig();
    u.uRippleSpeed.value    = cfg.speed;
    u.uRippleWidth.value    = cfg.width;
    u.uRippleStrength.value = cfg.strength;
    u.uRippleDecay.value    = cfg.decay;
    u.uRippleRings.value    = cfg.rings;
    u.uRippleSpacing.value  = cfg.spacing;
    const ripples = rippleStore.get();
    u.uRippleCount.value    = ripples.length;
    for (let i = 0; i < ripples.length; i++) {
      u.uRippleCenters.value[i].set(ripples[i].x, ripples[i].z);
      u.uRippleTimes.value[i] = ripples[i].t;
    }

    meshRef.current.position.x = camera.position.x;
    meshRef.current.position.z = camera.position.z;
  });

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position={[0, -0.1, 0]}
      frustumCulled={false}
      renderOrder={2}
    >
      <planeGeometry args={[2000, 2000]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
