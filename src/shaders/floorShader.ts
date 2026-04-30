export const FLOOR_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;

  // Simple hashing function for noise
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // 2D Value Noise
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

  // Fractional Brownian Motion for organic terrain
  float getFloorHeight(vec2 p) {
    float h = 0.0;
    h += noise(p * 0.05) * 4.0;
    h += noise(p * 0.1) * 2.0;
    h += noise(p * 0.2) * 1.0;
    return h;
  }

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    
    // Stitching logic: calculate height based on world coordinates
    float h = getFloorHeight(worldPos.xz);
    worldPos.y += h;
    
    vWorldPos = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const FLOOR_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbientColor;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  void main() {
    // Generate flat shading normal from derivatives
    vec3 dx = dFdx(vWorldPos);
    vec3 dy = dFdy(vWorldPos);
    vec3 faceNormal = normalize(cross(dx, dy));

    // Basic diffuse lighting + Ambient
    float NdotL = max(dot(faceNormal, uSunDir), 0.0);
    vec3 diffuse = uSunColor * NdotL;
    vec3 lighting = uAmbientColor + diffuse;
    
    // Subtle height-based coloring for more depth
    float heightFactor = clamp((vWorldPos.y + 32.0) / 10.0, 0.0, 1.0);
    vec3 finalColor = mix(uColor * 0.8, uColor * 1.2, heightFactor);
    
    vec3 color = finalColor * lighting;
    
    // Fog
    float dist = length(cameraPosition - vWorldPos);
    float fogFactor = smoothstep(fogNear, fogFar, dist);
    color = mix(color, fogColor, fogFactor);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
