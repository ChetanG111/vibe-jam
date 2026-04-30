export const CLOUD_VERTEX_SHADER = `
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying float vLocalY;

void main() {
    vLocalY = position.y;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const CLOUD_FRAGMENT_SHADER = `
uniform vec3 uSkyTop;
uniform vec3 uSkyMid;
uniform vec3 uSkyBottom;
uniform vec3 uHorizonColor;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
varying float vLocalY;

void main() {
    // 1. Flat shading normal
    vec3 fdx = dFdx(vViewPosition);
    vec3 fdy = dFdy(vViewPosition);
    vec3 normal = normalize(cross(fdx, fdy));
    
    // 2. Sample Sky Gradient based on world height
    float h = clamp(vWorldPosition.y / 150.0, 0.0, 1.0);
    
    vec3 skyColor;
    if (h > 0.5) {
        skyColor = mix(uSkyMid, uSkyTop, (h - 0.5) * 2.0);
    } else {
        skyColor = mix(uSkyBottom, uSkyMid, h * 2.0);
    }
    
    // 3. User Request: 80% white, 20% sky blend
    vec3 cloudBase = mix(vec3(0.95), skyColor, 0.2);
    
    // 4. Local Shading (Top is darker, Bottom catches horizon light)
    float localGrad = smoothstep(-3.0, 3.0, vLocalY);
    
    // Bottom lighting (under-glow)
    float underLight = max(dot(normal, vec3(0.0, -1.0, 0.0)), 0.0);
    
    // Mix it all together
    vec3 finalColor = cloudBase;
    
    // Add local shadowing
    finalColor *= (0.7 + localGrad * 0.3);
    
    // Apply horizon under-glow
    finalColor = mix(finalColor, uHorizonColor, underLight * 0.4);
    
    // 5. THE FADED LOOK (Transparency & Edge Softening)
    // Global opacity
    float alpha = 0.65;
    
    // Edge fade using view-space normal (Fresnel-like)
    // This makes the edges of the low-poly blobs feel softer/thinner
    vec3 viewDir = normalize(-vViewPosition);
    float edgeFade = pow(max(dot(normal, viewDir), 0.0), 1.5);
    alpha *= edgeFade;
    
    // Height-based fade (fade out at the very bottom/top slightly)
    float heightFade = smoothstep(-4.0, -2.0, vLocalY) * smoothstep(4.0, 2.0, vLocalY);
    alpha *= heightFade;

    gl_FragColor = vec4(finalColor, alpha);
}
`;
