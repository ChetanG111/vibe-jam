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
        <fog attach="fog" args={["#3FA9F5", 10, 800]} />
        <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={55} />
        
        {/* Lights */}
        <ambientLight intensity={1.5} />
        <directionalLight 
          position={[100, 200, 100]} 
          intensity={4.0} 
          castShadow 
          shadow-mapSize={[4096, 4096]} 
          shadow-camera-left={-200}
          shadow-camera-right={200}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
        />

        {/* Anime Water System */}
        <group position={[0, 0, 0]}>
          <WaterFloor />
          <SeabedFloor 
            seabedDepthOverride={-50} 
            seabedScaleOverride={0.10} 
          />
        </group>

        <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
        <Submarine />

        {/* Environment */}
        <Sky sunPosition={[100, 10, 100]} />
      </Canvas>

      <Leva collapsed />
    </div>
  );
}
