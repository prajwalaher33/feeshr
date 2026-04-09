/**
 * Fish Animation System — Configuration
 *
 * Central configuration for the living fish. Tune motion intensity,
 * glow strength, behavioral timing, and visual parameters here.
 * All values are designed for a premium, cinematic feel.
 */

export const FISH_CONFIG = {
  /* ─── Visual ─── */
  color: {
    body: "#22d3ee",
    bodyLight: "#67e8f9",
    bodyDark: "#0e7490",
    glow: "rgba(34, 211, 238, 0.15)",
    glowStrong: "rgba(34, 211, 238, 0.3)",
    eye: "#0f172a",
    eyeHighlight: "#ffffff",
    eyeIris: "rgba(34, 211, 238, 0.4)",
    bubble: "rgba(180, 240, 255, 0.4)",
    trail: "rgba(34, 211, 238, 0.06)",
  },

  /* ─── Size (base, before scaling by viewport) ─── */
  baseSizeVw: 0.12, // fish size as fraction of viewport width
  minSize: 80,
  maxSize: 220,

  /* ─── Swimming Physics ─── */
  swim: {
    /** Base cruise speed (px/frame at 60fps) */
    cruiseSpeed: 1.2,
    /** Max speed during bursts */
    burstSpeed: 3.5,
    /** How strongly the fish turns toward its target (0-1) */
    steerStrength: 0.015,
    /** Momentum decay (1 = no decay, 0 = instant stop) */
    momentum: 0.985,
    /** How often the fish picks a new wander target (ms) */
    wanderInterval: 4000,
    /** Margin from viewport edges (px) */
    edgeMargin: 80,
  },

  /* ─── Body Undulation ─── */
  undulation: {
    /** Number of segments in the fish spine */
    spineSegments: 30,
    /** Wave frequency along the body */
    waveFrequency: 2.2,
    /** Wave speed (rad/s) */
    waveSpeed: 3.5,
    /** Max amplitude at the tail (px, multiplied by fish size) */
    tailAmplitude: 0.10,
    /** How much the head resists undulation (0 = full, 1 = none) */
    headStiffness: 0.90,
  },

  /* ─── Glow & Bioluminescence ─── */
  glow: {
    /** Base bloom radius as multiplier of fish size */
    bloomRadius: 2.5,
    /** Pulse speed (rad/s) */
    pulseSpeed: 1.2,
    /** Pulse intensity range */
    pulseMin: 0.6,
    pulseMax: 1.0,
    /** Trail length (number of ghost positions) */
    trailLength: 12,
    /** Trail opacity decay per step */
    trailDecay: 0.07,
  },

  /* ─── Cursor Interaction ─── */
  cursor: {
    /** Distance at which fish notices cursor (px) */
    awarenessRadius: 250,
    /** Distance at which fish flees (px) */
    fleeRadius: 120,
    /** Flee force multiplier */
    fleeStrength: 0.08,
    /** Eye tracking smoothness (0-1, lower = smoother) */
    eyeTrackSpeed: 0.05,
  },

  /* ─── Scroll Reaction ─── */
  scroll: {
    /** How much scroll velocity affects fish speed */
    influence: 0.3,
    /** Vertical drift per scroll delta */
    driftFactor: 0.5,
  },

  /* ─── Behavioral Timing ─── */
  behavior: {
    /** Delay before hero entrance begins (ms) */
    entranceDelay: 800,
    /** Duration of hero entrance animation (ms) */
    entranceDuration: 3000,
    /** Idle breath cycle period (ms) */
    breathPeriod: 4000,
    /** Chance of a curious pause per wander cycle */
    pauseChance: 0.15,
    /** Duration of curious pause (ms) */
    pauseDuration: 1500,
  },

  /* ─── Performance ─── */
  performance: {
    /** Max bubbles alive at once */
    maxBubbles: 8,
    /** Target FPS */
    targetFps: 60,
    /** Disable canvas effects on mobile */
    mobileSimplified: true,
    /** Viewport width below which mobile mode activates */
    mobileBreakpoint: 768,
  },

  /* ─── Z-Index Layering ─── */
  zIndex: {
    canvas: 50,
    aboveContent: false, // fish renders behind page content by default
  },
} as const;

export type FishConfig = typeof FISH_CONFIG;
