"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VERT } from "./shaders/vertex";
import { FRAG } from "./shaders/fragment";
import { useSeabedControls } from "./utils/controls";
import { submarineStore } from "../../../../stores/submarineStore";

// ─────────────────────────────────────────────────────────────────────────────
// SeabedFloor — animated Voronoi seabed visible through the transparent
// deep-color areas of WaterFloor. Slower than the surface → parallax depth.
//
// renderOrder = 0  (before WaterFloor at renderOrder = 1)
// ─────────────────────────────────────────────────────────────────────────────

interface SeabedFloorProps {
  seabedDepthOverride?: number;
  seabedScaleOverride?: number;
  colorOverride?: string;
  colorTopOverride?: string;
  fadeDistanceOverride?: number;
  fadeStrengthOverride?: number;
}

export default function SeabedFloor({
  seabedDepthOverride,
  seabedScaleOverride,
  colorOverride,
  colorTopOverride,
  fadeDistanceOverride,
  fadeStrengthOverride,
}: SeabedFloorProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const {
    seabedDepth,
    seabedScale,
    cellSpeed,
    flowX,
    flowZ,
    edgeThreshold,
    edgeSoftness,
    deepColor,
    highlightColor,
    fadeDistance,
    fadeStrength,
  } = useSeabedControls();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent:  true,
        depthWrite:   false,
        side:         THREE.FrontSide,
        vertexShader:   VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime:          { value: 0 },
          uScale:         { value: 0.2 },
          uCellSpeed:     { value: 0.18 },
          uFlowX:         { value: 0.035 },
          uFlowZ:         { value: -0.11 },
          uEdgeThreshold: { value: 0.06 },
          uEdgeSoftness:  { value: 0.04 },
          uDeepColor:     { value: new THREE.Color("#1E3A4A") },
          uHighlight:     { value: new THREE.Color("#1E3A4A") },
          uFadeDistance:  { value: 1500.0 },
          uFadeStrength:  { value: 1.5 },
          uCamXZ:         { value: new THREE.Vector2() },
          // Headlight
          uSubPos:              { value: new THREE.Vector3() },
          uSubForward:          { value: new THREE.Vector3(0, 0, -1) },
          uHeadlightColor:      { value: new THREE.Color(0.72, 0.91, 1.0) },
          uHeadlightIntensity:  { value: 12.0 },
          uHeadlightDistance:   { value: 30.0 },
          uHeadlightAngle:      { value: 0.32 },
          uHeadlightPenumbra:   { value: 0.4 },
          uHeadlightOn:         { value: 1.0 },
          // Camera Light
          uCamPos3:             { value: new THREE.Vector3() },
          uCamLightColor:       { value: new THREE.Color(1, 1, 1) },
          uCamLightIntensity:   { value: 5.0 },
          uCamLightDistance:    { value: 100.0 },
          uCamLightOn:          { value: 1.0 },
        },
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }, delta) => {
    const u = material.uniforms;
    u.uTime.value         += delta;
    u.uScale.value         = seabedScaleOverride ?? seabedScale;
    u.uCellSpeed.value     = cellSpeed;
    u.uFlowX.value         = flowX;
    u.uFlowZ.value         = flowZ;
    u.uEdgeThreshold.value = edgeThreshold;
    u.uEdgeSoftness.value  = edgeSoftness;
    u.uDeepColor.value.set(colorOverride    ?? deepColor);
    u.uHighlight.value.set(colorTopOverride ?? highlightColor);
    u.uFadeDistance.value  = fadeDistanceOverride ?? fadeDistance;
    u.uFadeStrength.value  = fadeStrengthOverride ?? fadeStrength;
    u.uCamXZ.value.set(camera.position.x, camera.position.z);

    // Headlight — read from the shared submarine store
    const sl = submarineStore;
    u.uSubPos.value.set(sl.position.x, sl.position.y, sl.position.z);
    u.uSubForward.value.set(sl.forward.x, sl.forward.y, sl.forward.z);
    u.uHeadlightColor.value.setRGB(sl.headlight.color.r, sl.headlight.color.g, sl.headlight.color.b);
    u.uHeadlightIntensity.value = sl.headlight.intensity;
    u.uHeadlightDistance.value  = sl.headlight.distance;
    u.uHeadlightAngle.value     = sl.headlight.angle;
    u.uHeadlightPenumbra.value  = sl.headlight.on ? 0.4 : 0;
    u.uHeadlightOn.value        = sl.headlight.on ? 1.0 : 0.0;

    // Camera Light
    u.uCamPos3.value.set(sl.camera.position.x, sl.camera.position.y, sl.camera.position.z);
    u.uCamLightColor.value.setRGB(sl.camera.color.r, sl.camera.color.g, sl.camera.color.b);
    u.uCamLightIntensity.value = sl.camera.intensity;
    u.uCamLightDistance.value  = sl.camera.distance;
    u.uCamLightOn.value        = sl.camera.on ? 1.0 : 0.0;

    meshRef.current.position.x = camera.position.x;
    meshRef.current.position.z = camera.position.z;
    meshRef.current.position.y = seabedDepthOverride ?? seabedDepth;
  });

  return (
    <mesh
      ref={meshRef}
      rotation-x={-Math.PI / 2}
      position={[0, -3.5, 0]}
      frustumCulled={false}
      renderOrder={0}
      receiveShadow
    >
      <planeGeometry args={[2000, 2000, 200, 200]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
