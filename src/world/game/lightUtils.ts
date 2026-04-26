import * as THREE from "three";

export function createVolumetricBeam(spotLight: THREE.SpotLight) {
  const geometry = new THREE.ConeGeometry(1, 1, 32, 1, true);
  geometry.translate(0, -0.5, 0);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      lightColor: { value: spotLight.color },
      intensity: { value: 0.15 },
      attenuation: { value: spotLight.distance },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying float vDist;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vDist = length(position.xy);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 lightColor;
      uniform float intensity;
      uniform float attenuation;
      varying vec3 vWorldPosition;
      varying float vDist;

      void main() {
        // Simple distance-based falloff from the beam center
        float d = length(cameraPosition - vWorldPosition);
        float alpha = intensity * (1.0 - smoothstep(0.0, attenuation, d));
        
        // Edge softening
        float edge = 1.0 - smoothstep(0.3, 1.0, vDist);
        alpha *= edge;

        gl_FragColor = vec4(lightColor, alpha * 0.4);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const beam = new THREE.Mesh(geometry, material);

  const update = () => {
    const angle = spotLight.angle || 0.1;
    const dist = spotLight.distance || 100;
    const spread = Math.tan(angle) * dist;
    beam.scale.set(spread, spread, dist);
  };

  update();
  return { beam, update };
}
