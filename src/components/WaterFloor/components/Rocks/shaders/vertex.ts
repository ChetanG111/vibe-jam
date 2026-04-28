varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vec4 worldPos = instanceMatrix * modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  
  // Normal in world space
  vNormal = normalize(mat3(instanceMatrix * modelMatrix) * normal);
  
  vViewPos = (viewMatrix * worldPos).xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
