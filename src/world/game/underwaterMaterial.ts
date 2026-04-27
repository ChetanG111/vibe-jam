import * as THREE from "three";

export const underwaterVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vColor = color;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const underwaterFragmentShader = `
  uniform float time;
  uniform vec3 deepColor;
  uniform vec3 surfaceColor;
  uniform vec3 baseColor;
  uniform float causticIntensity;
  uniform float causticScale;
  uniform float waterLevel;
  
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec3 vColor;

  // Improved sharp caustics function
  float getCaustics(vec2 uv, float t) {
    vec2 p = mod(uv, 6.28318530718) - 250.0;
    vec2 i = vec2(p);
    float c = 1.0;
    float inten = .005;

    for (int n = 0; n < 5; n++) {
      float t = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= float(5);
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }

  void main() {
    // 1. Base Lighting
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.2));
    // Support flat shading look by using face normals
    vec3 normal = normalize(vNormal);
    float diffuse = max(0.3, dot(normal, lightDir));
    
    // 2. Caustics (Projected top-down XZ)
    vec2 causticUV = vWorldPosition.xz * causticScale;
    
    float c1 = getCaustics(causticUV * 0.5, time * 0.5);
    float c2 = getCaustics(causticUV * 0.8 + 10.0, time * 0.4);
    float caustics = (c1 + c2) * 0.5 * causticIntensity;
    
    // Fade caustics with depth from water surface
    float depth = clamp((waterLevel - vWorldPosition.y) / 100.0, 0.0, 1.0);
    caustics *= smoothstep(1.2, 0.2, depth); // Stronger near surface

    // 3. Depth-based coloring (vertical gradient)
    // Make the floor generally lighter
    float heightFactor = clamp((vWorldPosition.y + 120.0) / 160.0, 0.0, 1.0);
    vec3 mixColor = mix(deepColor, vColor * baseColor, heightFactor * 0.8 + 0.2);
    
    // 4. Combine
    vec3 finalColor = mixColor * diffuse;
    // Add glowing blue tint to caustics
    finalColor += caustics * vec3(0.4, 0.9, 1.0) * diffuse;

    // 5. Distance Fog
    float dist = length(cameraPosition - vWorldPosition);
    float fogFactor = 1.0 - exp(-dist * 0.005);
    vec3 fogColor = vec3(0.01, 0.08, 0.14); 
    
    finalColor = mix(finalColor, fogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export function createUnderwaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deepColor: { value: new THREE.Color(0x020a1a) },
      surfaceColor: { value: new THREE.Color(0x1a3a5a) },
      baseColor: { value: new THREE.Color(0xffffff) },
      causticIntensity: { value: 1.5 },
      causticScale: { value: 0.12 },
      waterLevel: { value: 8.0 },
    },
    vertexShader: underwaterVertexShader,
    fragmentShader: underwaterFragmentShader,
    vertexColors: true,
  });
}
