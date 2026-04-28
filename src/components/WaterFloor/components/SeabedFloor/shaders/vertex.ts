export const VERT = /* glsl */ `
  varying vec2 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vWorldPos3;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    
    // Displace Y for low-poly terrain
    float h = noise(worldPos.xz * 0.05) * 8.0;
    h += noise(worldPos.xz * 0.1) * 3.0;
    worldPos.y += h;

    vWorldPos    = worldPos.xz;
    vWorldPos3   = worldPos.xyz;
    vViewPos     = (viewMatrix * worldPos).xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;
