/**
 * Lightweight singleton store — updated every frame by Submarine.tsx,
 * read every frame by SeabedFloor (and any other custom shader that needs
 * to know where the submarine is).
 */
export const submarineStore = {
  /** World-space position of the submarine */
  position: { x: 0, y: -2, z: 0 },
  /** World-space forward direction (unit vector) */
  forward: { x: 0, y: 0, z: -1 },
  /** Headlight settings mirrored from Leva so shaders can read them */
  headlight: {
    on: true,
    intensity: 12,
    distance: 30,
    angle: 0.32,
    color: { r: 0.72, g: 0.91, b: 1.0 },
  },
};
