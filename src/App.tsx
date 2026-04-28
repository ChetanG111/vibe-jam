import { useEffect, useRef } from "react";
import { boot } from "./platform/boot";

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
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Our original vanilla game logic runs here */}
      <VanillaGame />
      
      {/* This is where we will add the new R3F Water Shader overlay later */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* We can put a Canvas here once we have the shader files */}
      </div>
    </div>
  );
}
