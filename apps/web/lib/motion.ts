/**
 * V7 Motion System
 * UI motion < 340ms. Cinema moments may reach 720ms.
 * Cinema moments are globally throttled through SceneConductor (Phase 4).
 */

export const easing = {
  standard: [0.4, 0.0, 0.2, 1] as const,
  entrance: [0.16, 1, 0.3, 1] as const,
  exit: [0.7, 0, 0.84, 0] as const,
  spring: { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.9 },
  cinema: [0.22, 1, 0.36, 1] as const,
} as const;

export const duration = {
  xs: 80,
  sm: 140,
  md: 220,
  lg: 340,
  cinema: 720,
} as const;

/** CSS cubic-bezier strings for use in inline styles / CSS variables */
export const easingCSS = {
  standard: "cubic-bezier(0.4, 0.0, 0.2, 1)",
  entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
  exit: "cubic-bezier(0.7, 0, 0.84, 0)",
  cinema: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;
