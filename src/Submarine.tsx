import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, PerspectiveCamera } from "@react-three/drei";
import { useControls, folder } from "leva";
import * as THREE from "three";
import { rippleStore } from "./components/WaterFloor/stores/rippleStore";

export function Submarine() {
  const meshRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF("/psx_mini_submarine.glb");
  
  // --- Physics State ---
  const velocity = useRef(new THREE.Vector3());
  const angularVelocity = useRef(0);
  const currentRotation = useRef(0);
  const currentPosition = useRef(new THREE.Vector3(0, -2, 0));
  const lastRippleTime = useRef(0);
  const camYaw = useRef(0);

  // --- Keyboard State ---
  const keys = useRef<Record<string, boolean>>({});
  useMemo(() => {
    window.addEventListener("keydown", (e) => (keys.current[e.code] = true));
    window.addEventListener("keyup", (e) => (keys.current[e.code] = false));
  }, []);

  // --- Tuning Playground (Leva) ---
  const config = useControls("Submarine Tuning", {
    Translation: folder({
      maxSpeed: { value: 0.15, min: 0.01, max: 0.5, step: 0.01 },
      accelerationRate: { value: 0.005, min: 0.001, max: 0.05, step: 0.001 },
      drag: { value: 0.02, min: 0.001, max: 0.1, step: 0.001 },
      inertia: { value: 0.95, min: 0.8, max: 0.99, step: 0.01 },
      engineRampUp: { value: 0.5, min: 0, max: 2, step: 0.1 },
    }),
    Rotation: folder({
      maxTurnRate: { value: 0.02, min: 0.005, max: 0.1, step: 0.005 },
      angularAccel: { value: 0.001, min: 0.0001, max: 0.01, step: 0.0001 },
      angularDrag: { value: 0.05, min: 0.01, max: 0.2, step: 0.01 },
      turnMomentum: { value: 0.92, min: 0.8, max: 0.99, step: 0.01 },
    }),
    Vertical: folder({
      buoyancy: { value: 0.001, min: 0, max: 0.02, step: 0.0001 },
      diveForce: { value: 0.008, min: 0, max: 0.02, step: 0.001 },
      neutralBuoyancyOffset: { value: 0, min: -50, max: 10, step: 0.5 },
      verticalDrag: { value: 0.05, min: 0.01, max: 0.2, step: 0.01 },
    }),
    Polish: folder({
      driftAmount: { value: 0.5, min: 0, max: 2, step: 0.1 },
      swayIntensity: { value: 0.02, min: 0, max: 0.1, step: 0.01 },
      swaySpeed: { value: 1.5, min: 0, max: 5, step: 0.1 },
    })
  });

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const dt = delta * 60; // Normalize to 60fps for easier tuning

    // 1. Calculate Thrust Input
    let thrust = 0;
    if (keys.current["KeyW"]) thrust = 1;
    if (keys.current["KeyS"]) thrust = -0.5;

    // 2. Linear Movement (Inertia-first)
    // Non-linear ramp up simulated by lerping towards desired thrust
    const forwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation.current);
    const targetVelocity = forwardDir.multiplyScalar(thrust * config.maxSpeed);
    
    // Apply Acceleration & Drag
    velocity.current.lerp(targetVelocity, config.accelerationRate * dt);
    velocity.current.multiplyScalar(Math.pow(1 - config.drag, dt));

    // 3. Rotation (Syrup-steering)
    let turnInput = 0;
    if (keys.current["KeyA"] || keys.current["KeyQ"]) turnInput = 1;
    if (keys.current["KeyD"] || keys.current["KeyE"]) turnInput = -1;

    const targetAngularVel = turnInput * config.maxTurnRate;
    angularVelocity.current = THREE.MathUtils.lerp(angularVelocity.current, targetAngularVel, config.angularAccel * dt);
    angularVelocity.current *= Math.pow(1 - config.angularDrag, dt);
    currentRotation.current += angularVelocity.current * dt;

    // 4. Vertical (Negotiating Buoyancy)
    let verticalInput = 0;
    if (keys.current["Space"]) verticalInput = 1;
    if (keys.current["ShiftLeft"]) verticalInput = -1;

    // Buoyancy: A constant upward pressure + a very weak "return to surface" urge
    const buoyancyBase = config.buoyancy; 
    const buoyancySpring = (currentPosition.current.y - config.neutralBuoyancyOffset) * 0.0001; // Extremely weak
    const diveEffect = verticalInput * config.diveForce;

    velocity.current.y += (buoyancyBase + diveEffect - buoyancySpring) * dt;
    velocity.current.y *= Math.pow(1 - config.verticalDrag, dt);

    // 5. Apply Movement
    currentPosition.current.add(velocity.current.clone().multiplyScalar(dt));
    
    // 6. Polish: Drift & Sway
    // Sideways drift during turns
    const lateralDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation.current);
    const driftForce = lateralDir.multiplyScalar(-angularVelocity.current * config.driftAmount);
    currentPosition.current.add(driftForce.multiplyScalar(dt));

    // Subtle Idle Sway
    const sway = Math.sin(state.clock.elapsedTime * config.swaySpeed) * config.swayIntensity;
    const swayRot = Math.cos(state.clock.elapsedTime * config.swaySpeed * 0.8) * config.swayIntensity * 0.5;

    // 7. Update Mesh
    meshRef.current.position.copy(currentPosition.current);
    meshRef.current.position.y += sway;
    meshRef.current.rotation.y = currentRotation.current;
    meshRef.current.rotation.x = velocity.current.y * 2 + swayRot; // Tilt when diving
    meshRef.current.rotation.z = -angularVelocity.current * 5; // Bank when turning

    // 8. Ripple Integration
    const t = state.clock.getElapsedTime();
    const isAtSurface = Math.abs(currentPosition.current.y) < 1.5;
    const speed = velocity.current.length();
    
    if (isAtSurface && (speed > 0.02 || Math.abs(angularVelocity.current) > 0.005)) {
      const interval = Math.max(0.5, 1.5 - speed * 5);
      if (t - lastRippleTime.current > interval) {
        rippleStore.add(currentPosition.current.x, currentPosition.current.z, t);
        lastRippleTime.current = t;
      }
    }

    // 9. Inertial Follow Camera
    // Camera smoothly lerps its orientation to follow the sub, but with "syrup" lag
    camYaw.current = THREE.MathUtils.lerp(camYaw.current, currentRotation.current, 0.04 * dt);

    const camOffset = new THREE.Vector3(0, 6, 15).applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw.current);
    const camPos = currentPosition.current.clone().add(camOffset);
    
    state.camera.position.lerp(camPos, 0.08 * dt);
    state.camera.lookAt(currentPosition.current.x, currentPosition.current.y + 1, currentPosition.current.z);
  });

  return (
    <group ref={meshRef}>
      <primitive object={scene} scale={1.5} />
    </group>
  );
}

useGLTF.preload("/psx_mini_submarine.glb");
