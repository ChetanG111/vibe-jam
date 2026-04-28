import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useControls, folder } from "leva";
import * as THREE from "three";
import { rippleStore } from "./components/WaterFloor/stores/rippleStore";

export function Submarine() {
  const meshRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF("/psx_mini_submarine.glb");
  
  // --- Simplified State ---
  const currentPos = useRef(new THREE.Vector3(0, -2, 0));
  const velocity = useRef(new THREE.Vector3());
  const currentRotation = useRef(0);
  const targetRotation = useRef(0);
  const camYaw = useRef(0);
  const lastRippleTime = useRef(0);

  // --- Keyboard State ---
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // --- Dead Simple Tuning (Leva) ---
  const config = useControls("Submarine Tuning", {
    Movement: folder({
      speed: { value: 0.25, min: 0.1, max: 1.0, step: 0.01 },
      sidewaysSpeed: { value: 0.15, min: 0.05, max: 0.5, step: 0.01 },
      acceleration: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
      drag: { value: 0.15, min: 0.01, max: 0.5, step: 0.01 },
    }),
    Rotation: folder({
      turnSpeed: { value: 0.04, min: 0.01, max: 0.1, step: 0.005 },
      turnSmoothing: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
    }),
    Vertical: folder({
      verticalSpeed: { value: 0.15, min: 0.05, max: 0.5, step: 0.01 },
      verticalSmoothing: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
    }),
    Camera: folder({
      distance: { value: 15, min: 5, max: 40, step: 1 },
      height: { value: 6, min: -5, max: 20, step: 0.5 },
      camSmoothing: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
    })
  });

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const dt = delta * 60; // Normalize to 60fps

    // 1. Translation (Forward/Backward + Strafe)
    let moveInput = 0;
    if (keys.current["KeyW"]) moveInput = 1;
    if (keys.current["KeyS"]) moveInput = -0.6;

    let sideInput = 0;
    if (keys.current["KeyA"]) sideInput = 1;
    if (keys.current["KeyD"]) sideInput = -1;

    const forwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation.current);
    const lateralDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation.current);
    
    const targetVel = forwardDir.multiplyScalar(moveInput * config.speed)
      .add(lateralDir.multiplyScalar(sideInput * config.sidewaysSpeed));
    
    // Smooth acceleration and strong drag
    velocity.current.lerp(targetVel, config.acceleration * dt);
    if (moveInput === 0 && sideInput === 0) {
      velocity.current.lerp(new THREE.Vector3(0, velocity.current.y, 0), config.drag * dt);
    }

    // 2. Turning (Yaw) - Q/E Only
    let turnInput = 0;
    if (keys.current["KeyQ"]) turnInput = 1;
    if (keys.current["KeyE"]) turnInput = -1;

    targetRotation.current += turnInput * config.turnSpeed * dt;
    currentRotation.current = THREE.MathUtils.lerp(currentRotation.current, targetRotation.current, config.turnSmoothing * dt);

    // 3. Vertical (Elevator Style)
    let vertInput = 0;
    if (keys.current["Space"]) vertInput = 1;
    if (keys.current["ShiftLeft"]) vertInput = -1;

    const targetVertVel = vertInput * config.verticalSpeed;
    velocity.current.y = THREE.MathUtils.lerp(velocity.current.y, targetVertVel, config.verticalSmoothing * dt);
    if (vertInput === 0) {
      velocity.current.y = THREE.MathUtils.lerp(velocity.current.y, 0, config.drag * dt);
    }

    // 4. Apply Everything
    currentPos.current.add(velocity.current.clone().multiplyScalar(dt));
    
    // Hard Constraint: Stay below water surface (Y=0)
    if (currentPos.current.y > 0) {
      currentPos.current.y = 0;
      velocity.current.y = Math.min(0, velocity.current.y); // Stop upward momentum
    }

    // 5. Visual Polish (Subtle tilts)
    meshRef.current.position.copy(currentPos.current);
    meshRef.current.rotation.y = currentRotation.current;
    
    // Slight tilt when moving up/down or turning
    const targetPitch = velocity.current.y * 2;
    const targetRoll = -turnInput * 0.1;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetPitch, 0.1 * dt);
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRoll, 0.1 * dt);

    // 6. Camera (Smooth Follow)
    camYaw.current = THREE.MathUtils.lerp(camYaw.current, currentRotation.current, 0.08 * dt);
    const camOffset = new THREE.Vector3(0, config.height, config.distance).applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw.current);
    const camPos = currentPos.current.clone().add(camOffset);
    
    state.camera.position.lerp(camPos, config.camSmoothing * dt);
    state.camera.lookAt(currentPos.current.x, currentPos.current.y + 1, currentPos.current.z);

    // 7. Ripples
    const t = state.clock.getElapsedTime();
    if (Math.abs(currentPos.current.y) < 1.0 && velocity.current.length() > 0.05) {
      if (t - lastRippleTime.current > 0.8) {
        rippleStore.add(currentPos.current.x, currentPos.current.z, t);
        lastRippleTime.current = t;
      }
    }
  });

  return (
    <group ref={meshRef}>
      <primitive object={scene} scale={1.5} />
    </group>
  );
}

useGLTF.preload("/psx_mini_submarine.glb");
