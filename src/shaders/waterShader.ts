export const WATER_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uWaveHeight;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vViewZ;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    
    // Multi-layered calm waves
    float wave = sin(worldPos.x * 0.15 + uTime * 0.5 * uWaveSpeed) * 0.15 * uWaveHeight +
                 sin(worldPos.z * 0.2 + uTime * 0.4 * uWaveSpeed) * 0.12 * uWaveHeight +
                 sin((worldPos.x + worldPos.z) * 0.1 + uTime * 0.3 * uWaveSpeed) * 0.1 * uWaveHeight;
    
    worldPos.y += wave;
    vWorldPos = worldPos.xyz;
    
    vec4 mvPos = viewMatrix * worldPos;
    vViewZ = -mvPos.z;
    
    // View direction for Fresnel/Reflections
    vViewDir = normalize(worldPos.xyz - cameraPosition);
    
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const WATER_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uDepthTex;
  uniform vec2 uResolution;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform vec3 uWaterColor;
  uniform vec3 uFoamColor;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  uniform float uFoamStrength;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vViewZ;

  // Sky Gradient Stops (Synchronized with skyShader)
  const vec3 SKY_C1 = vec3(0.106, 0.165, 0.29);  // #1B2A4A
  const vec3 SKY_C2 = vec3(0.173, 0.247, 0.45);  // #2C3F73
  const vec3 SKY_C3 = vec3(0.29, 0.31, 0.54);   // #4A4F8A
  const vec3 SKY_C4 = vec3(0.478, 0.435, 0.639); // #7A6FA3
  const vec3 SKY_C5 = vec3(0.769, 0.529, 0.604); // #C4879A
  const vec3 SKY_C6 = vec3(0.949, 0.627, 0.478); // #F2A07A
  const vec3 SKY_C7 = vec3(0.969, 0.698, 0.404); // #F7B267

  float linearizeDepth(float d) {
    float z = 2.0 * d - 1.0;
    return (2.0 * uCameraNear * uCameraFar) /
           (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
  }

  vec3 getSkyReflection(vec3 reflectDir) {
    float h = clamp(reflectDir.y, 0.0, 1.0);
    float t = h; // Linear for water reflections often looks better
    
    if (t > 0.6) return mix(SKY_C2, SKY_C1, smoothstep(0.6, 1.0, t));
    if (t > 0.4) return mix(SKY_C3, SKY_C2, smoothstep(0.4, 0.6, t));
    if (t > 0.25) return mix(SKY_C4, SKY_C3, smoothstep(0.25, 0.4, t));
    if (t > 0.15) return mix(SKY_C5, SKY_C4, smoothstep(0.15, 0.25, t));
    if (t > 0.08) return mix(SKY_C6, SKY_C5, smoothstep(0.08, 0.15, t));
    return mix(SKY_C7, SKY_C6, smoothstep(0.0, 0.08, t));
  }

  void main() {
    // 1. Surface Normal
    vec3 fdx = dFdx(vWorldPos);
    vec3 fdy = dFdy(vWorldPos);
    vec3 normal = normalize(cross(fdx, fdy));
    if (normal.y < 0.0) normal = -normal;

    // 2. Depth Logic
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    float sceneDepth = linearizeDepth(texture2D(uDepthTex, screenUV).r);
    float depthDiff = sceneDepth - vViewZ;

    // 3. Colors: Shallow to Deep
    vec3 shallowColor = vec3(0.08, 0.72, 0.88); // Teal
    vec3 deepWaterColor = vec3(0.04, 0.08, 0.2); // Deep Navy
    float depthFactor = smoothstep(0.0, 15.0, depthDiff);
    vec3 baseColor = mix(shallowColor, deepWaterColor, depthFactor);

    // 4. Reflection Logic (Fresnel)
    vec3 reflectDir = reflect(vViewDir, normal);
    vec3 reflectionColor = getSkyReflection(reflectDir);
    
    float fresnel = pow(1.0 - max(dot(normal, -vViewDir), 0.0), 3.0);
    vec3 finalColor = mix(baseColor, reflectionColor, fresnel * 0.7);

    // 5. Specular Highlights
    vec3 halfDir = normalize(uSunDir - vViewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 128.0);
    finalColor += vec3(1.0, 0.9, 0.7) * spec * 0.8;

    // 6. Foam
    float outerFoam = 1.0 - smoothstep(0.0, 1.8, depthDiff);
    float p = sin(vWorldPos.x * 4.0 + uTime) * 0.3 + sin(vWorldPos.z * 3.0 - uTime * 0.8) * 0.3 + 0.4;
    float foam = max(outerFoam * p, (1.0 - smoothstep(0.0, 0.4, depthDiff)));
    finalColor = mix(finalColor, uFoamColor, clamp(foam * uFoamStrength, 0.0, 1.0));

    // 7. Fog
    float fogFactor = smoothstep(fogNear, fogFar, vViewZ);
    finalColor = mix(finalColor, fogColor, fogFactor);

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;
