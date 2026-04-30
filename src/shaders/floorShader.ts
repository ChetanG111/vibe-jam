export const FLOOR_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float getFloorHeight(float x, float z) {
    return sin(x * 0.05) * 2.5 + 
           sin(z * 0.04) * 2.2 + 
           sin((x + z) * 0.25) * 0.8;
  }

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    
    // Stitching logic: calculate height based on world coordinates
    float h = getFloorHeight(worldPos.x, worldPos.z);
    worldPos.y += h;
    
    vWorldPos = worldPos.xyz;
    
    // Analytical normal for flat-shading look
    float eps = 0.1;
    float hX = getFloorHeight(worldPos.x + eps, worldPos.z);
    float hZ = getFloorHeight(worldPos.x, worldPos.z + eps);
    vec3 v1 = vec3(eps, hX - h, 0.0);
    vec3 v2 = vec3(0.0, hZ - h, eps);
    vNormal = normalize(cross(v2, v1));

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const FLOOR_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbientColor;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  void main() {
    // Basic diffuse lighting + Ambient
    float NdotL = max(dot(vNormal, uSunDir), 0.0);
    vec3 diffuse = uSunColor * NdotL;
    vec3 lighting = uAmbientColor + diffuse;
    
    vec3 color = uColor * lighting;
    
    // Fog
    float dist = length(cameraPosition - vWorldPos);
    float fogFactor = smoothstep(fogNear, fogFar, dist);
    color = mix(color, fogColor, fogFactor);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;
