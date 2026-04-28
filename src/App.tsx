import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, Sky } from "@react-three/drei";
import { useControls, folder, Leva } from "leva";
import WaterFloor from "./components/WaterFloor";
import SeabedFloor from "./components/WaterFloor/components/SeabedFloor";
import { Submarine } from "./Submarine";
import Editor from "./pages/Editor";

const MainScene = () => {
  const { ambient, sun, fogColor, fogNear, fogFar, skyTurbidity, skyRayleigh } = useControls("Environment", {
    ambient: { value: 0.6, min: 0 },
    sun: { value: 2.0, min: 0 },
    fogColor: "#0A2A3A",
    fogNear: { value: 100, min: 0 },
    fogFar: { value: 1500, min: 500 },
    skyTurbidity: { value: 0.1, min: 0 },
    skyRayleigh: { value: 0.0, min: 0 },
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#3FA9F5" }}>
      <Leva collapsed />
      <Canvas shadows>
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
        <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={55} />
        
        {/* Lights */}
        <ambientLight intensity={ambient} />
        <directionalLight 
          position={[100, 500, 100]} 
          intensity={sun} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-left={-500}
          shadow-camera-right={500}
          shadow-camera-top={500}
          shadow-camera-bottom={-500}
        />

        {/* Anime Water System */}
        <group position={[0, 0, 0]}>
          <WaterFloor />
          <SeabedFloor 
            seabedDepthOverride={-60} 
            seabedScaleOverride={0.10} 
          />
        </group>

        <Sky sunPosition={[100, 100, 100]} turbidity={skyTurbidity} rayleigh={skyRayleigh} mieCoefficient={0.005} mieDirectionalG={0.8} />
        <Submarine />
      </Canvas>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainScene />} />
        {import.meta.env.DEV && <Route path="/editor" element={<Editor />} />}
      </Routes>
    </BrowserRouter>
  );
}
