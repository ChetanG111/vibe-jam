import { useControls } from "leva";

export function useWaterFloorControls() {
  return useControls(
    "Water Floor",
    {
      waterScale:     { value: 0.28,  min: 0.01, max: 1.5,  step: 0.01,  label: "Scale" },
      cellSmoothness: { value: 0.40,  min: 0,    max: 2,    step: 0.01,  label: "Cell Smoothness" },
      edgeThreshold:  { value: 0.12,  min: 0,    max: 0.3,  step: 0.005, label: "Edge Threshold" },
      edgeSoftness:   { value: 0.05,  min: 0,    max: 0.1,  step: 0.005, label: "Edge Softness" },
      flowX:          { value: 0.04,  min: -0.5, max: 0.5,  step: 0.01,  label: "Flow X" },
      flowZ:          { value: -0.08, min: -0.5, max: 0.5,  step: 0.01,  label: "Flow Z" },
      cellSpeed:      { value: 0.25,  min: 0,    max: 3,    step: 0.05,  label: "Cell Anim Speed" },
      noiseScale:     { value: 1.2,   min: 0.1,  max: 10,   step: 0.01,  label: "Noise Scale" },
      noiseFlowSpeed: { value: 0.08,  min: 0,    max: 2,    step: 0.01,  label: "Noise Flow Speed" },
      distortAmount:  { value: 0.35,  min: 0,    max: 3,    step: 0.01,  label: "Distort Amount" },
      deepColor:      { value: "#1E5D7A",                                  label: "Deep Color" },
      midColor:       { value: "#FFFFFF",                                  label: "Mid Color" },
      midPos:         { value: 0.40,  min: 0.001, max: 0.999, step: 0.001, label: "Mid Pos" },
      highlightColor: { value: "#ffffff",                                  label: "Highlight Color" },
      opacity:        { value: 1.0,   min: 0,    max: 1,    step: 0.01,  label: "Opacity" },
      deepOpacity:    { value: 0.90,  min: 0,    max: 1,    step: 0.01,  label: "Deep Opacity" },
      fadeDistance:   { value: 1500,  min: 10,   max: 2000, step: 10,    label: "Fade Distance" },
      fadeStrength:   { value: 1.5,   min: 0.1,  max: 5,    step: 0.1,   label: "Fade Strength" },
    },
    { collapsed: true }
  );
}
