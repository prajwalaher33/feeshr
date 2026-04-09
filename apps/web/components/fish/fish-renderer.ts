/**
 * Fish Renderer — Biologically alive bioluminescent deep-sea fish
 *
 * Key realism features added:
 * - Gill breathing: gill slit opens/closes rhythmically
 * - Eye blink: occasional lid closing
 * - Iridescent color shift: hue varies along body based on time
 * - Countershading: dark back, silver belly (like real pelagic fish)
 * - Wet specular highlights with Fresnel-like edge glow
 * - Living fin membranes: translucent with blood-vessel ray patterns
 * - Peduncle-to-tail smooth transition
 * - Micro fin twitches during idle
 */

import { FISH_CONFIG } from "./fish-config";
import {
  computeAnimatedSpine,
  interpolateSpine,
  spineNormal,
  FISH_PROFILE,
  type SpinePoint,
} from "./fish-geometry";

export interface FishState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  time: number;
  opacity: number;
  trail: { x: number; y: number; angle: number }[];
  eyeOffsetX: number;
  eyeOffsetY: number;
}

/* ── Contour builder ── */
function buildContours(spine: SpinePoint[], size: number) {
  const upper: { x: number; y: number }[] = [];
  const lower: { x: number; y: number }[] = [];
  for (let i = 0; i < spine.length; i++) {
    const pt = spine[i];
    const { nx, ny } = spineNormal(spine, i);
    const px = (0.5 - pt.x) * size;
    const py = pt.y * size;
    upper.push({ x: px + nx * pt.widthTop * size, y: py + ny * pt.widthTop * size });
    lower.push({ x: px - nx * pt.widthBot * size, y: py - ny * pt.widthBot * size });
  }
  return { upper, lower };
}

/* ── Smooth body path ── */
function traceBodyPath(
  ctx: CanvasRenderingContext2D,
  upper: { x: number; y: number }[],
  lower: { x: number; y: number }[]
) {
  ctx.beginPath();
  ctx.moveTo(upper[0].x, upper[0].y);
  for (let i = 1; i < upper.length; i++) {
    const p = upper[i - 1], c = upper[i];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
  }
  ctx.lineTo(upper[upper.length - 1].x, upper[upper.length - 1].y);
  ctx.lineTo(lower[lower.length - 1].x, lower[lower.length - 1].y);
  for (let i = lower.length - 2; i >= 0; i--) {
    const p = lower[i + 1], c = lower[i];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
  }
  ctx.closePath();
}

/* ── Pseudo-random from seed (deterministic shimmer) ── */
function hash(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ══════════════════════════════════════════════════════════
   MAIN RENDER
   ══════════════════════════════════════════════════════════ */
export function renderFish(ctx: CanvasRenderingContext2D, state: FishState) {
  const { x, y, angle, speed, size, time, opacity, trail, eyeOffsetX, eyeOffsetY } = state;
  if (opacity <= 0 || size < 10) return;

  const cfg = FISH_CONFIG;
  const spine = computeAnimatedSpine(
    time, speed,
    cfg.undulation.waveFrequency, cfg.undulation.waveSpeed,
    cfg.undulation.tailAmplitude, cfg.undulation.headStiffness
  );
  const { upper, lower } = buildContours(spine, size);
  const pulse = cfg.glow.pulseMin +
    (cfg.glow.pulseMax - cfg.glow.pulseMin) * (0.5 + 0.5 * Math.sin(time * cfg.glow.pulseSpeed));

  // Gill breathing rhythm (separate from body wave)
  const gillBreath = Math.sin(time * 1.8) * 0.5 + 0.5; // 0→1 open/close

  // Blink: ~0.15s lid close every ~5-8 seconds
  const blinkCycle = time % (5 + hash(Math.floor(time / 6)) * 3);
  const blink = blinkCycle < 0.15 ? 1 - (blinkCycle / 0.075 < 1 ? blinkCycle / 0.075 : 2 - blinkCycle / 0.075) : 0;

  ctx.save();
  ctx.globalAlpha = opacity;

  /* ─── Glow halo ─── */
  const bloomR = size * cfg.glow.bloomRadius;
  const g1 = ctx.createRadialGradient(x, y, size * 0.15, x, y, bloomR);
  g1.addColorStop(0, `rgba(34, 211, 238, ${0.06 * pulse})`);
  g1.addColorStop(0.5, `rgba(34, 211, 238, ${0.02 * pulse})`);
  g1.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(x, y, bloomR, 0, Math.PI * 2);
  ctx.fill();

  /* ─── Trail ghosts ─── */
  for (let i = trail.length - 1; i >= 0; i--) {
    const tr = trail[i];
    const a = (1 - i / trail.length) * cfg.glow.trailDecay;
    if (a < 0.002) continue;
    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.rotate(tr.angle);
    ctx.globalAlpha = a * opacity;
    traceBodyPath(ctx, upper, lower);
    ctx.fillStyle = "rgba(34, 211, 238, 0.2)";
    ctx.fill();
    ctx.restore();
  }

  /* ─── Fish local space ─── */
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  /* ─── Tail ─── */
  drawTail(ctx, spine, size, time);

  /* ─── Under-fins (drawn before body so they peek from underneath) ─── */
  drawSmallFin(ctx, spine, size, time, FISH_PROFILE.analFin, 1);
  drawSmallFin(ctx, spine, size, time, FISH_PROFILE.ventralFin, 1);

  /* ─── Body base fill ─── */
  traceBodyPath(ctx, upper, lower);
  const bodyGrad = ctx.createLinearGradient(size * 0.45, -size * 0.1, -size * 0.4, size * 0.06);
  bodyGrad.addColorStop(0, "#b5f5fc");
  bodyGrad.addColorStop(0.12, "#6ce8f5");
  bodyGrad.addColorStop(0.3, "#22d3ee");
  bodyGrad.addColorStop(0.55, "#0ea5c2");
  bodyGrad.addColorStop(0.75, "#0891b2");
  bodyGrad.addColorStop(1, "#065f73");
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  /* ─── Iridescent shimmer overlay ─── */
  ctx.save();
  traceBodyPath(ctx, upper, lower);
  ctx.clip();
  // Slow travelling hue-shift bands
  const iriNum = 4;
  for (let b = 0; b < iriNum; b++) {
    const phase = time * 0.3 + b * 1.8;
    const cx = Math.sin(phase) * size * 0.3;
    const cy = Math.cos(phase * 0.7) * size * 0.08;
    const hue = 175 + Math.sin(phase * 0.5) * 15; // cyan ± shift
    const iriGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.2);
    iriGrad.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.06)`);
    iriGrad.addColorStop(1, "hsla(190, 80%, 50%, 0)");
    ctx.fillStyle = iriGrad;
    ctx.fillRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.6);
  }
  ctx.restore();

  /* ─── Countershading: dark back → light belly ─── */
  ctx.save();
  traceBodyPath(ctx, upper, lower);
  ctx.clip();
  const csGrad = ctx.createLinearGradient(0, -size * 0.19, 0, size * 0.17);
  csGrad.addColorStop(0, "rgba(2, 40, 55, 0.3)");      // dark dorsal
  csGrad.addColorStop(0.25, "rgba(0,0,0,0)");
  csGrad.addColorStop(0.5, "rgba(180,245,255,0.05)");    // silver mid-flank
  csGrad.addColorStop(0.7, "rgba(220,252,255,0.07)");    // bright belly
  csGrad.addColorStop(0.85, "rgba(0,0,0,0)");
  csGrad.addColorStop(1, "rgba(0, 15, 25, 0.25)");       // ventral shadow
  ctx.fillStyle = csGrad;
  ctx.fillRect(-size * 0.6, -size * 0.3, size * 1.2, size * 0.6);
  ctx.restore();

  /* ─── Subsurface scattering rim ─── */
  ctx.save();
  traceBodyPath(ctx, upper, lower);
  ctx.clip();
  ctx.lineWidth = size * 0.02;
  ctx.strokeStyle = `rgba(160, 248, 255, ${0.15 + pulse * 0.08})`;
  ctx.beginPath();
  ctx.moveTo(upper[0].x, upper[0].y);
  for (let i = 1; i < Math.floor(upper.length * 0.7); i++) {
    const p = upper[i - 1], c = upper[i];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
  }
  ctx.stroke();
  // Bottom rim too (fainter)
  ctx.lineWidth = size * 0.012;
  ctx.strokeStyle = `rgba(180, 250, 255, ${0.06 + pulse * 0.03})`;
  ctx.beginPath();
  ctx.moveTo(lower[0].x, lower[0].y);
  for (let i = 1; i < Math.floor(lower.length * 0.6); i++) {
    const p = lower[i - 1], c = lower[i];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2);
  }
  ctx.stroke();
  ctx.restore();

  /* ─── Scale pattern ─── */
  ctx.save();
  traceBodyPath(ctx, upper, lower);
  ctx.clip();
  ctx.globalAlpha = 0.035;
  const sc = size * 0.03;
  for (let sx = -size * 0.38; sx < size * 0.42; sx += sc * 1.7) {
    for (let sy = -size * 0.14; sy < size * 0.14; sy += sc * 1.5) {
      const off = (Math.floor(sy / (sc * 1.5)) % 2) * sc * 0.85;
      ctx.beginPath();
      ctx.arc(sx + off, sy, sc, Math.PI * 0.7, Math.PI * 2.3);
      ctx.strokeStyle = "rgba(190, 245, 255, 1)";
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
  }
  ctx.restore();

  /* ─── Lateral line ─── */
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  const llF = FISH_PROFILE.lateralLine;
  for (let i = 3; i < spine.length - 5; i++) {
    const u = upper[i], l = lower[i];
    const lx = u.x + (l.x - u.x) * llF;
    const ly = u.y + (l.y - u.y) * llF;
    if (i === 3) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
  }
  ctx.strokeStyle = "rgba(180, 240, 255, 1)";
  ctx.lineWidth = size * 0.004;
  ctx.setLineDash([size * 0.01, size * 0.008]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* ─── Gill slit (breathing) ─── */
  const gill = FISH_PROFILE.gill;
  const gillPt = interpolateSpine(spine, gill.at);
  const gx = (0.5 - gillPt.x) * size;
  const gyT = (gillPt.y - gillPt.widthTop * 0.55) * size;
  const gyB = (gillPt.y + gillPt.widthBot * 0.45) * size;
  // Gill opens wider during breath-in
  const gillOpen = gillBreath * size * 0.008;
  ctx.save();
  ctx.globalAlpha = 0.15 + gillBreath * 0.12;
  ctx.beginPath();
  ctx.moveTo(gx, gyT);
  ctx.bezierCurveTo(
    gx - gillOpen - size * 0.005, gyT + (gyB - gyT) * 0.3,
    gx - gillOpen - size * 0.005, gyT + (gyB - gyT) * 0.7,
    gx, gyB
  );
  ctx.strokeStyle = "rgba(6, 95, 115, 1)";
  ctx.lineWidth = size * 0.006 + gillBreath * size * 0.003;
  ctx.stroke();
  // Red/pink gill interior visible when open
  if (gillBreath > 0.4) {
    ctx.globalAlpha = (gillBreath - 0.4) * 0.15;
    ctx.beginPath();
    ctx.moveTo(gx, gyT + (gyB - gyT) * 0.2);
    ctx.bezierCurveTo(
      gx - gillOpen * 1.5, gyT + (gyB - gyT) * 0.4,
      gx - gillOpen * 1.5, gyT + (gyB - gyT) * 0.6,
      gx, gyT + (gyB - gyT) * 0.8
    );
    ctx.strokeStyle = "rgba(180, 60, 80, 1)";
    ctx.lineWidth = size * 0.004;
    ctx.stroke();
  }
  ctx.restore();

  /* ─── Specular highlight strip ─── */
  ctx.save();
  traceBodyPath(ctx, upper, lower);
  ctx.clip();
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.moveTo(upper[2].x, upper[2].y + size * 0.004);
  for (let i = 3; i < Math.floor(upper.length * 0.5); i++) {
    ctx.lineTo(upper[i].x, upper[i].y + size * 0.008);
  }
  const se = upper[Math.floor(upper.length * 0.5)];
  if (se) ctx.lineTo(se.x, se.y + size * 0.03);
  for (let i = Math.floor(upper.length * 0.5) - 1; i >= 2; i--) {
    ctx.lineTo(upper[i].x, upper[i].y + size * 0.025);
  }
  ctx.closePath();
  ctx.fillStyle = "#e0fcff";
  ctx.fill();
  ctx.restore();

  /* ─── Dorsal fin ─── */
  drawDorsalFin(ctx, spine, upper, size, time);

  /* ─── Pectoral fin ─── */
  drawPectoralFin(ctx, spine, size, time, speed);

  /* ─── Eye ─── */
  drawEye(ctx, spine, size, time, eyeOffsetX, eyeOffsetY, blink);

  /* ─── Mouth ─── */
  const nose = spine[0];
  const nx = (0.5 - nose.x) * size;
  const ny = nose.y * size;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.moveTo(nx, ny - size * 0.004);
  ctx.quadraticCurveTo(nx - size * 0.018, ny + size * 0.012, nx - size * 0.008, ny + size * 0.022);
  ctx.strokeStyle = "rgba(6, 95, 115, 1)";
  ctx.lineWidth = size * 0.005;
  ctx.stroke();
  ctx.restore();

  /* ─── Body outline (very faint) ─── */
  traceBodyPath(ctx, upper, lower);
  ctx.strokeStyle = `rgba(103, 232, 249, ${0.06 + pulse * 0.03})`;
  ctx.lineWidth = size * 0.004;
  ctx.stroke();

  ctx.restore(); // fish local
  ctx.restore(); // global alpha
}

/* ── TAIL ── */
function drawTail(ctx: CanvasRenderingContext2D, spine: SpinePoint[], size: number, time: number) {
  const t = FISH_PROFILE.tail;
  const base = spine[spine.length - 1];
  const peduncle = spine[spine.length - 3]; // smoother join
  const tbx = (0.5 - base.x) * size;
  const tby = base.y * size;
  const pbx = (0.5 - peduncle.x) * size;
  const pby = peduncle.y * size;
  const wag = Math.sin(time * FISH_CONFIG.undulation.waveSpeed * 1.3) * t.forkSpread * 0.6;

  for (const sign of [-1, 1] as const) {
    const spread = (t.forkSpread + wag * sign) * sign;
    const tipX = tbx - t.forkLength * size;
    const tipY = tby + spread * size;

    ctx.beginPath();
    // Start from peduncle for smoother body-to-tail transition
    ctx.moveTo(pbx, pby + peduncle.widthBot * size * 0.3 * sign);
    ctx.bezierCurveTo(
      tbx + size * 0.02, tby + spread * size * 0.15,
      tbx - t.forkLength * size * 0.4, tby + spread * size * 0.5,
      tipX, tipY
    );
    // Return via inner edge
    ctx.bezierCurveTo(
      tbx - t.innerCurve * size * 0.6, tby + spread * size * 0.2,
      tbx + size * 0.01, tby,
      pbx, pby
    );
    ctx.closePath();

    const tg = ctx.createLinearGradient(pbx, pby, tipX, tipY);
    tg.addColorStop(0, "rgba(8, 145, 178, 0.65)");
    tg.addColorStop(0.4, "rgba(34, 211, 238, 0.45)");
    tg.addColorStop(0.8, "rgba(103, 232, 249, 0.3)");
    tg.addColorStop(1, "rgba(160, 245, 255, 0.15)");
    ctx.fillStyle = tg;
    ctx.fill();

    // Fin rays (more of them, fanning out)
    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let r = 0.15; r <= 0.9; r += 0.15) {
      ctx.beginPath();
      ctx.moveTo(pbx, pby);
      const rx = pbx + (tipX - pbx) * r;
      const ry = pby + (tipY - pby) * r;
      ctx.lineTo(rx, ry);
      ctx.strokeStyle = "rgba(160, 245, 255, 1)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.restore();

    // Subtle edge glow on tail tips
    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(time * 2) * 0.03;
    ctx.beginPath();
    ctx.arc(tipX, tipY, size * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(160, 248, 255, 1)";
    ctx.fill();
    ctx.restore();
  }
}

/* ── DORSAL FIN ── */
function drawDorsalFin(
  ctx: CanvasRenderingContext2D,
  spine: SpinePoint[],
  upper: { x: number; y: number }[],
  size: number,
  time: number
) {
  const dorsal = FISH_PROFILE.dorsalFin;
  const n = spine.length - 1;

  ctx.beginPath();
  const d0i = Math.round(dorsal[0].at * n);
  ctx.moveTo(upper[d0i].x, upper[d0i].y);

  for (let i = 0; i < dorsal.length; i++) {
    const d = dorsal[i];
    const si = Math.round(d.at * n);
    const wave = Math.sin(time * 2.5 + i * 0.7) * 0.006;
    const fx = upper[si].x;
    const fy = upper[si].y - (d.h + wave) * size;
    if (i === 0) ctx.lineTo(fx, fy);
    else {
      const prev = dorsal[i - 1];
      const psi = Math.round(prev.at * n);
      const pfx = upper[psi].x;
      const pfy = upper[psi].y - (prev.h + Math.sin(time * 2.5 + (i - 1) * 0.7) * 0.006) * size;
      ctx.quadraticCurveTo(pfx, pfy, (pfx + fx) / 2, (pfy + fy) / 2);
    }
  }
  const dLasti = Math.round(dorsal[dorsal.length - 1].at * n);
  ctx.lineTo(upper[dLasti].x, upper[dLasti].y);
  ctx.closePath();

  // Translucent membrane gradient
  const dg = ctx.createLinearGradient(0, -size * 0.22, 0, 0);
  dg.addColorStop(0, "rgba(130, 240, 255, 0.18)");
  dg.addColorStop(0.4, "rgba(34, 211, 238, 0.35)");
  dg.addColorStop(1, "rgba(8, 145, 178, 0.5)");
  ctx.fillStyle = dg;
  ctx.fill();

  // Fin rays
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < dorsal.length; i++) {
    const d = dorsal[i];
    const si = Math.round(d.at * n);
    const w = Math.sin(time * 2.5 + i * 0.7) * 0.006;
    ctx.beginPath();
    ctx.moveTo(upper[si].x, upper[si].y);
    ctx.lineTo(upper[si].x, upper[si].y - (d.h + w) * size);
    ctx.strokeStyle = "rgba(160, 245, 255, 1)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.restore();
}

/* ── PECTORAL FIN (responds to swim speed) ── */
function drawPectoralFin(
  ctx: CanvasRenderingContext2D,
  spine: SpinePoint[],
  size: number,
  time: number,
  speed: number
) {
  const pf = FISH_PROFILE.pectoralFin;
  const pt = interpolateSpine(spine, pf.at);
  // Fin tucks closer when swimming fast, extends when gliding
  const extend = 0.25 + (1 - speed) * 0.3;
  const pfAngle = Math.sin(time * 2.0 + hash(Math.floor(time * 3)) * 0.3) * extend + 0.15;
  const pfx = (0.5 - pt.x) * size;
  const pfy = (pt.y + pt.widthBot * 0.75) * size;

  ctx.save();
  ctx.translate(pfx, pfy);
  ctx.rotate(pfAngle);

  const fLen = pf.length * size * (0.85 + extend * 0.3);
  const fWid = pf.width * size;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    -fLen * 0.25, fWid * 1.3,
    -fLen * 0.65, fWid * 1.1,
    -fLen, fWid * 0.15
  );
  ctx.bezierCurveTo(
    -fLen * 0.55, -fWid * 0.25,
    -fLen * 0.15, -fWid * 0.08,
    0, 0
  );
  ctx.closePath();

  const pg = ctx.createLinearGradient(0, 0, -fLen, 0);
  pg.addColorStop(0, "rgba(34, 211, 238, 0.4)");
  pg.addColorStop(0.5, "rgba(80, 230, 245, 0.2)");
  pg.addColorStop(1, "rgba(160, 248, 255, 0.08)");
  ctx.fillStyle = pg;
  ctx.fill();

  // Rays
  ctx.globalAlpha = 0.06;
  for (let r = 0.15; r <= 0.85; r += 0.18) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-fLen * r, fWid * (1 - r * 0.7) * 0.7);
    ctx.strokeStyle = "rgba(160, 245, 255, 1)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

/* ── SMALL FINS ── */
function drawSmallFin(
  ctx: CanvasRenderingContext2D,
  spine: SpinePoint[],
  size: number,
  time: number,
  fin: { at: number; drop: number; length: number; width: number },
  dir: number
) {
  const pt = interpolateSpine(spine, fin.at);
  const fx = (0.5 - pt.x) * size;
  const fy = (pt.y + pt.widthBot * 0.85) * size * dir;
  const fA = Math.sin(time * 1.8 + fin.at * 5 + hash(fin.at * 100) * 2) * 0.22;

  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(fA * dir);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(
    -fin.length * size * 0.4, fin.drop * size * dir,
    -fin.length * size, fin.drop * size * 0.4 * dir
  );
  ctx.quadraticCurveTo(-fin.length * size * 0.25, 0, 0, 0);
  ctx.closePath();
  ctx.fillStyle = "rgba(34, 211, 238, 0.22)";
  ctx.fill();
  ctx.restore();
}

/* ── EYE (with blink) ── */
function drawEye(
  ctx: CanvasRenderingContext2D,
  spine: SpinePoint[],
  size: number,
  time: number,
  eyeOffX: number,
  eyeOffY: number,
  blink: number // 0 = open, 1 = closed
) {
  const ec = FISH_PROFILE.eye;
  const pt = interpolateSpine(spine, ec.x);
  const ex = (0.5 - pt.x) * size;
  const ey = (pt.y + ec.y) * size;
  const er = ec.radius * size;

  // Socket
  ctx.beginPath();
  ctx.arc(ex, ey, er * 1.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(2, 8, 18, 0.9)";
  ctx.fill();

  // Iris (golden-green tint for realism)
  const irisGrad = ctx.createRadialGradient(ex, ey, er * 0.25, ex, ey, er);
  irisGrad.addColorStop(0, "rgba(12, 45, 50, 1)");
  irisGrad.addColorStop(0.35, "rgba(18, 70, 75, 1)");
  irisGrad.addColorStop(0.6, "rgba(25, 110, 100, 0.9)");
  irisGrad.addColorStop(0.8, "rgba(34, 140, 130, 0.5)");
  irisGrad.addColorStop(1, "rgba(5, 30, 40, 0.95)");
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Iris ring detail
  ctx.beginPath();
  ctx.arc(ex, ey, er * 0.65, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(40, 180, 160, ${0.12 + Math.sin(time * 1.2) * 0.04})`;
  ctx.lineWidth = size * 0.003;
  ctx.stroke();

  // Pupil (slightly oval, tracks cursor)
  const px = ex + eyeOffX * er * 0.22;
  const py = ey + eyeOffY * er * 0.22;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(0.9, 1);
  ctx.beginPath();
  ctx.arc(0, 0, er * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = "#010810";
  ctx.fill();
  ctx.restore();

  // Primary highlight (stays fixed — not affected by pupil movement)
  ctx.beginPath();
  ctx.arc(ex + er * 0.22, ey - er * 0.22, er * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();

  // Secondary highlight
  ctx.beginPath();
  ctx.arc(ex - er * 0.12, ey + er * 0.18, er * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(200, 245, 255, 0.3)";
  ctx.fill();

  // ── Blink (eyelid closing from top and bottom) ──
  if (blink > 0.01) {
    ctx.save();
    ctx.globalAlpha = blink;
    // Upper lid
    ctx.beginPath();
    ctx.ellipse(ex, ey - er * (1 - blink) * 0.5, er * 1.25, er * 0.7, 0, Math.PI, 0);
    ctx.fillStyle = "rgba(10, 60, 70, 0.95)";
    ctx.fill();
    // Lower lid
    ctx.beginPath();
    ctx.ellipse(ex, ey + er * (1 - blink) * 0.5, er * 1.25, er * 0.5, 0, 0, Math.PI);
    ctx.fillStyle = "rgba(8, 50, 60, 0.9)";
    ctx.fill();
    ctx.restore();
  }

  // Wet reflection arc across the top of the eye
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.arc(ex, ey, er * 1.1, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.strokeStyle = "rgba(200, 250, 255, 1)";
  ctx.lineWidth = size * 0.004;
  ctx.stroke();
  ctx.restore();
}
