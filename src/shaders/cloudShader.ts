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
    // We normalize the world height to a 0.0 - 1.0 range for the sky logic
    // Clouds are between 5 and 50. Let's map that to the lower half of the sky gradient.
    float h = clamp(vWorldPosition.y / 150.0, 0.0, 1.0);
    
    vec3 skyColor;
    if (h > 0.5) {
        skyColor = mix(uSkyMid, uSkyTop, (h - 0.5) * 2.0);
    } else {
        skyColor = mix(uSkyBottom, uSkyMid, h * 2.0);
    }
    
    // 3. Local Shading (Top is darker, Bottom catches horizon light)
    float localGrad = smoothstep(-3.0, 3.0, vLocalY);
    
    // Bottom lighting (under-glow)
    float underLight = max(dot(normal, vec3(0.0, -1.0, 0.0)), 0.0);
    
    // Mix it all together
    // Base color is the sampled sky color at this height
    vec3 finalColor = skyColor;
    
    // Add local shadowing (darker at the top of the cloud)
    finalColor *= (0.6 + localGrad * 0.4);
    
    // Apply horizon under-glow
    finalColor = mix(finalColor, uHorizonColor, underLight * 0.7);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;
