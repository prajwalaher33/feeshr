import { noise2d } from "./perlin";
import type { Particle, Pulse, Ripple } from "./types";

const TIER_COLORS = [
  "0,229,255",   // cyan - Observer
  "0,230,118",   // green - Contributor
  "255,181,71",  // amber - Builder
  "255,107,107", // coral - Specialist
  "0,0,0",       // black - Architect
];
const TIER_WEIGHTS = [40, 30, 15, 10, 5]; // distribution

function pickColor(): string {
  const r = Math.random() * 100;
  let sum = 0;
  for (let i = 0; i < TIER_WEIGHTS.length; i++) {
    sum += TIER_WEIGHTS[i];
    if (r < sum) return TIER_COLORS[i];
  }
  return TIER_COLORS[0];
}

export function createParticles(count: number, w: number, h: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      radius: 1.5 + Math.random() * 2.5,
      color: pickColor(),
      glowAlpha: 0.3 + Math.random() * 0.4,
      noiseOffsetX: Math.random() * 1000,
      noiseOffsetY: Math.random() * 1000,
    });
  }
  return particles;
}

const NOISE_SCALE = 0.001;
const NOISE_SPEED = 0.0003;
const DRIFT_STRENGTH = 0.35;

export function updateParticles(
  particles: Particle[],
  w: number,
  h: number,
  time: number,
  mouseX: number,
  mouseY: number,
  mouseActive: boolean,
) {
  for (const p of particles) {
    // Perlin noise drift
    const nx = noise2d(p.x * NOISE_SCALE + p.noiseOffsetX, time * NOISE_SPEED);
    const ny = noise2d(p.y * NOISE_SCALE + p.noiseOffsetY, time * NOISE_SPEED + 100);
    p.vx += nx * DRIFT_STRENGTH * 0.1;
    p.vy += ny * DRIFT_STRENGTH * 0.1;

    // Mouse attraction
    if (mouseActive) {
      const dx = mouseX - p.x;
      const dy = mouseY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200 && dist > 1) {
        const force = 0.02 * (1 - dist / 200);
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
    }

    // Damping
    p.vx *= 0.96;
    p.vy *= 0.96;

    p.x += p.vx;
    p.y += p.vy;

    // Wrap edges
    if (p.x < -20) p.x = w + 20;
    if (p.x > w + 20) p.x = -20;
    if (p.y < -20) p.y = h + 20;
    if (p.y > h + 20) p.y = -20;
  }
}

const CONNECTION_DIST = 150;

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  pulses: Pulse[],
  ripples: Ripple[],
  w: number,
  h: number,
  opacity: number,
) {
  ctx.clearRect(0, 0, w, h);

  // Fill with white background
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = opacity;

  // Draw connections
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DIST) {
        const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // Draw ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += 1.5;
    r.alpha -= 0.012;
    if (r.alpha <= 0 || r.radius > r.maxRadius) { ripples.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r.color},${r.alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw pulses along connections
  for (let i = pulses.length - 1; i >= 0; i--) {
    const pulse = pulses[i];
    pulse.progress += pulse.speed;
    if (pulse.progress >= 1) { pulses.splice(i, 1); continue; }
    const from = particles[pulse.fromIdx];
    const to = particles[pulse.toIdx];
    if (!from || !to) { pulses.splice(i, 1); continue; }
    const px = from.x + (to.x - from.x) * pulse.progress;
    const py = from.y + (to.y - from.y) * pulse.progress;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, 6);
    grad.addColorStop(0, `rgba(${pulse.color},${pulse.alpha})`);
    grad.addColorStop(1, `rgba(${pulse.color},0)`);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Draw particles
  for (const p of particles) {
    // Glow
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 6);
    grad.addColorStop(0, `rgba(${p.color},${p.glowAlpha * 0.3})`);
    grad.addColorStop(1, `rgba(${p.color},0)`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 6, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.color},${p.glowAlpha + 0.3})`;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export function spawnPulse(particles: Particle[]): Pulse | null {
  if (particles.length < 2) return null;
  // Find two connected particles
  for (let attempt = 0; attempt < 10; attempt++) {
    const i = Math.floor(Math.random() * particles.length);
    const j = Math.floor(Math.random() * particles.length);
    if (i === j) continue;
    const dx = particles[i].x - particles[j].x;
    const dy = particles[i].y - particles[j].y;
    if (Math.sqrt(dx * dx + dy * dy) < CONNECTION_DIST) {
      return { fromIdx: i, toIdx: j, progress: 0, speed: 0.015 + Math.random() * 0.01, color: "0,229,255", alpha: 0.7 };
    }
  }
  return null;
}

export function spawnRipple(particles: Particle[]): Ripple | null {
  if (particles.length === 0) return null;
  const p = particles[Math.floor(Math.random() * particles.length)];
  return { x: p.x, y: p.y, radius: 0, maxRadius: 80, alpha: 0.4, color: p.color };
}
