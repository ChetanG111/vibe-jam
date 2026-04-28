import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, Sky, KeyboardControls } from "@react-three/drei";
import { useControls, folder, Leva } from "leva";
import WaterFloor from "./components/WaterFloor";
import SeabedFloor from "./components/WaterFloor/components/SeabedFloor";
import Rocks from "./components/WaterFloor/components/Rocks";
import { Submarine } from "./Submarine";
import Editor from "./pages/Editor";

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "up", keys: ["Space"] },
  { name: "down", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "turnLeft", keys: ["KeyQ"] },
  { name: "turnRight", keys: ["KeyE"] },
];

const MainScene = () => {
  const { ambient, sun } = useControls("Environment", {
    ambient: { value: 0.12, min: 0, step: 0.01 }, 
    sun: { value: 0.5, min: 0, step: 0.01 },
  });

  const { fogType, fogColor, fogNear, fogFar, fogDensity } = useControls("Fog Settings", {
    fogType: { value: "linear", options: ["linear", "exp2"], label: "Type" },
    fogColor: { value: "#042c48", label: "Color" }, 
    fogNear: { value: 0, min: 0, max: 1000, step: 1, label: "Start (Radius)", render: (get) => get("Fog Settings.fogType") === "linear" },
    fogFar: { value: 1000, min: 10, max: 5000, step: 10, label: "End (Distance)", render: (get) => get("Fog Settings.fogType") === "linear" },
    fogDensity: { value: 0.005, min: 0, max: 0.1, step: 0.0001, label: "Intensity (Density)", render: (get) => get("Fog Settings.fogType") === "exp2" },
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Leva collapsed />
      <KeyboardControls map={keyboardMap}>
        <Canvas shadows camera={{ far: 10000 }}>
          <color attach="background" args={[fogColor]} />
          {fogType === "linear" ? (
            <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
          ) : (
            <fogExp2 attach="fog" args={[fogColor, fogDensity]} />
          )}
          <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={55} />
          
          <ambientLight intensity={ambient} />
          
          <spotLight
            position={[0, 400, 0]}
            intensity={sun * 300}
            angle={0.8}
            penumbra={1}
            castShadow
            color="#b8e8ff"
            distance={1000}
            decay={1}
          />

          <group position={[0, 0, 0]}>
            {/* Ocean Surface (looking up) */}
            <group position={[0, 50, 0]}>
              <WaterFloor 
                fadeDistanceOverride={fogType === "linear" ? fogFar * 2 : 2.0 / fogDensity} 
                deepOpacityOverride={0.4}
              />
            </group>

            {/* Seabed */}
            <SeabedFloor 
              seabedDepthOverride={-60} 
            />
            <Rocks seabedDepthOverride={-60} />
          </group>

          <Submarine />
        </Canvas>
      </KeyboardControls>
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
