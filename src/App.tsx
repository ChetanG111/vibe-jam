import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, PerspectiveCamera } from "@react-three/drei";
import { Leva } from "leva";
import WaterFloor from "./components/WaterFloor";
import SeabedFloor from "./components/WaterFloor/components/SeabedFloor";
import { Submarine } from "./Submarine";

export function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#011a2a" }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={55} />
        
        {/* Lights */}
        <ambientLight intensity={0.8} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={2.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
        />

        {/* Anime Water System */}
        <group position={[0, 0, 0]}>
          <WaterFloor />
          <SeabedFloor 
            seabedDepthOverride={-25} 
            seabedScaleOverride={0.12} 
            colorOverride="#0a1f3c" 
            colorTopOverride="#27a3d8" 
          />
        </group>

        {/* Submarine Controller */}
        <Submarine />

        {/* Environment */}
        <Sky sunPosition={[100, 10, 100]} />
      </Canvas>

      <Leva collapsed />
    </div>
  );
}
