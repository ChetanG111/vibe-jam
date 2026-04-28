uniform float uTime;
uniform vec3  uColor;
uniform float uFadeDistance;
uniform float uFadeStrength;
uniform vec2  uCamXZ;

// Headlight
uniform vec3  uSubPos;
uniform vec3  uSubForward;
uniform vec3  uHeadlightColor;
uniform float uHeadlightIntensity;
uniform float uHeadlightDistance;
uniform float uHeadlightAngle;
uniform float uHeadlightPenumbra;
uniform float uHeadlightOn;

// Camera Light
uniform vec3  uCamPos3;
uniform vec3  uCamLightColor;
uniform float uCamLightIntensity;
uniform float uCamLightDistance;
uniform float uCamLightOn;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  // Faceted look
  vec3 fdx = dFdx(vViewPos);
  vec3 fdy = dFdy(vViewPos);
  vec3 normal = normalize(cross(fdx, fdy));

  // Basic directional lighting (sun)
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
  float diffuse = max(dot(normal, lightDir), 0.0);
  
  vec3 color = mix(uColor * 0.5, uColor, diffuse);

  // 1. Headlight (Spotlight)
  if (uHeadlightOn > 0.5) {
    vec3  toFrag   = vWorldPos - uSubPos;
    float distToFrag = length(toFrag);
    vec3  toFragN  = toFrag / max(distToFrag, 0.001);

    float cosAngle    = dot(uSubForward, toFragN);
    float cosInner    = cos(uHeadlightAngle * (1.0 - uHeadlightPenumbra));
    float cosOuter    = cos(uHeadlightAngle);
    float coneFactor  = smoothstep(cosOuter, cosInner, cosAngle);

    float distFactor  = 1.0 - clamp(distToFrag / uHeadlightDistance, 0.0, 1.0);
    distFactor = distFactor * distFactor;

    float nDotL = max(dot(normal, -toFragN), 0.0);
    float headlightAtten = coneFactor * distFactor * nDotL * uHeadlightIntensity * 0.12; // Slightly more intense on rocks
    color += uHeadlightColor * headlightAtten;
  }

  // 2. Camera Light
  if (uCamLightOn > 0.5) {
    vec3  toCam = vWorldPos - uCamPos3;
    float distToCam = length(toCam);
    float distFactor = 1.0 - clamp(distToCam / uCamLightDistance, 0.0, 1.0);
    distFactor = pow(distFactor, 2.0);

    vec3  toCamN = toCam / max(distToCam, 0.001);
    float nDotL = max(dot(normal, -toCamN), 0.0);

    float camLightAtten = distFactor * nDotL * uCamLightIntensity * 0.08;
    color += uCamLightColor * camLightAtten;
  }

  // Fade into darkness
  float dist  = length(vWorldPos.xz - uCamXZ);
  float fade  = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

  gl_FragColor = vec4(color, fade);
}
