

export const CONFIG = {
  moveSpeed: 16,
  turnSpeed: 1.8,
  propMaxSpeed: 22,
  waveSpeed: 1.0,
  waveHeight: 1.0,
  waterOpacity: 0.85,
  subSink: -0.1,
  foamIntensity: 2.0,
  camDist: 20.5,
  camHeight: 4,
  camFOV: 50,
  // Wake Particles
  wakeEnabled: true,
  wakeCount: 500,
  wakeSize: 0.3,
  wakeLifetime: 0.7,
  wakeSpeed: 1.2,
  wakeSpread: 0.6,
  wakeBuoyancy: -0.1,
  wakeOpacity: 0.6,
  wakeOffset: 0.45,
  floorDepth: -32,
  rockCount: 20,
  coralCount: 75,
  // Sky Atmosphere
  skyFogEnabled: true,
  skyFogNear: 30,
  skyFogFar: 350,
  // Underwater Atmosphere
  uwFogEnabled: false,
  uwFogColor: 0x004466,
  uwFogNear: 2,
  uwFogFar: 80,
  uwBgColor: 0x002233,
  // Chunks
  renderDistance: 3,
  chunkSize: 100,
  terrainSegments: 100,
  skyPreset: 0,
  cloudCount: 140,
};

export const SKY_PRESETS = [
  { name: 'Day Blue', top: '#2FA8FF', bottom: '#87D3FF' },
  { name: 'Warm Sunset', top: '#1A1A2E', bottom: '#FF7A4D' },
  { name: 'Vibrant Sunset', top: '#2E1A47', bottom: '#FF9E7D' },
  { name: 'Peach Sunrise', top: '#FFB4A2', bottom: '#FFE5D9' },
  { name: 'Teal Tropic', top: '#2EC4B6', bottom: '#4CC9F0' },
  { name: 'Indigo Night', top: '#1D3557', bottom: '#6A4C93' },
  { name: 'Deep Navy', top: '#0B2A3A', bottom: '#1F5F7A' }
];

export const SKY_COLOR = 0x55ccff;
