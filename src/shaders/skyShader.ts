export const SKY_VERTEX_SHADER = `
varying vec3 vWorldPosition;
void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAGMENT_SHADER = `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
varying vec3 vWorldPosition;

void main() {
    float h = normalize(vWorldPosition).y;
    float t = clamp(h, 0.0, 1.0);
    
    vec3 color;
    
    // Proportional mapping to bring the top colors down into the visible field of view
    if (t > 0.5) {
        // Deep Blue to Indigo
        color = mix(uColor2, uColor1, smoothstep(0.5, 1.0, t));
    } else if (t > 0.3) {
        // Indigo to Blue-purple
        color = mix(uColor3, uColor2, smoothstep(0.3, 0.5, t));
    } else if (t > 0.18) {
        // Blue-purple to Muted Lavender
        color = mix(uColor4, uColor3, smoothstep(0.18, 0.3, t));
    } else if (t > 0.1) {
        // Muted Lavender to Pinkish
        color = mix(uColor5, uColor4, smoothstep(0.1, 0.18, t));
    } else if (t > 0.04) {
        // Pinkish to Peach
        color = mix(uColor6, uColor5, smoothstep(0.04, 0.1, t));
    } else {
        // Peach to Warm Orange
        color = mix(uColor7, uColor6, smoothstep(0.0, 0.04, t));
    }
    
    gl_FragColor = vec4(color, 1.0);
}
`;
