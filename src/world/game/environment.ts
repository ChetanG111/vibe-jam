import * as THREE from "three";
import { createOceanFloor, createRockFormations } from "./terrain";
import { createSky } from "./sky";

export function setupEnvironment(scene: THREE.Scene) {
  const sky = createSky();
  scene.add(sky.mesh);

  // Total Darkness: Removing or zeroing out global lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.5); // Increased for visibility
  scene.add(ambient);

  const terrain = createOceanFloor({
    size: 2000,
    segments: 250, // Matches screenshot
    heightScale: 70, // Matches screenshot
    noiseScale: 0.008, // Matches screenshot
  });

  terrain.mesh.position.y = -97; // Matches screenshot
  scene.add(terrain.mesh);

  const rocks = createRockFormations({
    count: 800,
    range: 2000,
    minSize: 6,
    maxSize: 25,
    randomness: 0.3
  });
  rocks.name = "rockGroup";
  scene.add(rocks);

  scene.fog = new THREE.FogExp2(0x011a2a, 0.005); 

  // --- God Rays ---
  const rayGroup = new THREE.Group();
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0x6ac3fb,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  for (let i = 0; i < 12; i++) {
    const rayGeo = new THREE.CylinderGeometry(0.5, 8, 300, 16, 1, true);
    rayGeo.translate(0, -150, 0);
    const ray = new THREE.Mesh(rayGeo, rayMat);
    
    ray.position.set(
      (Math.random() - 0.5) * 500,
      200,
      (Math.random() - 0.5) * 500
    );
    
    ray.rotation.x = Math.PI + (Math.random() - 0.5) * 0.4;
    ray.rotation.z = (Math.random() - 0.5) * 0.4;
    
    rayGroup.add(ray);
  }
  scene.add(rayGroup);

  // Custom Stylized Cartoon Water Shader
  const waterGeometry = new THREE.PlaneGeometry(2000, 2000, 256, 256); // High density for smooth waves
  const waterUniforms = {
    time: { value: 0 },
    waterColor: { value: new THREE.Color(0x053355) }, // Deep vibrant blue
    foamColor: { value: new THREE.Color(0xffffff) },
    sunDir: { value: new THREE.Vector3(0.5, 0.8, -0.2).normalize() },
  };

  const waterVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform float time;
    
    void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Mathematical Stylized Waves: y = sin(x + time) * cos(z + time)
        // Note: Plane is rotated, so 'pos.z' is the vertical displacement
        float wave = sin(pos.x * 0.1 + time) * cos(pos.y * 0.1 + time) * 1.2;
        pos.z += wave;
        
        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const waterFragmentShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform float time;
    uniform vec3 waterColor;
    uniform vec3 foamColor;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
        vec3 finalColor = waterColor;

        // Stylized Highlights (Sparkles/Foam)
        // Use a "Step" function on noise texture. If noise > 0.9, color it white.
        vec2 uv = vWorldPosition.xz * 0.1;
        float n = noise(uv + time * 0.2);
        float highlight = step(0.9, n);
        
        finalColor = mix(finalColor, foamColor, highlight);

        gl_FragColor = vec4(finalColor, 0.9);
    }
  `;

  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
  });

  const water = new THREE.Mesh(waterGeometry, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 8;
  scene.add(water);

  return {
    water,
    waterUniforms,
    terrain,
    sky,
    tick: (dt: number, camera: THREE.Camera) => {
      water.material.uniforms['time'].value += dt;
      sky.uniforms['time'].value += dt;
      
      // Update terrain material time
      if (terrain.mesh.material instanceof THREE.ShaderMaterial) {
        terrain.mesh.material.uniforms['time'].value += dt;
      }
      
      // Update rock material time
      const currentRockGroup = scene.getObjectByName("rockGroup");
      if (currentRockGroup && currentRockGroup.children.length > 0) {
        const firstMesh = currentRockGroup.children[0] as THREE.Mesh;
        if (firstMesh.material instanceof THREE.ShaderMaterial) {
          firstMesh.material.uniforms['time'].value += dt;
        }
      }

      // Sky follows camera
      sky.mesh.position.copy(camera.position);
    }
  };
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
