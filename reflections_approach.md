Alright, here’s the no-BS, start-to-finish setup that will give you:

✔ stylized reflections (like your reference)
✔ smooth surface ↔ underwater transition
✔ no overengineering
✔ works clean in Three.js

🧠 OVERALL STRUCTURE (keep this mental model)

You have 3 systems, not one:

Water surface (visual layer)
Reflection layer (fake mirror)
Underwater effects (fog + lighting)

👉 Don’t mix them. That’s where people screw up.

🧱 STEP 1 — Base scene
Objects
submarine
islands
rocks

👉 normal meshes, nothing special

🌊 STEP 2 — Water surface (IMPORTANT)

Just a plane:

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.ShaderMaterial({ /* we'll add later */ })
);
water.rotation.x = -Math.PI / 2;
water.position.y = waterLevel;
scene.add(water);
🪞 STEP 3 — Reflection system (core of your question)
3.1 Create reflection group
const reflectionGroup = new THREE.Group();
scene.add(reflectionGroup);
3.2 Add mirrored versions

For EACH object you want reflected:

function createReflection(obj) {
  const clone = obj.clone();

  clone.scale.y *= -1;

  clone.position.y =
    waterLevel - (obj.position.y - waterLevel);

  clone.material = new THREE.MeshBasicMaterial({
    color: obj.material.color,
    transparent: true,
    opacity: 0.25
  });

  reflectionGroup.add(clone);
}

👉 apply to:

submarine
islands
rocks
3.3 Add distortion (VERY important)

Inside animation loop:

reflectionGroup.children.forEach(obj => {
  obj.position.x += Math.sin(time + obj.position.z) * 0.002;
});

👉 subtle = good
👉 don’t overdo it

3.4 Add vertical fade

Cheapest way:

obj.material.opacity = 0.25 * fadeFactor;

Where:

const depth = Math.abs(obj.position.y - waterLevel);
const fadeFactor = Math.max(0, 1 - depth / 3);
👁️ STEP 4 — Camera-based switching (CRITICAL)
const cameraY = camera.position.y;

if (cameraY < waterLevel) {
  reflectionGroup.visible = false;
} else {
  reflectionGroup.visible = true;
}
BONUS (smooth fade instead of pop)
const t = THREE.MathUtils.clamp(
  (cameraY - waterLevel) / 2,
  0,
  1
);

reflectionGroup.children.forEach(obj => {
  obj.material.opacity = 0.25 * t;
});
🌫️ STEP 5 — Underwater system
5.1 Fog switch
if (cameraY < waterLevel) {
  scene.fog = new THREE.Fog(0x1f5f7a, 5, 25);
} else {
  scene.fog = null;
}
5.2 Lighting adjustment
if (cameraY < waterLevel) {
  ambient.intensity = 0.4;
} else {
  ambient.intensity = 0.7;
}
5.3 Submarine spotlight
subLight.visible = cameraY < waterLevel;
🎨 STEP 6 — Water shader (simple but effective)
Fragment shader concept
vec3 waterColor = mix(deepColor, surfaceColor, uv.y);

// fresnel fake reflection
float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);

vec3 reflection = skyColor * fresnel;

color = mix(waterColor, reflection, 0.4);
Add subtle wave distortion
uv.x += sin(time + uv.y * 10.0) * 0.01;
🧠 STEP 7 — Final polish rules
DO:
keep reflections faint
keep distortion subtle
fade aggressively
disable underwater
DON’T:
add real reflections
make it mirror sharp
over-animate