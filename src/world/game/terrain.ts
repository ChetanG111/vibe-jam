import * as THREE from "three";
import { fBm } from "./noise";
import { createUnderwaterMaterial } from "./underwaterMaterial";

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

  const material = createUnderwaterMaterial();

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

export interface RockOptions {
  count: number;
  range: number;
  minSize: number;
  maxSize: number;
  randomness: number;
}

export function createRockFormations(options: RockOptions) {
  const { count, range, minSize, maxSize, randomness } = options;
  const rockGroup = new THREE.Group();

  const rockMat = createUnderwaterMaterial();
  // Adjust rock material slightly if needed via uniforms
  rockMat.uniforms.causticIntensity.value = 0.4;
  rockMat.uniforms.baseColor.value = new THREE.Color(0x222222);

  const wallPositions = [
    { x: -35, z: 0 },
    { x: 35, z: 0 },
  ];

  for (let i = 0; i < count; i++) {
    // Randomize detail per rock (0 or 1)
    const detail = Math.random() > 0.5 ? 1 : 0;

    // Randomize shape type
    const rockGeometries = [
      new THREE.IcosahedronGeometry(1, detail),
      new THREE.DodecahedronGeometry(1, detail),
      new THREE.OctahedronGeometry(1, detail),
    ];
    const geo = rockGeometries[Math.floor(Math.random() * rockGeometries.length)];
    const mesh = new THREE.Mesh(geo, rockMat);

    const onWall = Math.random() > randomness;
    let x, y, z, scale;

    if (onWall) {
      const wall = wallPositions[Math.floor(Math.random() * wallPositions.length)];
      const progress = (Math.random() - 0.5) * range;
      const wallJitter = (Math.random() - 0.5) * 20;
      x = wall.x + wallJitter;
      z = progress;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * (range * 0.4);
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;
    }

    scale = minSize + Math.random() * (maxSize - minSize);
    y = -97 + (scale * 0.4);

    mesh.position.set(x, y, z);

    const rockJitter = 0.5 + Math.random() * 0.3;
    const sx = scale * (1.0 + (Math.random() - 0.5) * rockJitter);
    const sy = scale * (1.0 + (Math.random() - 0.5) * rockJitter * 2.0);
    const sz = scale * (1.0 + (Math.random() - 0.5) * rockJitter);

    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rockGroup.add(mesh);
  }

  return rockGroup;
}
