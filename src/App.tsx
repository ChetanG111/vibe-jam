import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { boot } from "./platform/boot";
import WaterFloor from "./components/WaterFloor";
import { BridgeSync } from "./BridgeSync";

function VanillaGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (mountRef.current && !initialized.current) {
      initialized.current = true;
      boot(mountRef.current).catch(console.error);
    }
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}

export function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#011a2a" }}>
      {/* Vanilla Game Layer */}
      <VanillaGame />
      
      {/* R3F Water Layer */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <Canvas 
          camera={{ fov: 55, near: 0.1, far: 1200 }} 
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0); // Transparent canvas
          }}
        >
          <BridgeSync />
          <ambientLight intensity={1} />
          {/* We'll position the water at Y=8 to match the original level */}
          <group position={[0, 8, 0]}>
            <WaterFloor />
          </group>
        </Canvas>
      </div>

      <Leva collapsed />
    </div>
  );
}
