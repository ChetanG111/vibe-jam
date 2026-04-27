import * as THREE from "three";

export function createSky() {
  const geometry = new THREE.SphereGeometry(1000, 32, 32);

  const uniforms = {
    topColor: { value: new THREE.Color(0x002244) },    // Deep Azure
    bottomColor: { value: new THREE.Color(0x00ffff) }, // Bright Cyan
    sunColor: { value: new THREE.Color(0xffffff) },
    sunDir: { value: new THREE.Vector3(0.5, 0.8, -0.2).normalize() },
    sunSize: { value: 0.997 }, // Controls core radius
    sunGlow: { value: 0.02 },  // Controls glow spread
    time: { value: 0 },
  };

  const vertexShader = `
    varying vec3 vLocalPosition;
    void main() {
      vLocalPosition = position;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform vec3 sunColor;
    uniform vec3 sunDir;
    uniform float sunSize;
    uniform float sunGlow;
    uniform float time;

    varying vec3 vLocalPosition;

    void main() {
      vec3 dir = normalize(vLocalPosition);
      
      // 1. Sky Gradient (Vibrant Azure to Cyan)
      float h = max(0.0, dir.y * 0.5 + 0.5);
      vec3 sky = mix(bottomColor, topColor, pow(h, 0.6));
      
      // 2. Procedural Sun (Circle with smoothstep edge)
      float d = max(0.0, dot(dir, sunDir));
      
      // Core circle (very bright)
      float sunCore = smoothstep(sunSize, sunSize + 0.0005, d);
      
      // Soft ray glow (wide and atmospheric)
      float sunGlowEffect = pow(smoothstep(sunSize - sunGlow, sunSize, d), 2.0);
      
      sky = mix(sky, sunColor, sunCore + sunGlowEffect * 0.6);
      
      gl_FragColor = vec4(sky, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    fog: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "sky";

  return {
    mesh,
    uniforms,
  };
}
