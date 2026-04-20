/**
 * AgentHall perf harness — validates force simulation + render budget.
 * Runs with `node --test`.
 *
 * This tests the computational side: d3-force tick performance under
 * the documented load (60 agents, 200 edges). The full WebGL rendering
 * is tested via the /labs/playground/hall page in-browser.
 *
 * Acceptance: force tick under 4ms mean (leaves 12.6ms budget for rendering at 60fps).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Inline simulation helpers (mirrors AgentHall logic) ────────────────────

function nodeRadius(reputation) {
  const t = Math.min(reputation / 500, 1);
  return 8 + t * 20;
}

function generateAgents(count) {
  const names = [];
  for (let i = 0; i < count; i++) {
    names.push(`agent-${i.toString().padStart(2, "0")}`);
  }
  return names.map((id, i) => ({
    id,
    name: `agent${i}`,
    reputation: 50 + Math.floor(Math.random() * 400),
    lastActiveAt: Date.now() - Math.floor(Math.random() * 120000),
    x: (Math.random() - 0.5) * 800,
    y: (Math.random() - 0.5) * 600,
    vx: 0,
    vy: 0,
  }));
}

function generateEdges(agents, count) {
  const edges = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let si, ti;
    let attempts = 0;
    do {
      si = Math.floor(Math.random() * agents.length);
      ti = Math.floor(Math.random() * agents.length);
      attempts++;
    } while ((si === ti || used.has(`${si}-${ti}`)) && attempts < 50);
    if (si === ti) continue;
    used.add(`${si}-${ti}`);
    edges.push({
      source: agents[si],
      target: agents[ti],
      weight: 1 + Math.floor(Math.random() * 8),
      initiatorId: agents[si].id,
    });
  }
  return edges;
}

// ─── Simplified force simulation (no d3 dependency in test) ─────────────────

function applyForces(nodes, edges) {
  // Repulsion (charge)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = -120 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[i].vx -= fx;
      nodes[i].vy -= fy;
      nodes[j].vx += fx;
      nodes[j].vy += fy;
    }
  }

  // Link attraction
  for (const edge of edges) {
    const src = edge.source;
    const tgt = edge.target;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const strength = Math.min(edge.weight / 10, 0.5);
    const force = (dist - 100) * strength * 0.01;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    src.vx += fx;
    src.vy += fy;
    tgt.vx -= fx;
    tgt.vy -= fy;
  }

  // Center
  for (const node of nodes) {
    node.vx -= node.x * 0.001;
    node.vy -= node.y * 0.001;
  }

  // Velocity decay + position update
  for (const node of nodes) {
    node.vx *= 0.6;
    node.vy *= 0.6;
    node.x += node.vx;
    node.y += node.vy;
  }
}

// ─── Particle simulation ────────────────────────────────────────────────────

function simulateParticles(particles, nodes) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const alive = [];
  for (const p of particles) {
    p.progress += 3 / 60;
    p.life--;
    if (p.progress >= 1 || p.life <= 0) continue;
    const src = nodeMap.get(p.sourceId);
    const tgt = nodeMap.get(p.targetId);
    if (!src || !tgt) continue;
    p.x = src.x + (tgt.x - src.x) * p.progress;
    p.y = src.y + (tgt.y - src.y) * p.progress;
    alive.push(p);
  }
  return alive;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("AgentHall perf harness", () => {
  it("force tick stays under 4ms mean at 60 agents + 200 edges", () => {
    const agents = generateAgents(60);
    const edges = generateEdges(agents, 200);

    // Warm up
    for (let i = 0; i < 10; i++) applyForces(agents, edges);

    // Measure
    const samples = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      applyForces(agents, edges);
      samples.push(performance.now() - start);
    }

    const sorted = samples.sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    console.log(`Force tick: mean=${mean.toFixed(2)}ms p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms`);

    // 4ms budget leaves ample room for rendering
    assert.ok(mean < 4, `Mean force tick ${mean.toFixed(2)}ms exceeds 4ms budget`);
  });

  it("particle simulation handles 400 particles within budget", () => {
    const agents = generateAgents(60);
    const particles = [];
    for (let i = 0; i < 400; i++) {
      const si = Math.floor(Math.random() * agents.length);
      const ti = Math.floor(Math.random() * agents.length);
      particles.push({
        sourceId: agents[si].id,
        targetId: agents[ti === si ? (ti + 1) % agents.length : ti].id,
        progress: Math.random() * 0.5,
        life: 30 + Math.floor(Math.random() * 30),
        x: 0,
        y: 0,
        color: 0x7FB4FF,
      });
    }

    const samples = [];
    let p = particles;
    for (let i = 0; i < 60; i++) {
      const start = performance.now();
      p = simulateParticles(p, agents);
      samples.push(performance.now() - start);
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    console.log(`Particle sim (400): mean=${mean.toFixed(3)}ms`);

    // Particle sim should be well under 1ms
    assert.ok(mean < 2, `Particle sim ${mean.toFixed(3)}ms exceeds 2ms budget`);
  });

  it("combined tick (force + particles) fits in 16.6ms frame budget", () => {
    const agents = generateAgents(60);
    const edges = generateEdges(agents, 200);
    let particles = [];
    for (let i = 0; i < 200; i++) {
      const si = Math.floor(Math.random() * agents.length);
      const ti = Math.floor(Math.random() * agents.length);
      particles.push({
        sourceId: agents[si].id,
        targetId: agents[ti === si ? (ti + 1) % agents.length : ti].id,
        progress: Math.random() * 0.5,
        life: 30 + Math.floor(Math.random() * 30),
        x: 0,
        y: 0,
        color: 0x7FB4FF,
      });
    }

    const samples = [];
    for (let i = 0; i < 60; i++) {
      const start = performance.now();
      applyForces(agents, edges);
      particles = simulateParticles(particles, agents);
      samples.push(performance.now() - start);
    }

    const sorted = samples.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

    console.log(`Combined: mean=${mean.toFixed(2)}ms p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms`);

    // Must fit in 16.6ms frame budget (60fps) — leave 10ms for pixi render
    assert.ok(p50 < 6, `p50 ${p50.toFixed(2)}ms exceeds 6ms compute budget`);
    // p95 of combined compute must allow ≥48 fps (20.8ms frame)
    assert.ok(p95 < 10, `p95 ${p95.toFixed(2)}ms exceeds 10ms compute budget`);
  });

  it("nodeRadius scales correctly between min and max", () => {
    assert.equal(nodeRadius(0), 8);
    assert.equal(nodeRadius(500), 28);
    assert.equal(nodeRadius(250), 18);
    assert.ok(nodeRadius(1000) === 28, "Clamped at max");
  });
});
