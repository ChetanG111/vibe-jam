import { useControls } from "leva";

export function useSeabedControls() {
  return useControls(
    "Seabed",
    {
      seabedDepth:    { value: -25.0,  min: -100,  max: -5,  step: 1.0,   label: "Depth Y" },
      seabedScale:    { value: 0.12,   min: 0.01,  max: 1.0, step: 0.01,  label: "Scale" },
      cellSpeed:      { value: 0.30,   min: 0,     max: 2,   step: 0.01,  label: "Cell Speed" },
      flowX:          { value: 0.0,    min: -0.5,  max: 0.5, step: 0.005, label: "Flow X" },
      flowZ:          { value: -0.05,  min: -0.5,  max: 0.5, step: 0.005, label: "Flow Z" },
      edgeThreshold:  { value: 0.10,   min: 0,     max: 0.3, step: 0.005, label: "Edge Threshold" },
      edgeSoftness:   { value: 0.05,   min: 0,     max: 0.1, step: 0.005, label: "Edge Softness" },
      deepColor:      { value: "#7FA3A6",                                   label: "Deep Color" },
      highlightColor: { value: "#ffffff",                                   label: "Highlight Color" },
      fadeDistance:   { value: 400,    min: 10,    max: 600, step: 5,     label: "Fade Distance" },
      fadeStrength:   { value: 2.0,    min: 0.1,   max: 5,   step: 0.1,   label: "Fade Strength" },
    },
    { collapsed: true }
  );
}
