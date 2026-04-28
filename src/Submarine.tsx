import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { useControls, folder } from "leva";
import * as THREE from "three";
import { rippleStore } from "./components/WaterFloor/stores/rippleStore";
import { submarineStore } from "./stores/submarineStore";

export function Submarine() {
  const meshRef = useRef<THREE.Group>(null!);
  const camLightRef = useRef<THREE.PointLight>(null!);
  const groundLightRef = useRef<THREE.PointLight>(null!);
  const { scene } = useGLTF("/psx_mini_submarine.glb");
  const [subscribeKeys, getKeys] = useKeyboardControls();
  
  const currentPos = useRef(new THREE.Vector3(0, -2, 0));
  const velocity = useRef(new THREE.Vector3());
  const currentRotation = useRef(0);
  const targetRotation = useRef(0);
  const camYaw = useRef(0);
  const lastRippleTime = useRef(0);
  const firstFrame = useRef(true);

  const lightTarget = useRef(new THREE.Object3D());

  const config = useControls("Submarine Tuning", {
    Movement: folder({
      speed: { value: 0.25, min: 0.1, step: 0.01 },
      sidewaysSpeed: { value: 0.15, min: 0.05, step: 0.01 },
      acceleration: { value: 0.1, min: 0.01, step: 0.01 },
      drag: { value: 0.15, min: 0.01, step: 0.01 },
    }),
    Rotation: folder({
      turnSpeed: { value: 0.04, min: 0.01, step: 0.005 },
      turnSmoothing: { value: 0.1, min: 0.01, step: 0.01 },
    }),
    Vertical: folder({
      verticalSpeed: { value: 0.15, min: 0.05, step: 0.01 },
      verticalSmoothing: { value: 0.1, min: 0.01, step: 0.01 },
    }),
    Camera: folder({
      distance: { value: 37, min: 5, step: 1 },
      height: { value: 16.0, min: -5, step: 0.5 },
      camSmoothing: { value: 0.1, min: 0.01, step: 0.01 },
    }),
    Headlight: folder({
      headlightOn:        { value: true,      label: "On" },
      headlightColor:     { value: "#b8e8ff", label: "Color" },
      headlightIntensity: { value: 0.3,      min: 0,    step: 0.1,  label: "Intensity" },
      headlightReach:     { value: 370,      min: 100,  max: 10000, step: 10,   label: "Reach (Distance)" },
      headlightTilt:      { value: -0.15,    min: -1,   max: 1,     step: 0.01, label: "Tilt Up/Down" },
      headlightAngle:     { value: 1.14,     min: 0.05, max: 1.5,   step: 0.01, label: "Zoom (Angle)" },
      headlightPenumbra:  { value: 1.0,      min: 0,    max: 1,     step: 0.05, label: "Edge Softness" },
      headlightOffset:    { value: { x: 0, y: 0.0949, z: 5.9796 }, step: 0.1, label: "Nose Offset" },
    }),
    CameraLight: folder({
      camLightOn:        { value: true,      label: "On" },
      camLightColor:     { value: "#ffffff", label: "Color" },
      camLightIntensity: { value: 0.2,      min: 0,    step: 0.1,  label: "Intensity" },
      camLightDistance:  { value: 260,      min: 10,   max: 10000, step: 10,   label: "Reach (Distance)" },
    }),
  });

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const dt = delta * 60;
    const keys = getKeys();

    // 1. Translation
    let moveInput = 0;
    if (keys.forward) moveInput = 1;
    if (keys.backward) moveInput = -0.6;
    let sideInput = 0;
    if (keys.left) sideInput = 1;
    if (keys.right) sideInput = -1;

    const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation.current);
    const lateralDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation.current);
    
    // Calculate target horizontal velocity (X and Z only)
    const targetVelH = forwardDir.clone().multiplyScalar(moveInput * config.speed)
        .add(lateralDir.multiplyScalar(sideInput * config.sidewaysSpeed));
    
    // Apply horizontal movement (acceleration or drag)
    const horizRate = (moveInput === 0 && sideInput === 0) ? config.drag : config.acceleration;
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, targetVelH.x, horizRate * dt);
    velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, targetVelH.z, horizRate * dt);

    // 2. Turning
    let turnInput = 0;
    if (keys.turnLeft) turnInput = 1;
    if (keys.turnRight) turnInput = -1;
    targetRotation.current += turnInput * config.turnSpeed * dt;
    currentRotation.current = THREE.MathUtils.lerp(currentRotation.current, targetRotation.current, config.turnSmoothing * dt);

    // 3. Vertical
    let vertInput = 0;
    if (keys.up) vertInput = 1;
    if (keys.down) vertInput = -1;
    const targetVertVel = vertInput * config.verticalSpeed;
    const vertRate = vertInput === 0 ? config.drag : config.verticalSmoothing;
    velocity.current.y = THREE.MathUtils.lerp(velocity.current.y, targetVertVel, vertRate * dt);

    // 4. Apply & Clamp
    currentPos.current.add(velocity.current.clone().multiplyScalar(dt));
    
    // Surface clamp (Water surface is at y=50)
    if (currentPos.current.y > 50) { 
      currentPos.current.y = 50; 
      velocity.current.y = Math.min(0, velocity.current.y); 
    }
    // Floor clamp (Seabed is at y=-60, so -55 is a safe floor)
    if (currentPos.current.y < -55) {
      currentPos.current.y = -55;
      velocity.current.y = Math.max(0, velocity.current.y);
    }

    // 5. Visuals
    meshRef.current.position.copy(currentPos.current);
    meshRef.current.rotation.y = currentRotation.current;
    const targetPitch = velocity.current.y * 2;
    const targetRoll = -turnInput * 0.1;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetPitch, 0.1 * dt);
    meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRoll, 0.1 * dt);

    // 6. Camera
    camYaw.current = THREE.MathUtils.lerp(camYaw.current, currentRotation.current, 0.08 * dt);
    const camOffset = new THREE.Vector3(0, config.height, -config.distance).applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw.current);
    const camPos = currentPos.current.clone().add(camOffset);
    state.camera.position.lerp(camPos, config.camSmoothing * dt);
    if (firstFrame.current) { state.camera.position.copy(camPos); firstFrame.current = false; }
    state.camera.lookAt(currentPos.current.x, currentPos.current.y + 1, currentPos.current.z);

    // 7. Balanced Lighting System
    if (camLightRef.current && groundLightRef.current) {
      camLightRef.current.position.copy(state.camera.position);
      groundLightRef.current.position.set(currentPos.current.x, currentPos.current.y - 15, currentPos.current.z);
    }

    // 8. Store Update
    meshRef.current.updateMatrix();
    const subMatrix = new THREE.Matrix4().compose(currentPos.current, meshRef.current.quaternion, new THREE.Vector3(1, 1, 1));
    const modelToWorld = subMatrix;
    const nosePos = new THREE.Vector3(0, 0.0949, 5.9796).applyMatrix4(modelToWorld);
    submarineStore.position.x = nosePos.x; submarineStore.position.y = nosePos.y; submarineStore.position.z = nosePos.z;
    const forwardVec = new THREE.Vector3(0, 0, 1).transformDirection(modelToWorld);
    submarineStore.forward.x = forwardVec.x; submarineStore.forward.y = forwardVec.y; submarineStore.forward.z = forwardVec.z;
    
    // Headlight target logic with current TILT default
    const reach = 1000;
    const targetOffset = new THREE.Vector3(0, config.headlightTilt * reach, reach).applyMatrix4(modelToWorld);
    lightTarget.current.position.copy(targetOffset);
  });

  return (
    <>
      <primitive object={lightTarget.current} />
      <group ref={meshRef}>
        <primitive object={scene} scale={1.5} />
        <spotLight
          castShadow
          intensity={config.headlightOn ? config.headlightIntensity * 100 : 0}
          distance={config.headlightReach}
          angle={config.headlightAngle}
          penumbra={config.headlightPenumbra}
          color={config.headlightColor}
          position={[0, 0.0949, 5.9796]}
          target={lightTarget.current}
          shadow-mapSize={[1024, 1024]}
          decay={0}
        />
      </group>
      
      <pointLight
        ref={camLightRef}
        intensity={config.camLightOn ? config.camLightIntensity * 10 : 0}
        distance={config.camLightDistance}
        color={config.camLightColor}
        decay={0}
      />

      <pointLight
        ref={groundLightRef}
        intensity={config.camLightOn ? config.camLightIntensity * 20 : 0}
        distance={config.camLightDistance}
        color={config.camLightColor}
        decay={0}
      />
    </>
  );
}

useGLTF.preload("/psx_mini_submarine.glb");
