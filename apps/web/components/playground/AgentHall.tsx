"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { getAgentHue } from "@/lib/agentHue";
import { rawColor } from "@/lib/tokens";
import { AgentHueDot } from "@/components/agent/AgentHueDot";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HallAgent {
  id: string;
  name: string;
  reputation: number;
  lastActiveAt: number;
}

export interface HallEdge {
  source: string;
  target: string;
  weight: number;
  initiatorId: string;
}

export interface AgentHallProps {
  agents: HallAgent[];
  edges: HallEdge[];
  events: PlaygroundEvent[];
  onSelect: (id: string | null) => void;
  pinnedId: string | null;
  mode: "live" | "scenario" | "replay";
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_NODE_RADIUS = 10;
const MAX_NODE_RADIUS = 32;
const MAX_REPUTATION = 500;
const PARTICLE_MAX = 400;
const PARTICLE_SPEED = 3;
const PARTICLE_LIFE = 60;
const FPS_DEGRADE_THRESHOLD = 50;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;

// ─── Utility ────────────────────────────────────────────────────────────────

function nodeRadius(reputation: number): number {
  const t = Math.min(reputation / MAX_REPUTATION, 1);
  return MIN_NODE_RADIUS + t * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
}

function strokeWidth(lastActiveAt: number, now: number): number {
  const elapsed = now - lastActiveAt;
  if (elapsed < 5_000) return 3;
  if (elapsed < 30_000) return 2;
  if (elapsed < 120_000) return 1.5;
  return 1;
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Simulation Types ───────────────────────────────────────────────────────

interface SimNode {
  id: string;
  name: string;
  reputation: number;
  lastActiveAt: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  weight: number;
  initiatorId: string;
}

interface Particle {
  sourceId: string;
  targetId: string;
  progress: number;
  life: number;
  color: number;
}

// ─── FPS Tracker ────────────────────────────────────────────────────────────

interface FpsTracker {
  frames: number;
  lastTime: number;
  current: number;
  samples: number[];
  p50: number;
  p95: number;
}

function createFpsTracker(): FpsTracker {
  return { frames: 0, lastTime: performance.now(), current: 60, samples: [], p50: 60, p95: 60 };
}

function tickFps(tracker: FpsTracker): boolean {
  tracker.frames++;
  const now = performance.now();
  const elapsed = now - tracker.lastTime;
  if (elapsed >= 1000) {
    tracker.current = Math.round((tracker.frames * 1000) / elapsed);
    tracker.frames = 0;
    tracker.lastTime = now;
    tracker.samples.push(tracker.current);
    if (tracker.samples.length > 60) tracker.samples.shift();
    const sorted = [...tracker.samples].sort((a, b) => a - b);
    tracker.p50 = sorted[Math.floor(sorted.length * 0.5)] || 60;
    tracker.p95 = sorted[Math.floor(sorted.length * 0.05)] || 60;
    return true;
  }
  return false;
}

// ─── Internal state ─────────────────────────────────────────────────────────

type PixiApp = { view: HTMLCanvasElement; stage: PixiContainer; renderer: { resize(w: number, h: number): void }; destroy(removeView: boolean, opts: { children: boolean }): void };
type PixiContainer = { position: { set(x: number, y: number): void }; scale: { set(s: number): void }; addChild(child: unknown): void; removeChild(child: unknown): void };
type PixiGraphics = { clear(): void; lineStyle(w: number, c: number, a?: number): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; beginFill(c: number, a?: number): void; drawCircle(x: number, y: number, r: number): void; drawRoundedRect(x: number, y: number, w: number, h: number, rad: number): void; endFill(): void };
type PixiNodeSprite = { position: { set(x: number, y: number): void }; _bg: PixiGraphics; _label: { style: { fontSize: number }; text: string; anchor: { set(x: number, y?: number): void } }; _nameLabel?: { text: string; anchor: { set(x: number, y?: number): void }; style: { fontSize: number } }; destroy(opts: { children: boolean }): void };
type D3Sim = { nodes(n: SimNode[]): D3Sim; force(name: string): { links(l: SimLink[]): void } | null; alpha(a: number): D3Sim; alphaDecay(d: number): D3Sim; restart(): D3Sim; tick(n: number): void; stop(): void; on(event: string, fn: () => void): D3Sim };
type PixiModule = { Application: new (opts: Record<string, unknown>) => PixiApp; Container: new () => PixiContainer; Graphics: new () => PixiGraphics; Text: new (text: string, style: Record<string, unknown>) => PixiNodeSprite["_label"] & { anchor: { set(x: number, y?: number): void } } };

interface HallState {
  app: PixiApp | null;
  sim: D3Sim | null;
  nodes: SimNode[];
  links: SimLink[];
  particles: Particle[];
  camera: { x: number; y: number; zoom: number };
  targetCamera: { x: number; y: number; zoom: number };
  size: { width: number; height: number };
  fps: FpsTracker;
  hovered: string | null;
  isDragging: boolean;
  dragStart: { x: number; y: number; camX: number; camY: number };
  processedEvents: Set<string>;
  reducedMotion: boolean;
  degrade: boolean;
  pixiReady: boolean;
  destroyed: boolean;
  edgeGfx: PixiGraphics | null;
  nodeContainer: PixiContainer | null;
  particleGfx: PixiGraphics | null;
  nodeSprites: Map<string, PixiNodeSprite>;
  _cleanup?: () => void;
}

// ─── Avatar initials ────────────────────────────────────────────────────────

const AGENT_ICONS: Record<string, string> = {
  obsidian: "OB",
  ember: "EM",
  sable: "SA",
  verdigris: "VE",
  cobalt: "CO",
  nova: "NO",
  orchid: "OR",
};

function getInitials(name: string): string {
  return AGENT_ICONS[name.toLowerCase()] || name.slice(0, 2).toUpperCase();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AgentHall({ agents, edges, events, onSelect, pinnedId, mode }: AgentHallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HallState>({
    app: null, sim: null, nodes: [], links: [], particles: [],
    camera: { x: 0, y: 0, zoom: 1 },
    targetCamera: { x: 0, y: 0, zoom: 1 },
    size: { width: 0, height: 0 },
    fps: createFpsTracker(),
    hovered: null, isDragging: false,
    dragStart: { x: 0, y: 0, camX: 0, camY: 0 },
    processedEvents: new Set<string>(),
    reducedMotion: false, degrade: false, pixiReady: false, destroyed: false,
    edgeGfx: null, nodeContainer: null, particleGfx: null,
    nodeSprites: new Map<string, PixiNodeSprite>(),
  });

  const [hoveredAgent, setHoveredAgent] = useState<HallAgent | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [fpsDisplay, setFpsDisplay] = useState(60);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    stateRef.current.reducedMotion = mq.matches;
    const handler = (e: MediaQueryListEvent) => { stateRef.current.reducedMotion = e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Initialize pixi + d3-force
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const state = stateRef.current;
    let rafId = 0;

    async function init() {
      const el = container!;
      const [PIXI, d3] = await Promise.all([import("pixi.js"), import("d3-force")]);
      if (state.destroyed) return;

      const rect = el.getBoundingClientRect();
      state.size = { width: rect.width, height: rect.height };

      const app = new PIXI.Application({
        width: rect.width, height: rect.height,
        backgroundColor: hexToNum(rawColor.bg0),
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      el.appendChild(app.view as HTMLCanvasElement);
      (app.view as HTMLCanvasElement).style.width = "100%";
      (app.view as HTMLCanvasElement).style.height = "100%";
      state.app = app as unknown as PixiApp;

      const worldContainer = new PIXI.Container();
      app.stage.addChild(worldContainer);
      worldContainer.position.set(rect.width / 2, rect.height / 2);

      const edgeGfx = new PIXI.Graphics();
      worldContainer.addChild(edgeGfx);
      state.edgeGfx = edgeGfx as unknown as PixiGraphics;

      const particleGfx = new PIXI.Graphics();
      worldContainer.addChild(particleGfx);
      state.particleGfx = particleGfx as unknown as PixiGraphics;

      const nodeContainer = new PIXI.Container();
      worldContainer.addChild(nodeContainer);
      state.nodeContainer = nodeContainer as unknown as PixiContainer;

      const sim = d3.forceSimulation<SimNode>(state.nodes)
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(0, 0).strength(0.04))
        .force("collision", d3.forceCollide<SimNode>().radius((n: SimNode) => nodeRadius(n.reputation) + 8))
        .force("link", d3.forceLink<SimNode, SimLink>(state.links)
          .id((d: SimNode) => d.id)
          .distance(120)
          .strength((l: SimLink) => Math.min(l.weight / 10, 0.5))
        )
        .alphaDecay(0.015)
        .on("tick", () => {});

      if (state.reducedMotion) { sim.tick(300); sim.stop(); }

      state.sim = sim as unknown as D3Sim;
      state.pixiReady = true;

      function renderFrame() {
        if (state.destroyed) return;
        rafId = requestAnimationFrame(renderFrame);

        // Smooth camera interpolation
        const cam = state.camera;
        const tc = state.targetCamera;
        cam.x += (tc.x - cam.x) * 0.12;
        cam.y += (tc.y - cam.y) * 0.12;
        cam.zoom += (tc.zoom - cam.zoom) * 0.12;

        worldContainer.position.set(
          state.size.width / 2 + cam.x * cam.zoom,
          state.size.height / 2 + cam.y * cam.zoom,
        );
        worldContainer.scale.set(cam.zoom);

        renderEdges(state);
        renderParticles(state);
        renderNodes(state, PIXI as unknown as PixiModule);

        if (tickFps(state.fps)) {
          setFpsDisplay(state.fps.current);
          state.degrade = state.fps.current < FPS_DEGRADE_THRESHOLD;
        }
      }
      rafId = requestAnimationFrame(renderFrame);

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        state.size = { width, height };
        app.renderer.resize(width, height);
      });
      ro.observe(el);

      state._cleanup = () => {
        ro.disconnect();
        cancelAnimationFrame(rafId);
        sim.stop();
        app.destroy(true, { children: true });
      };
    }

    init();
    return () => { state.destroyed = true; if (state._cleanup) state._cleanup(); };
  }, []);

  // Update sim nodes/links
  useEffect(() => {
    const state = stateRef.current;
    if (!state.sim) return;

    const existingMap = new Map(state.nodes.map((n: SimNode) => [n.id, n]));
    const newNodes: SimNode[] = agents.map(a => {
      const existing = existingMap.get(a.id);
      if (existing) {
        existing.reputation = a.reputation;
        existing.lastActiveAt = a.lastActiveAt;
        existing.name = a.name;
        return existing;
      }
      return {
        id: a.id, name: a.name, reputation: a.reputation, lastActiveAt: a.lastActiveAt,
        x: (Math.random() - 0.5) * state.size.width * 0.3,
        y: (Math.random() - 0.5) * state.size.height * 0.3,
        vx: 0, vy: 0,
      };
    });

    const newLinks: SimLink[] = edges.map(e => ({
      source: e.source, target: e.target, weight: e.weight, initiatorId: e.initiatorId,
    }));

    state.nodes = newNodes;
    state.links = newLinks;
    state.sim.nodes(newNodes);
    const linkForce = state.sim.force("link");
    if (linkForce) linkForce.links(newLinks);
    state.sim.alpha(0.3).restart();
  }, [agents, edges]);

  // Spawn particles
  useEffect(() => {
    const state = stateRef.current;
    if (state.reducedMotion) return;

    for (const ev of events) {
      if (state.processedEvents.has(ev.id)) continue;
      state.processedEvents.add(ev.id);
      if (ev.target_id && ev.actor_id !== ev.target_id && state.particles.length < PARTICLE_MAX && !state.degrade) {
        state.particles.push({
          sourceId: ev.actor_id, targetId: ev.target_id,
          progress: 0, life: PARTICLE_LIFE,
          color: hexToNum(getAgentHue(ev.actor_id)),
        });
      }
    }

    if (state.processedEvents.size > 1000) {
      const arr = [...state.processedEvents];
      state.processedEvents = new Set(arr.slice(-500));
    }
  }, [events]);

  // ─── Interaction ──────────────────────────────────────────────────────────

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const cam = stateRef.current.camera;
    return {
      x: ((clientX - rect.left - rect.width / 2) / cam.zoom) - cam.x,
      y: ((clientY - rect.top - rect.height / 2) / cam.zoom) - cam.y,
    };
  }, []);

  const findNodeAt = useCallback((wx: number, wy: number): SimNode | null => {
    const nodes = stateRef.current.nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const r = nodeRadius(node.reputation) + 4;
      const dx = wx - node.x, dy = wy - node.y;
      if (dx * dx + dy * dy <= r * r) return node;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const state = stateRef.current;
    if (state.isDragging) {
      const dx = e.clientX - state.dragStart.x;
      const dy = e.clientY - state.dragStart.y;
      state.targetCamera.x = state.dragStart.camX + dx / state.camera.zoom;
      state.targetCamera.y = state.dragStart.camY + dy / state.camera.zoom;
      return;
    }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(x, y);
    if (node) {
      state.hovered = node.id;
      setHoveredAgent(agents.find(a => a.id === node.id) || null);
      setHoverPos({ x: e.clientX, y: e.clientY });
    } else {
      state.hovered = null;
      setHoveredAgent(null);
    }
  }, [agents, screenToWorld, findNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const state = stateRef.current;
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(x, y);
    if (!node) {
      state.isDragging = true;
      state.dragStart = { x: e.clientX, y: e.clientY, camX: state.targetCamera.x, camY: state.targetCamera.y };
    }
  }, [screenToWorld, findNodeAt]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const state = stateRef.current;
    if (state.isDragging) { state.isDragging = false; return; }
    const { x, y } = screenToWorld(e.clientX, e.clientY);
    const node = findNodeAt(x, y);
    onSelect(node ? (pinnedId === node.id ? null : node.id) : null);
  }, [screenToWorld, findNodeAt, onSelect, pinnedId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const state = stateRef.current;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    state.targetCamera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.targetCamera.zoom + delta));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      const state = stateRef.current;
      const PAN = 30;

      switch (e.key) {
        case "f": case "F":
          if (!e.metaKey && !e.ctrlKey) state.targetCamera = { x: 0, y: 0, zoom: 1 };
          break;
        case "ArrowUp":
          e.preventDefault(); state.targetCamera.y += PAN; break;
        case "ArrowDown":
          e.preventDefault(); state.targetCamera.y -= PAN; break;
        case "ArrowLeft":
          e.preventDefault(); state.targetCamera.x += PAN; break;
        case "ArrowRight":
          e.preventDefault(); state.targetCamera.x -= PAN; break;
        case "Enter":
          if (pinnedId) {
            const node = state.nodes.find((n: SimNode) => n.id === pinnedId);
            if (node) state.targetCamera = { x: -node.x, y: -node.y, zoom: 2 };
          }
          break;
        case "=": case "+":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); state.targetCamera.zoom = Math.min(ZOOM_MAX, state.targetCamera.zoom + ZOOM_STEP * 3); }
          break;
        case "-":
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); state.targetCamera.zoom = Math.max(ZOOM_MIN, state.targetCamera.zoom - ZOOM_STEP * 3); }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pinnedId]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab"
        role="application"
        aria-label={`Agent Hall: ${agents.length} agents. Arrow keys to pan, +/- to zoom, F to frame, click to inspect.`}
        tabIndex={0}
      />

      {/* Hover card */}
      {hoveredAgent && (
        <div
          className="fixed z-10 px-3 py-2 rounded-lg border border-white/[0.08] pointer-events-none"
          style={{ left: hoverPos.x + 14, top: hoverPos.y - 10, background: "#111418" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AgentHueDot agentId={hoveredAgent.id} size={8} glow />
            <span className="text-sm font-semibold text-[#f0f2f8]">{hoveredAgent.name}</span>
          </div>
          <span className="text-[11px] font-mono text-[#5a6478]">
            rep {hoveredAgent.reputation}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-4 flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-[#0c1017]/80 border border-white/[0.04] backdrop-blur-sm">
        <span className="text-[9px] font-medium uppercase tracking-wider text-[#3d4556]">Legend</span>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-[#3d4556]" />
          <span className="text-[10px] text-[#5a6478]">Node size = reputation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-[2px] bg-[#5a6478]" />
          <span className="text-[10px] text-[#5a6478]">Edge weight = interactions</span>
        </div>
      </div>

      {/* Mode + FPS (minimal) */}
      <div className="absolute top-3 right-4 flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0c1017]/60 backdrop-blur-sm">
        <span className={`w-1.5 h-1.5 rounded-full ${mode === "live" ? "bg-[#3BD01F]" : mode === "scenario" ? "bg-[#5B8DEF]" : "bg-[#E8B339]"}`} />
        <span className="text-[9px] uppercase font-mono text-[#3d4556]">{mode}</span>
        <span className="text-[9px] font-mono text-[#2A3138]">{fpsDisplay}fps</span>
      </div>
    </div>
  );
}

// ─── Render helpers ─────────────────────────────────────────────────────────

function renderEdges(state: HallState) {
  const gfx = state.edgeGfx;
  if (!gfx) return;
  gfx.clear();

  const nodeMap = new Map<string, SimNode>();
  for (const n of state.nodes as SimNode[]) nodeMap.set(n.id, n);

  for (const link of state.links as SimLink[]) {
    const src = typeof link.source === "string" ? nodeMap.get(link.source) : link.source;
    const tgt = typeof link.target === "string" ? nodeMap.get(link.target) : link.target;
    if (!src || !tgt) continue;

    const color = hexToNum(getAgentHue(link.initiatorId));
    const alpha = 0.12 + Math.min(link.weight / 10, 0.35);
    const width = 0.8 + Math.min(link.weight / 5, 2.5);

    gfx.lineStyle(width, color, alpha);
    gfx.moveTo(src.x, src.y);
    gfx.lineTo(tgt.x, tgt.y);
  }
}

function renderParticles(state: HallState) {
  const gfx = state.particleGfx;
  if (!gfx) return;
  gfx.clear();
  if (state.reducedMotion || state.degrade) return;

  const nodeMap = new Map<string, SimNode>();
  for (const n of state.nodes as SimNode[]) nodeMap.set(n.id, n);
  const toRemove: number[] = [];

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i] as Particle;
    const src = nodeMap.get(p.sourceId);
    const tgt = nodeMap.get(p.targetId);
    if (!src || !tgt) { toRemove.push(i); continue; }

    p.progress += PARTICLE_SPEED / PARTICLE_LIFE;
    p.life--;
    if (p.progress >= 1 || p.life <= 0) { toRemove.push(i); continue; }

    const x = lerp(src.x, tgt.x, p.progress);
    const y = lerp(src.y, tgt.y, p.progress);
    const alpha = (1 - p.progress) * 0.8;

    gfx.beginFill(p.color, alpha);
    gfx.drawCircle(x, y, 3);
    gfx.endFill();

    const tx = lerp(src.x, tgt.x, Math.max(0, p.progress - 0.1));
    const ty = lerp(src.y, tgt.y, Math.max(0, p.progress - 0.1));
    gfx.beginFill(p.color, alpha * 0.4);
    gfx.drawCircle(tx, ty, 2);
    gfx.endFill();
  }

  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.particles.splice(toRemove[i], 1);
  }
}

function renderNodes(state: HallState, PIXI: PixiModule) {
  const container = state.nodeContainer;
  if (!container) return;

  const now = Date.now();
  const existingSprites = state.nodeSprites;
  const currentIds = new Set<string>();

  for (const node of state.nodes) {
    currentIds.add(node.id);
    let sprite = existingSprites.get(node.id);

    if (!sprite) {
      const s = new PIXI.Container() as unknown as PixiNodeSprite & PixiContainer;

      const bg = new PIXI.Graphics() as unknown as PixiGraphics;
      s.addChild(bg);
      (s as unknown as PixiNodeSprite)._bg = bg;

      // Initials label (centered in circle)
      const label = new PIXI.Text(getInitials(node.name), {
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        fill: hexToNum(rawColor.ink0),
        align: "center",
        fontWeight: "600",
      });
      label.anchor.set(0.5);
      s.addChild(label);
      (s as unknown as PixiNodeSprite)._label = label as unknown as PixiNodeSprite["_label"];

      // Name label below node
      const nameLabel = new PIXI.Text(node.name, {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 10,
        fill: hexToNum(rawColor.ink2),
        align: "center",
      });
      nameLabel.anchor.set(0.5, 0);
      s.addChild(nameLabel);
      (s as unknown as PixiNodeSprite)._nameLabel = nameLabel as unknown as PixiNodeSprite["_nameLabel"];

      container.addChild(s);
      sprite = s as unknown as PixiNodeSprite;
      existingSprites.set(node.id, sprite);
    }

    sprite.position.set(node.x, node.y);

    const r = nodeRadius(node.reputation);
    const sw = strokeWidth(node.lastActiveAt, now);
    const hueColor = hexToNum(getAgentHue(node.id));
    const isHovered = state.hovered === node.id;

    const bg = sprite._bg;
    bg.clear();

    // Outer glow for hovered
    if (isHovered) {
      bg.beginFill(hueColor, 0.08);
      bg.drawCircle(0, 0, r + 6);
      bg.endFill();
    }

    // Node fill
    bg.beginFill(hexToNum(rawColor.bg2));
    bg.drawCircle(0, 0, r);
    bg.endFill();

    // Node ring
    bg.lineStyle(sw, hueColor, isHovered ? 1 : 0.7);
    bg.drawCircle(0, 0, r);

    sprite._label.style.fontSize = Math.max(9, r * 0.55);
    sprite._label.text = getInitials(node.name);

    if (sprite._nameLabel) {
      sprite._nameLabel.text = node.name;
      sprite._nameLabel.style.fontSize = 10;
      (sprite._nameLabel as unknown as { position: { set(x: number, y: number): void } }).position?.set?.(0, r + 8);
    }
  }

  for (const [id, sprite] of existingSprites) {
    if (!currentIds.has(id)) {
      container.removeChild(sprite);
      sprite.destroy({ children: true });
      existingSprites.delete(id);
    }
  }
}

// ─── Perf Harness ───────────────────────────────────────────────────────────

export interface PerfResult { p50: number; p95: number; mean: number; samples: number; }

export function createPerfHarness(): { start: () => void; stop: () => void; getResults: () => PerfResult } {
  const tracker = createFpsTracker();
  let running = false;
  let rafId = 0;

  function tick() { if (!running) return; tickFps(tracker); rafId = requestAnimationFrame(tick); }

  return {
    start() { tracker.samples = []; tracker.frames = 0; tracker.lastTime = performance.now(); running = true; rafId = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(rafId); },
    getResults() {
      if (tracker.samples.length === 0) return { p50: 0, p95: 0, mean: 0, samples: 0 };
      const sorted = [...tracker.samples].sort((a, b) => a - b);
      return { p50: sorted[Math.floor(sorted.length * 0.5)] || 0, p95: sorted[Math.floor(sorted.length * 0.05)] || 0, mean: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length), samples: sorted.length };
    },
  };
}
