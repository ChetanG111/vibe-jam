import * as THREE from "three";

export function setupEnvironment(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0x7aa2ff, 0.22);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0x9bd7ff, 0.9);
  key.position.set(25, 35, 15);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6ee7ff, 0.35);
  rim.position.set(-20, 14, -25);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      metalness: 0.0,
      roughness: 1.0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -18;
  scene.add(floor);

  // "Water surface" just for visual reference in this step (no depth caps yet).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0b2a3a,
      metalness: 0.0,
      roughness: 0.15,
      transparent: true,
      opacity: 0.18,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 8;
  scene.add(water);

  addRandomProps(scene);
}

export function addRandomProps(scene: THREE.Scene) {
  const count = 80;
  const range = 240;
  const cubeGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const sphereGeo = new THREE.SphereGeometry(0.7, 12, 12);
  
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0xff9d6e, // Warm orange
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0xff9d6e,
    emissiveIntensity: 0.5,
  });
  
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x6ee7ff, // Bright cyan
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x6ee7ff,
    emissiveIntensity: 0.8,
  });

  for (let i = 0; i < count; i++) {
    const isCube = Math.random() > 0.5;
    const mesh = new THREE.Mesh(isCube ? cubeGeo : sphereGeo, isCube ? cubeMat : sphereMat);
    
    mesh.position.set(
      (Math.random() - 0.5) * range,
      (Math.random() - 0.5) * 40 - 2, // Distributed around the sub depth
      (Math.random() - 0.5) * range
    );
    
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    const scale = 0.4 + Math.random() * 2.5;
    mesh.scale.setScalar(scale);
    
    scene.add(mesh);
  }
}
