import { useControls } from "leva";

export function useRockControls() {
  return useControls(
    "Rocks",
    {
      count: { value: 300, min: 0, max: 2000, step: 10, label: "Rock Count" },
      spread: { value: 600, min: 10, max: 2000, step: 10, label: "Spread Radius" },
      minSize: { value: 2.5, min: 2.0, max: 10.0, step: 0.1, label: "Min Size" },
      maxSize: { value: 5.0, min: 2.0, max: 20.0, step: 0.1, label: "Max Size" },
      detail: { value: 0, min: 0, max: 2, step: 1, label: "Low-Poly Detail" },
      color: { value: "#7b7f82", label: "Rock Color" },
      randomSeed: { value: 42, min: 0, max: 1000, step: 1, label: "Random Seed" },
    },
    { collapsed: true }
  );
}
