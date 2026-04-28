import * as THREE from "three";
import { createOceanFloor, createRockFormations } from "./terrain";

export function setupEnvironment(scene: THREE.Scene) {
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

  /*
  // Custom Cartoon Water Shader
  const waterGeometry = new THREE.PlaneGeometry(2000, 2000, 128, 128); // more segments for vertex waves
  const waterUniforms = {
    time: { value: 0 },
    waterColor: { value: new THREE.Color(0x052a4a) }, // Darker deep blue
    skyColor: { value: new THREE.Color(0x3582ba) },   // Lighter blue
    opacity: { value: 0.8 },
    normalStrength: { value: 3.0 },
    fresnelPower: { value: 3.5 },
    foamDensity: { value: 0.08 },
    sunSparkleDensity: { value: 0.85 },
    sunDir: { value: new THREE.Vector3(0.5, 0.8, -0.2).normalize() },
    tNormal: {
      value: (() => {
        const tex = new THREE.TextureLoader().load('/waternormals.jpg');
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
      })()
    },
  };

  const waterVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform float time;
    
    void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Gentle vertex waves for large rolling motion
        float wave = sin(pos.x * 0.05 + time * 0.5) * cos(pos.y * 0.05 + time * 0.5) * 0.2;
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
    uniform vec3 skyColor;
    uniform float opacity;
    uniform float normalStrength;
    uniform float fresnelPower;
    uniform float foamDensity;
    uniform float sunSparkleDensity;
    uniform vec3 sunDir;
    uniform sampler2D tNormal;

    float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx+p3.yz)*p3.zy);
    }

    void main() {
        // View direction
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // Scroll two normal maps in different directions for a natural wave distortion
        vec2 uvNormal1 = vWorldPosition.xz * 0.02 + vec2(time * 0.015, time * 0.01);
        vec2 uvNormal2 = vWorldPosition.xz * 0.03 + vec2(-time * 0.01, time * 0.015);
        
        vec3 n1 = texture2D(tNormal, uvNormal1).rgb * 2.0 - 1.0;
        vec3 n2 = texture2D(tNormal, uvNormal2).rgb * 2.0 - 1.0;
        
        vec3 normal = normalize(vec3(n1.x + n2.x, normalStrength, n1.y + n2.y));

        // Fresnel effect for base color
        float fresnel = max(0.0, 1.0 - max(0.0, dot(normal, viewDir)));
        fresnel = pow(fresnel, fresnelPower); 
        
        vec3 albedo = mix(waterColor, skyColor, fresnel * 0.8);

        // Specular highlight area (Blinn-Phong)
        vec3 halfVector = normalize(sunDir + viewDir);
        float NdotH = max(0.0, dot(normal, halfVector));
        float specularBase = pow(NdotH, 300.0);
        float highlightArea = smoothstep(0.4, 0.45, specularBase);
        
        float softGlow = pow(NdotH, 60.0) * 0.6;
        albedo += vec3(softGlow); 

        // Particle 1: Sun Reflection Sparkles
        vec2 sunUV = vWorldPosition.xz * 4.0 + normal.xz * 2.0; 
        vec2 sunGrid = floor(sunUV);
        vec2 sunFract = fract(sunUV);
        
        float sunSeed = hash21(sunGrid);
        vec2 sunOffset = hash22(sunGrid) * 0.6 - 0.3; 
        
        float sunLifespan = mix(0.2, 1.0, hash21(sunGrid + 13.5));
        float sunTimeOffset = hash21(sunGrid + 24.6) * 100.0;
        float sunLife = fract((time + sunTimeOffset) / sunLifespan);
        float sunFade = sin(sunLife * 3.1415926);
        
        float sunDist = length(sunFract - (0.5 + sunOffset));
        float sunMaxRadius = mix(0.1, 0.25, hash21(sunGrid + 35.7));
        float sunCircle = smoothstep(sunMaxRadius, sunMaxRadius * 0.5, sunDist) * sunFade;
        
        float sunParticleAmount = mix(1.0, 0.05, sunSparkleDensity); 
        float sunSparkles = step(sunParticleAmount, sunSeed) * highlightArea * sunCircle;

        // Particle 2: Random Foam Particles
        vec2 foamUV = vWorldPosition.xz * 2.5 + normal.xz * 2.0;
        vec2 foamGrid = floor(foamUV);
        vec2 foamFract = fract(foamUV);
        
        float foamSeed = hash21(foamGrid);
        vec2 foamOffset = hash22(foamGrid + 99.0) * 0.8 - 0.4;
        
        float foamLifespan = mix(3.0, 6.0, hash21(foamGrid + 12.3)); 
        float foamTimeOffset = hash21(foamGrid + 45.6) * 100.0;
        float foamLife = fract((time + foamTimeOffset) / foamLifespan);
        float foamFade = sin(foamLife * 3.1415926);
        
        float foamDist = length(foamFract - (0.5 + foamOffset));
        float foamRadius = mix(0.1, 0.25, hash21(foamGrid + 78.9)); 
        float foamCircle = smoothstep(foamRadius, foamRadius * 0.7, foamDist) * foamFade;
        
        float foamAmount = mix(1.0, 0.9, foamDensity);
        float foamSparkles = step(foamAmount, foamSeed) * foamCircle;

        float totalParticles = max(sunSparkles, foamSparkles);
        vec3 finalColor = albedo + vec3(totalParticles);

        gl_FragColor = vec4(finalColor, opacity);
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
  */

  let time = 0;
  return {
    water: null,
    waterUniforms: null,
    terrain,
    tick: (dt: number) => {
      time += dt;
      
      // Update terrain material time
      if (terrain.mesh.material instanceof THREE.ShaderMaterial) {
        terrain.mesh.material.uniforms['time'].value = time;
      }
      
      // Update rock material time by finding the group in the scene
      const currentRockGroup = scene.getObjectByName("rockGroup");
      if (currentRockGroup && currentRockGroup.children.length > 0) {
        const firstMesh = currentRockGroup.children[0] as THREE.Mesh;
        if (firstMesh.material instanceof THREE.ShaderMaterial) {
          firstMesh.material.uniforms['time'].value = time;
        }
      }

      // Gentle swaying for god rays
      rayGroup.children.forEach((ray, i) => {
        ray.rotation.x += Math.sin(time * 0.5 + i) * 0.0005;
        ray.rotation.z += Math.cos(time * 0.4 + i) * 0.0005;
      });
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
