import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { boot } from "./platform/boot";
import WaterFloor from "./components/WaterFloor";
import SeabedFloor from "./components/WaterFloor/components/SeabedFloor";
import { BridgeSync } from "./BridgeSync";
import { SubmarineRippleEmitter } from "./SubmarineRippleEmitter";

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
      {/* Vanilla Game Layer (Now hosting its own R3F components) */}
      <VanillaGame />
      <Leva collapsed />
    </div>
  );
}
