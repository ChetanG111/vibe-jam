import * as THREE from "three";
import { fBm } from "./noise";

export interface TerrainOptions {
  size: number;
  segments: number;
  heightScale: number;
  noiseScale: number;
}

export function createOceanFloor(options: TerrainOptions) {
  const { size, segments, heightScale, noiseScale } = options;
  
  // Use a PlaneGeometry with specified segments
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  
  // Rotate to be horizontal
  geometry.rotateX(-Math.PI / 2);
  
  const positions = geometry.attributes.position.array;
  const colors = [];
  
  const deepColor = new THREE.Color(0x0a1020);   // Dark Indigo
  const midColor = new THREE.Color(0x1a3a5a);    // Muted Blue
  const peakColor = new THREE.Color(0xcca35e);   // Sandy Gold
  
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    
    // Sample noise for height
    // We offset the input to avoid symmetry around origin
    const h = fBm(x * noiseScale + 123.4, z * noiseScale + 567.8, 5, 0.5);
    
    // Apply a curve to make trenches deeper and peaks sharper
    const displacedHeight = Math.pow(h, 1.5) * heightScale;
    
    // Set the Y position
    positions[i + 1] = displacedHeight;
    
    // Calculate color based on height
    const color = new THREE.Color();
    if (h < 0.4) {
      color.lerpColors(deepColor, midColor, h / 0.4);
    } else {
      color.lerpColors(midColor, peakColor, (h - 0.4) / 0.6);
    }
    
    colors.push(color.r, color.g, color.b);
  }
  
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true, // This is key for the low-poly look!
    metalness: 0.1,
    roughness: 0.8,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "oceanFloor";
  
  function regenerate(newOptions: Partial<TerrainOptions>) {
    Object.assign(options, newOptions);
    const { size, segments, heightScale, noiseScale } = options;
    
    const newGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    newGeo.rotateX(-Math.PI / 2);
    
    const pos = newGeo.attributes.position.array;
    const cols = [];
    
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2];
      const h = fBm(x * noiseScale + 123.4, z * noiseScale + 567.8, 5, 0.5);
      const dh = Math.pow(h, 1.5) * heightScale;
      pos[i + 1] = dh;
      
      const color = new THREE.Color();
      if (h < 0.4) color.lerpColors(deepColor, midColor, h / 0.4);
      else color.lerpColors(midColor, peakColor, (h - 0.4) / 0.6);
      cols.push(color.r, color.g, color.b);
    }
    
    newGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    newGeo.computeVertexNormals();
    
    mesh.geometry.dispose();
    mesh.geometry = newGeo;
    
    // Update wireframe overlay
    if (wireMesh) {
      wireMesh.geometry.dispose();
      wireMesh.geometry = new THREE.WireframeGeometry(newGeo);
    }
  }

  const wireGeo = new THREE.WireframeGeometry(geometry);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x6ee7ff, // Soft cyan/indigo instead of harsh white
    transparent: true,
    opacity: 0.06, // Very faded default
    depthWrite: false,
  });
  const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
  mesh.add(wireMesh);

  return {
    mesh,
    wireMat,
    options,
    regenerate,
    getHeight: (x: number, z: number) => {
      const { heightScale, noiseScale } = options;
      const h = fBm(x * noiseScale + 123.4, z * noiseScale + 567.8, 5, 0.5);
      return Math.pow(h, 1.5) * heightScale;
    }
  };
}
