import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, PerspectiveCamera } from "@react-three/drei";
import { Leva } from "leva";
import WaterFloor from "./components/WaterFloor";
import SeabedFloor from "./components/WaterFloor/components/SeabedFloor";
import { SphereRippleEmitter } from "./SphereRippleEmitter";

export function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#011a2a" }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={55} />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2} />
        
        {/* Lights */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
        />

        {/* Anime Water System */}
        <group position={[0, 0, 0]}>
          <WaterFloor />
          <SeabedFloor 
            seabedDepthOverride={-15} 
            seabedScaleOverride={0.15} 
            colorOverride="#1a3a5c" 
            colorTopOverride="#59c0e8" 
          />
        </group>

        {/* Environment */}
        <Sky sunPosition={[100, 10, 100]} />
        
        {/* Placeholder for future Submarine */}
        <group position={[0, -2, 0]}>
          <mesh>
            <sphereGeometry args={[2, 32, 32]} />
            <meshStandardMaterial color="orange" />
          </mesh>
          <SphereRippleEmitter position={[0, -2, 0]} />
        </group>
      </Canvas>

      <Leva collapsed />
    </div>
  );
}
