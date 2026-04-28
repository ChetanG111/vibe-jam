export const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uCellSpeed;
  uniform float uFlowX;
  uniform float uFlowZ;
  uniform float uEdgeThreshold;
  uniform float uEdgeSoftness;
  uniform vec3  uDeepColor;
  uniform vec3  uHighlight;
  uniform float uFadeDistance;
  uniform float uFadeStrength;
  uniform vec2  uCamXZ;

  // ── Headlight uniforms ──────────────────────────────────────────────────────
  uniform vec3  uSubPos;
  uniform vec3  uSubForward;
  uniform vec3  uHeadlightColor;
  uniform float uHeadlightIntensity;
  uniform float uHeadlightDistance;
  uniform float uHeadlightAngle;
  uniform float uHeadlightPenumbra;
  uniform float uHeadlightOn;

  // ── Camera Light uniforms ───────────────────────────────────────────────────
  uniform vec3  uCamPos3;
  uniform vec3  uCamLightColor;
  uniform float uCamLightIntensity;
  uniform float uCamLightDistance;
  uniform float uCamLightOn;

  varying vec2 vWorldPos;
  varying vec3 vViewPos;
  varying vec3 vWorldPos3;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k / 6.0;
  }

  vec2 cellPt(vec2 seed) {
    return 0.5 + 0.5 * sin(uTime * uCellSpeed + 6.2831 * seed);
  }

  float voronoiF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float md = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        md = min(md, length(n + pt - f));
      }
    return md;
  }

  float voronoiSF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float res = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n  = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        res = smin(res, length(n + pt - f), 0.4);
      }
    return res;
  }

  void main() {
    vec3 fdx = dFdx(vViewPos);
    vec3 fdy = dFdy(vViewPos);
    vec3 normal = normalize(cross(fdx, fdy));

    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    vec2  uv   = vWorldPos * uScale + vec2(uFlowX, uFlowZ) * uTime;
    float f1   = voronoiF1(uv);
    float sf1  = voronoiSF1(uv);
    float edge = f1 - sf1;
    float causticT = smoothstep(uEdgeThreshold - uEdgeSoftness,
                              uEdgeThreshold + uEdgeSoftness, edge);
    
    vec3 terrainBase = mix(uDeepColor * 0.7, uDeepColor, diffuse);
    vec3 color = mix(terrainBase, uHighlight, causticT * 0.5);

    // 1. Headlight (Spotlight)
    if (uHeadlightOn > 0.5) {
      vec3  toFrag   = vWorldPos3 - uSubPos;
      float distToFrag = length(toFrag);
      vec3  toFragN  = toFrag / max(distToFrag, 0.001);

      float cosAngle    = dot(uSubForward, toFragN);
      float cosInner    = cos(uHeadlightAngle * (1.0 - uHeadlightPenumbra));
      float cosOuter    = cos(uHeadlightAngle);
      float coneFactor  = smoothstep(cosOuter, cosInner, cosAngle);

      float distFactor  = 1.0 - clamp(distToFrag / uHeadlightDistance, 0.0, 1.0);
      distFactor = distFactor * distFactor;

      float nDotL = max(dot(normal, -toFragN), 0.0);
      float headlightAtten = coneFactor * distFactor * nDotL * uHeadlightIntensity * 0.08;
      color += uHeadlightColor * headlightAtten;
    }

    // 2. Camera Light (Dim Point Light)
    if (uCamLightOn > 0.5) {
      vec3  toCam = vWorldPos3 - uCamPos3;
      float distToCam = length(toCam);
      float distFactor = 1.0 - clamp(distToCam / uCamLightDistance, 0.0, 1.0);
      distFactor = pow(distFactor, 2.0); // Smooth falloff

      vec3  toCamN = toCam / max(distToCam, 0.001);
      float nDotL = max(dot(normal, -toCamN), 0.0);

      float camLightAtten = distFactor * nDotL * uCamLightIntensity * 0.05;
      color += uCamLightColor * camLightAtten;
    }

    float dist  = length(vWorldPos - uCamXZ);
    float fade  = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    gl_FragColor = vec4(color, fade);
  }
`;
