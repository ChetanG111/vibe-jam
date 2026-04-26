import * as THREE from "three";

export function getVisualCenter(obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return center;
}

export function getCameraDistanceForObject(
  camera: THREE.PerspectiveCamera,
  obj: THREE.Object3D,
  center: THREE.Vector3,
) {
  const sphere = new THREE.Sphere();
  new THREE.Box3().setFromObject(obj).getBoundingSphere(sphere);
  const radius = Number.isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : 6;
  const verticalDistance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) * 0.5);
  const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * camera.aspect);
  const horizontalDistance = radius / Math.sin(horizontalFov * 0.5);
  const centerOffset = sphere.center.distanceTo(center);
  return Math.max(verticalDistance, horizontalDistance) + centerOffset + radius * 1.8;
}
