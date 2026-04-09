/**
 * Fish Geometry — Dense spine with anatomically correct proportions
 *
 * 30-segment spine for ultra-smooth body curves.
 * Width profile matches real fish anatomy:
 *   narrow snout → wide cheek → broad shoulders → taper → thin peduncle
 * Asymmetric dorsal/ventral profile for realism (back is more convex).
 */

export interface SpinePoint {
  x: number;
  y: number;
  /** Half-width of body above the spine (dorsal side) */
  widthTop: number;
  /** Half-width of body below the spine (ventral side) */
  widthBot: number;
}

/**
 * Generate the rest-pose spine with N segments.
 * x: 0 = nose, 1 = tail tip.
 * Widths are normalized to fish length.
 */
function generateSpine(n: number): SpinePoint[] {
  const pts: SpinePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 at nose, 1 at tail

    // Width profile: fast rise at snout, peak at ~28%, long smooth taper
    // Uses separate curves for head swell and body taper for realism
    let width: number;
    if (t < 0.08) {
      // Snout: very narrow, pointed
      width = t / 0.08 * 0.06;
    } else if (t < 0.28) {
      // Head swell: rapid widening to shoulder
      const u = (t - 0.08) / 0.20;
      width = 0.06 + u * u * (3 - 2 * u) * 0.13; // smoothstep
    } else if (t < 0.55) {
      // Mid-body: broad, slight taper
      const u = (t - 0.28) / 0.27;
      width = 0.19 - u * 0.03;
    } else {
      // Rear taper to peduncle
      const u = (t - 0.55) / 0.45;
      width = 0.16 * Math.pow(1 - u, 1.8);
    }

    // Dorsal is rounder than ventral
    const dorsalBias = 1.18;
    const ventralBias = 0.82;

    // Natural dorsal arch — back curves up gently
    const spineY = -Math.sin(t * Math.PI * 0.75) * 0.018;

    pts.push({
      x: t,
      y: spineY,
      widthTop: width * dorsalBias,
      widthBot: width * ventralBias,
    });
  }
  return pts;
}

export const REST_SPINE = generateSpine(30);

export const FISH_PROFILE = {
  eye: { x: 0.12, y: -0.045, radius: 0.032 },

  dorsalFin: [
    { at: 0.20, h: 0.06 },
    { at: 0.26, h: 0.10 },
    { at: 0.32, h: 0.13 },
    { at: 0.38, h: 0.11 },
    { at: 0.44, h: 0.08 },
    { at: 0.50, h: 0.05 },
  ],

  pectoralFin: { at: 0.24, drop: 0.08, length: 0.14, width: 0.045 },
  ventralFin: { at: 0.42, drop: 0.06, length: 0.08, width: 0.03 },
  analFin: { at: 0.60, drop: 0.05, length: 0.10, width: 0.025 },

  tail: {
    forkSpread: 0.16,
    forkLength: 0.14,
    innerCurve: 0.05,
  },

  gill: { at: 0.18, length: 0.06 },

  bubbles: [] as { x: number; y: number; r: number }[],

  /** Lateral line position (fraction from dorsal 0 to ventral 1) */
  lateralLine: 0.4,
};

/**
 * Animate the spine: wave propagates head→tail, amplitude increases toward tail.
 * Returns a new spine array (does not mutate REST_SPINE).
 */
export function computeAnimatedSpine(
  time: number,
  swimSpeed: number,
  waveFreq: number,
  waveSpeed: number,
  tailAmp: number,
  headStiffness: number
): SpinePoint[] {
  const n = REST_SPINE.length - 1;
  return REST_SPINE.map((pt, i) => {
    const t = i / n; // 0 head, 1 tail

    // ── Primary wave: amplitude ramps up toward tail (cubic) ──
    const amp = tailAmp * Math.pow(t, 2.3) * (1 - headStiffness * Math.pow(1 - t, 2));
    const phase = t * waveFreq * Math.PI * 2;
    const speedMult = 0.35 + swimSpeed * 0.65;
    const primary = Math.sin(time * waveSpeed + phase) * amp * speedMult;

    // ── Secondary harmonic: smaller, faster wave adds organic complexity ──
    const secondary = Math.sin(time * waveSpeed * 1.7 + phase * 1.3) * amp * 0.15 * speedMult;

    // ── Micro head-yaw: the head sways very slightly opposite to the body ──
    const headYaw = t < 0.15
      ? -Math.sin(time * waveSpeed + 0.5) * tailAmp * 0.08 * speedMult * (1 - t / 0.15)
      : 0;

    const offset = primary + secondary + headYaw;

    // Body compression/extension (fish body shortens on the curving side)
    const xShift = -Math.cos(time * waveSpeed + phase) * amp * 0.12 * speedMult * t;

    // Breathing: slow, subtle width pulse
    const breathe = 1 + Math.sin(time * 0.9 + t * Math.PI * 0.4) * 0.015;

    // Slight width increase during active swimming (muscles flexed)
    const swimFlex = 1 + speedMult * 0.02 * Math.sin(time * waveSpeed * 2 + phase) * (t > 0.15 && t < 0.6 ? 1 : 0);

    return {
      x: pt.x + xShift,
      y: pt.y + offset,
      widthTop: pt.widthTop * breathe * swimFlex,
      widthBot: pt.widthBot * breathe * swimFlex,
    };
  });
}

/**
 * Catmull-Rom interpolation along the spine.
 */
export function interpolateSpine(
  spine: SpinePoint[],
  t: number
): { x: number; y: number; widthTop: number; widthBot: number } {
  const n = spine.length - 1;
  const f = Math.max(0, Math.min(1, t)) * n;
  const i = Math.floor(f);
  const frac = f - i;

  const p0 = spine[Math.max(0, i - 1)];
  const p1 = spine[i];
  const p2 = spine[Math.min(n, i + 1)];
  const p3 = spine[Math.min(n, i + 2)];

  const cr = (a: number, b: number, c: number, d: number, u: number) => {
    const u2 = u * u;
    const u3 = u2 * u;
    return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  };

  return {
    x: cr(p0.x, p1.x, p2.x, p3.x, frac),
    y: cr(p0.y, p1.y, p2.y, p3.y, frac),
    widthTop: cr(p0.widthTop, p1.widthTop, p2.widthTop, p3.widthTop, frac),
    widthBot: cr(p0.widthBot, p1.widthBot, p2.widthBot, p3.widthBot, frac),
  };
}

/**
 * Compute the normal (perpendicular) direction at a spine index.
 * Returns a unit vector pointing "up" relative to the fish body.
 */
export function spineNormal(
  spine: SpinePoint[],
  i: number
): { nx: number; ny: number } {
  const n = spine.length - 1;
  const prev = spine[Math.max(0, i - 1)];
  const next = spine[Math.min(n, i + 1)];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular (rotated 90° CCW)
  return { nx: -dy / len, ny: dx / len };
}
