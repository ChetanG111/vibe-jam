import { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, TransformControls } from '@react-three/drei';
import * as THREE from 'three';

const Submarine = () => {
  const { scene } = useGLTF('/psx_mini_submarine.glb');
  return <primitive object={scene} scale={1.5} />;
};

const Editor = () => {
  const [headlightPosition, setHeadlightPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 5));
  const headLightRef = useRef<THREE.Mesh>(null!);
  const transformControlsRef = useRef<any>(null!);
  const orbitControlsRef = useRef<any>(null!);

  const onTransform = (e: THREE.Event | undefined) => {
    if (e && e.target && e.target.object) {
      setHeadlightPosition(e.target.object.position.clone());
    }
  };

  useEffect(() => {
    if (transformControlsRef.current) {
      const controls = transformControlsRef.current;
      const callback = (event: any) => (orbitControlsRef.current.enabled = !event.value);
      controls.addEventListener('dragging-changed', callback);
      return () => controls.removeEventListener('dragging-changed', callback);
    }
  });

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        padding: '10px',
        background: 'rgba(0,0,0,0.5)',
        color: 'white',
        zIndex: 1,
        borderRadius: '5px'
      }}>
        Headlight Position:
        <pre>
          x: {headlightPosition.x.toFixed(4)},
          y: {headlightPosition.y.toFixed(4)},
          z: {headlightPosition.z.toFixed(4)}
        </pre>
      </div>
      <Canvas camera={{ position: [10, 10, 10] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} />
        <gridHelper args={[100, 100]} />
        <axesHelper args={[5]} />
        <Submarine />
        <TransformControls ref={transformControlsRef} object={headLightRef.current} onObjectChange={onTransform}>
          <mesh ref={headLightRef} position={headlightPosition}>
            <sphereGeometry args={[0.2]} />
            <meshBasicMaterial color="yellow" />
          </mesh>
        </TransformControls>
        <OrbitControls ref={orbitControlsRef} />
      </Canvas>
    </div>
  );
};

export default Editor;
