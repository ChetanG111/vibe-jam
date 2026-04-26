import * as THREE from "three";

export function setupEnvironment(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0x7aa2ff, 0.4);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff5e6, 1.2);
  key.position.set(100, 50, -50);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6ee7ff, 0.35);
  rim.position.set(-20, 14, -25);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      metalness: 0.0,
      roughness: 1.0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -18;
  floor.name = "oceanFloor"; // Tag for hiding
  scene.add(floor);

  // Custom Cartoon Water Shader
  const waterGeometry = new THREE.PlaneGeometry(2000, 2000, 128, 128); // more segments for vertex waves
  const waterUniforms = {
    time: { value: 0 },
    waterColor: { value: new THREE.Color(0x2892d1) }, // vibrant blue/cyan
    foamColor: { value: new THREE.Color(0xffffff) },
    tWater: { value: (() => {
      const tex = new THREE.TextureLoader().load('/water.jpg');
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    })() },
  };

  const waterVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform float time;
    void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 0.2 + time * 1.5) * 0.4;
        pos.z += cos(pos.y * 0.2 + time * 1.2) * 0.4;
        
        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const waterFragmentShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    uniform vec2 resolution;
    uniform float time;
    uniform vec3 waterColor;
    uniform vec3 foamColor;
    uniform sampler2D tWater;

    void main() {
        vec2 texUv = vUv * 15.0; // scale texture to be much larger
        texUv.x += time * 0.02; // slow scroll
        texUv.y += time * 0.01;
        vec4 texColor = texture2D(tWater, texUv);
        
        // Blend original water color with texture
        vec3 baseWater = mix(waterColor, texColor.rgb, 0.6);
        
        float ripple = sin(vWorldPosition.x * 0.5 + time) * cos(vWorldPosition.z * 0.5 + time);
        vec3 finalColor = baseWater + (ripple * 0.05);
        
        gl_FragColor = vec4(finalColor, 0.85);
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

  addRandomProps(scene);

  return {
    water,
    tick: (dt: number) => {
      water.material.uniforms['time'].value += dt;
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
