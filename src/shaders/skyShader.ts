export const SKY_VERTEX_SHADER = `
varying vec3 vWorldPosition;
void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAGMENT_SHADER = `
uniform vec3 uColor1; // Deep Top
uniform vec3 uColor2; // Purple
uniform vec3 uColor3; // Magenta/Pink
uniform vec3 uColor4; // Orange
uniform vec3 uColor5; // Horizon Glow
varying vec3 vWorldPosition;

void main() {
    float h = normalize(vWorldPosition).y;
    float t = clamp(h, 0.0, 1.0);
    
    vec3 color;
    
    // Spread the gradient out so the purple-to-orange transition is visible in the main view
    if (t > 0.6) {
        // Deep Blue to Purple
        color = mix(uColor2, uColor1, smoothstep(0.6, 1.0, t));
    } else if (t > 0.25) {
        // Purple to Magenta
        color = mix(uColor3, uColor2, smoothstep(0.25, 0.6, t));
    } else if (t > 0.05) {
        // Magenta to Orange
        color = mix(uColor4, uColor3, smoothstep(0.05, 0.25, t));
    } else {
        // Orange to Horizon Glow
        color = mix(uColor5, uColor4, smoothstep(0.0, 0.05, t));
    }
    
    gl_FragColor = vec4(color, 1.0);
}
`;
