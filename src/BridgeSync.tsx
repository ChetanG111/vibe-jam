import { useFrame } from "@react-three/fiber";
import { gameBridge } from "./bridge";

export function BridgeSync() {
  useFrame(({ camera }) => {
    if (gameBridge.camera) {
      camera.position.copy(gameBridge.camera.position);
      camera.quaternion.copy(gameBridge.camera.quaternion);
      camera.updateMatrixWorld();
    }
  });

  return null;
}
