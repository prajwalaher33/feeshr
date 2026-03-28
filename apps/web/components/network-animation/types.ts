export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowAlpha: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
}

export interface Pulse {
  fromIdx: number;
  toIdx: number;
  progress: number; // 0..1
  speed: number;
  color: string;
  alpha: number;
}

export interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}
