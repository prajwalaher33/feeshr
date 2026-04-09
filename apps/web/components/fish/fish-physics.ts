/**
 * Fish Physics — Organic movement with real swimming feel
 *
 * Key realism features:
 * - Burst-coast cycle: fish accelerates then glides (like real fish)
 * - Banking: body tilts slightly into turns
 * - Idle drift: gentle sinusoidal sway when paused
 * - Direction jitter: micro-corrections for organic path
 * - Deceleration before turns: fish slows before changing direction
 * - Smooth eye tracking with inertia
 */

import { FISH_CONFIG } from "./fish-config";
import type { FishState } from "./fish-renderer";

export interface PhysicsInput {
  viewW: number;
  viewH: number;
  scrollY: number;
  scrollDelta: number;
  cursorX: number;
  cursorY: number;
  cursorActive: boolean;
  dt: number;
  elapsed: number;
}

interface InternalState {
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  wanderTimer: number;
  pauseTimer: number;
  isPaused: boolean;
  phase: "entrance" | "swimming";
  entranceT: number;
  trailTimer: number;
  smoothEyeX: number;
  smoothEyeY: number;
  /** Burst-coast state: 0 = coasting, 1 = bursting */
  burstPhase: number;
  burstTimer: number;
  /** Accumulated angle for banking calculation */
  angularVelocity: number;
  prevAngle: number;
}

const cfg = FISH_CONFIG;

export function createFishState(viewW: number, viewH: number): {
  fish: FishState;
  internal: InternalState;
} {
  const size = Math.max(cfg.minSize, Math.min(cfg.maxSize, viewW * cfg.baseSizeVw));
  return {
    fish: {
      x: -size,
      y: viewH * 0.15,
      angle: 0,
      speed: 0,
      size,
      time: 0,
      opacity: 0,
      trail: [],
      eyeOffsetX: 0,
      eyeOffsetY: 0,
    },
    internal: {
      targetX: viewW * 0.5,
      targetY: viewH * 0.3,
      vx: cfg.swim.cruiseSpeed,
      vy: 0,
      wanderTimer: 0,
      pauseTimer: 0,
      isPaused: false,
      phase: "entrance",
      entranceT: 0,
      trailTimer: 0,
      smoothEyeX: 0,
      smoothEyeY: 0,
      burstPhase: 0,
      burstTimer: 0,
      angularVelocity: 0,
      prevAngle: 0,
    },
  };
}

export function updateFish(
  fish: FishState,
  s: InternalState,
  input: PhysicsInput
): void {
  const { viewW, viewH, cursorX, cursorY, cursorActive, dt, elapsed, scrollDelta } = input;
  fish.time = elapsed;
  const margin = cfg.swim.edgeMargin;

  // ── Entrance ──
  if (s.phase === "entrance") {
    s.entranceT += dt * 1000;
    const progress = Math.min(1, s.entranceT / cfg.behavior.entranceDuration);
    const ease = 1 - Math.pow(1 - progress, 3);

    fish.opacity = Math.min(1, progress * 2.5);
    fish.x = -fish.size + ease * (viewW * 0.35 + fish.size);
    fish.y = viewH * 0.15 + Math.sin(progress * Math.PI * 1.2) * viewH * 0.06;
    fish.angle = Math.sin(progress * Math.PI * 2.5) * 0.12;
    fish.speed = 0.3 + ease * 0.4;

    s.vx = cfg.swim.cruiseSpeed;
    s.vy = 0;

    if (progress >= 1) {
      s.phase = "swimming";
      s.targetX = viewW * 0.5;
      s.targetY = viewH * 0.3;
    }

    updateTrail(fish, s, dt);
    updateEye(fish, s, cursorX, cursorY, cursorActive, dt);
    return;
  }

  // ── Burst-coast cycle ──
  s.burstTimer -= dt * 1000;
  if (s.burstTimer <= 0) {
    if (s.burstPhase < 0.5) {
      // Start a burst
      s.burstPhase = 1;
      s.burstTimer = 600 + Math.random() * 800; // burst duration
    } else {
      // Start coasting
      s.burstPhase = 0;
      s.burstTimer = 1500 + Math.random() * 2500; // coast duration
    }
  }
  // Smooth the burst phase
  const burstTarget = s.burstPhase;
  const currentBurst = fish.speed;
  const burstBlend = burstTarget > currentBurst ? 0.04 : 0.015; // accelerate fast, decelerate slowly

  // ── Wander target selection ──
  s.wanderTimer -= dt * 1000;
  if (s.wanderTimer <= 0 && !s.isPaused) {
    s.targetX = margin + Math.random() * (viewW - margin * 2);
    s.targetY = margin + Math.random() * (viewH - margin * 2);
    s.wanderTimer = cfg.swim.wanderInterval * (0.7 + Math.random() * 0.6);

    if (Math.random() < cfg.behavior.pauseChance) {
      s.isPaused = true;
      s.pauseTimer = cfg.behavior.pauseDuration * (0.5 + Math.random());
    }
  }

  // ── Pause: idle drift ──
  if (s.isPaused) {
    s.pauseTimer -= dt * 1000;
    if (s.pauseTimer <= 0) s.isPaused = false;

    // Gentle sinusoidal drift (fish never fully stops — they hover)
    s.vx *= 0.97;
    s.vy *= 0.97;
    s.vx += Math.sin(elapsed * 0.6) * 0.005;
    s.vy += Math.cos(elapsed * 0.8) * 0.003;
    fish.speed += (0.08 - fish.speed) * 0.03; // slow down to idle speed
  } else {
    // ── Steering toward target ──
    const dx = s.targetX - fish.x;
    const dy = s.targetY - fish.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Decelerate when approaching a sharp turn
      const currentDir = Math.atan2(s.vy, s.vx);
      const targetDir = Math.atan2(ny, nx);
      let turnAngle = targetDir - currentDir;
      while (turnAngle > Math.PI) turnAngle -= Math.PI * 2;
      while (turnAngle < -Math.PI) turnAngle += Math.PI * 2;
      const turnSharpness = Math.abs(turnAngle) / Math.PI; // 0-1
      const turnBrake = 1 - turnSharpness * 0.4; // slow down for sharp turns

      const steer = cfg.swim.steerStrength * dist * 0.01 * turnBrake;
      s.vx += nx * steer;
      s.vy += ny * steer;
    }

    // Direction jitter: micro random impulses for organic look
    s.vx += (Math.random() - 0.5) * 0.008;
    s.vy += (Math.random() - 0.5) * 0.005;

    // Speed from burst-coast
    const speedTarget = Math.min(1, burstTarget * 0.7 + (dist / (viewW * 0.4)) * 0.3);
    fish.speed += (speedTarget - fish.speed) * burstBlend;
  }

  // ── Edge avoidance (soft exponential push) ──
  const edgePush = (pos: number, limit: number, dir: number) => {
    const d = dir > 0 ? limit - pos : pos;
    if (d < margin) {
      const force = Math.pow(1 - d / margin, 2) * 0.15;
      return dir > 0 ? -force : force;
    }
    return 0;
  };
  s.vx += edgePush(fish.x, viewW, 1) + edgePush(fish.x, 0, -1);
  s.vy += edgePush(fish.y, viewH, 1) + edgePush(fish.y, 0, -1);

  // ── Cursor interaction ──
  if (cursorActive) {
    const cdx = fish.x - cursorX;
    const cdy = fish.y - cursorY;
    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
    if (cdist < cfg.cursor.fleeRadius && cdist > 0) {
      const fleeMag = Math.pow(1 - cdist / cfg.cursor.fleeRadius, 2) * cfg.cursor.fleeStrength;
      s.vx += (cdx / cdist) * fleeMag * fish.size;
      s.vy += (cdy / cdist) * fleeMag * fish.size;
      fish.speed = Math.min(1, fish.speed + 0.15); // startled burst
    }
  }

  // ── Scroll influence ──
  if (Math.abs(scrollDelta) > 0.5) {
    s.vy += scrollDelta * cfg.scroll.driftFactor * 0.008;
    fish.speed = Math.min(1, fish.speed + Math.abs(scrollDelta) * cfg.scroll.influence * 0.0008);
  }

  // ── Velocity clamping + momentum ──
  const maxSpeed = cfg.swim.cruiseSpeed + (cfg.swim.burstSpeed - cfg.swim.cruiseSpeed) * fish.speed;
  const vMag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  if (vMag > maxSpeed) {
    s.vx = (s.vx / vMag) * maxSpeed;
    s.vy = (s.vy / vMag) * maxSpeed;
  }

  fish.x += s.vx;
  fish.y += s.vy;
  s.vx *= cfg.swim.momentum;
  s.vy *= cfg.swim.momentum;

  // ── Angle follows velocity with banking ──
  if (vMag > 0.05) {
    const targetAngle = Math.atan2(s.vy, s.vx);
    let angleDiff = targetAngle - fish.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Smooth turn with variable rate (faster when speed is higher)
    const turnRate = 0.04 + fish.speed * 0.03;
    fish.angle += angleDiff * turnRate;

    // Track angular velocity for banking
    s.angularVelocity = fish.angle - s.prevAngle;
    s.prevAngle = fish.angle;
  }

  fish.opacity = 1;

  updateTrail(fish, s, dt);
  updateEye(fish, s, cursorX, cursorY, cursorActive, dt);
}

function updateTrail(fish: FishState, s: InternalState, dt: number) {
  s.trailTimer += dt;
  if (s.trailTimer > 0.06) {
    s.trailTimer = 0;
    fish.trail.unshift({ x: fish.x, y: fish.y, angle: fish.angle });
    if (fish.trail.length > FISH_CONFIG.glow.trailLength) fish.trail.pop();
  }
}

function updateEye(
  fish: FishState,
  s: InternalState,
  cursorX: number,
  cursorY: number,
  cursorActive: boolean,
  dt: number
) {
  if (!cursorActive) {
    // Idle eye: gentle wander
    const idleX = Math.sin(fish.time * 0.5) * 0.3;
    const idleY = Math.cos(fish.time * 0.7) * 0.2;
    s.smoothEyeX += (idleX - s.smoothEyeX) * 0.02;
    s.smoothEyeY += (idleY - s.smoothEyeY) * 0.02;
  } else {
    const dx = cursorX - fish.x;
    const dy = cursorY - fish.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      // Transform cursor direction into fish-local space
      const cosA = Math.cos(-fish.angle);
      const sinA = Math.sin(-fish.angle);
      const localX = (dx * cosA - dy * sinA) / dist;
      const localY = (dx * sinA + dy * cosA) / dist;

      // Smooth tracking with variable speed (faster when close)
      const trackSpeed = cfg.cursor.eyeTrackSpeed * (1 + 200 / (dist + 100));
      s.smoothEyeX += (localX - s.smoothEyeX) * trackSpeed;
      s.smoothEyeY += (localY - s.smoothEyeY) * trackSpeed;
    }
  }
  fish.eyeOffsetX = s.smoothEyeX;
  fish.eyeOffsetY = s.smoothEyeY;
}

export function resizeFish(fish: FishState, viewW: number, viewH: number) {
  fish.size = Math.max(cfg.minSize, Math.min(cfg.maxSize, viewW * cfg.baseSizeVw));
  fish.x = Math.max(0, Math.min(viewW, fish.x));
  fish.y = Math.max(0, Math.min(viewH, fish.y));
}
