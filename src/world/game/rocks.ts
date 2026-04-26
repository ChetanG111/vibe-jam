import * as THREE from "three";

export function createRockFormations(count: number = 100, range: number = 800) {
  const rockGroup = new THREE.Group();
  
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x444444,      // Gray for visibility debugging
    roughness: 0.8,       // Slightly lower roughness to allow for sharper specular highlights
    metalness: 0.4,       // Higher metalness for that "metallic/obsidian" edge highlight
    flatShading: true,
    emissive: 0x000000,
  });

  const rockGeometries = [
    new THREE.IcosahedronGeometry(1, 0), // Sharp facets
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.OctahedronGeometry(1, 0),
  ];

  // We'll create "strips" of rocks to act as canyon walls
  const wallPositions = [
    { x: -30, z: 0, dir: new THREE.Vector2(0, 1) }, // Left wall
    { x: 30, z: 0, dir: new THREE.Vector2(0, 1) },  // Right wall
  ];

  for (let i = 0; i < count; i++) {
    const geo = rockGeometries[Math.floor(Math.random() * rockGeometries.length)];
    const mesh = new THREE.Mesh(geo, rockMat);

    // Randomly pick a "wall" or just scatter
    const onWall = Math.random() > 0.3;
    let x, y, z, scale;

    if (onWall) {
      const wall = wallPositions[Math.floor(Math.random() * wallPositions.length)];
      const progress = (Math.random() - 0.5) * range;
      const jitter = (Math.random() - 0.5) * 15;
      
      x = wall.x + jitter;
      z = progress;
      scale = 10 + Math.random() * 40;
      y = -97 + (scale * 0.4); // Floor depth is -97
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * (range * 0.5);
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;
      scale = 5 + Math.random() * 20;
      y = -97 + (scale * 0.4);
    }

    mesh.position.set(x, y, z);
    mesh.scale.set(
      scale * (0.8 + Math.random() * 0.5),
      scale * (1.5 + Math.random() * 1.5), // Extra vertical stretch for walls
      scale * (0.8 + Math.random() * 0.5)
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    
    rockGroup.add(mesh);
  }

  return rockGroup;
}
