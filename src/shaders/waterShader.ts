export const WATER_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uWaveHeight;
  varying vec3 vWorldPos;
  varying float vViewZ;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    
    // Wave displacement
    float wave = sin(worldPos.x * 0.2 + uTime * 0.6 * uWaveSpeed) * 0.18 * uWaveHeight +
                 sin(worldPos.z * 0.25 + uTime * 0.45 * uWaveSpeed) * 0.14 * uWaveHeight +
                 sin((worldPos.x + worldPos.z) * 0.15 + uTime * 0.5 * uWaveSpeed) * 0.1 * uWaveHeight;
    
    worldPos.y += wave;
    vWorldPos = worldPos.xyz;
    
    vec4 mvPos = viewMatrix * worldPos;
    vViewZ = -mvPos.z;
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
  varying float vViewZ;

  float linearizeDepth(float d) {
    float z = 2.0 * d - 1.0;
    return (2.0 * uCameraNear * uCameraFar) /
           (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
  }

  void main() {
    // Flat-shading: derive face normal from screen-space derivatives
    vec3 fdx = dFdx(vWorldPos);
    vec3 fdy = dFdy(vWorldPos);
    vec3 normal = normalize(cross(fdx, fdy));
    if (normal.y < 0.0) normal = -normal;

    // Simple directional + ambient lighting
    float NdotL = max(dot(normal, uSunDir), 0.0);
    float light = 0.45 + NdotL * 0.55;
    vec3 baseColor = uWaterColor * light;

    // --- Depth-based foam ---
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    float sceneDepth = linearizeDepth(texture2D(uDepthTex, screenUV).r);
    float depthDiff = sceneDepth - vViewZ;

    // Outer foam: fades over ~2 world-units from intersection
    float outerFoam = 1.0 - smoothstep(0.0, 2.0, depthDiff);
    // Animated ripple pattern
    float wave1 = sin(vWorldPos.x * 4.0 + uTime * 1.5) * 0.5 + 0.5;
    float wave2 = sin(vWorldPos.z * 3.5 - uTime * 1.2) * 0.5 + 0.5;
    float wave3 = sin((vWorldPos.x + vWorldPos.z) * 2.5 + uTime * 2.0) * 0.5 + 0.5;
    float pattern = wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25;

    // Inner foam (very close, solid white edge)
    float innerFoam = 1.0 - smoothstep(0.0, 0.6, depthDiff);

    float foam = max(innerFoam * uFoamStrength, outerFoam * pattern * (uFoamStrength - 0.15));
    foam = clamp(foam, 0.0, 1.0);

    vec3 color = mix(baseColor, uFoamColor, foam);

    // --- Fog ---
    float fogFactor = smoothstep(fogNear, fogFar, vViewZ);
    color = mix(color, fogColor, fogFactor);

    gl_FragColor = vec4(color, uOpacity);
  }
`;
