/**
 * FishCanvas — The living fish rendered on a fullscreen canvas.
 *
 * This is the main component. It manages:
 * - A full-viewport <canvas> behind all page content
 * - The animation loop (requestAnimationFrame)
 * - Mouse/scroll/resize event listeners
 * - Reduced-motion and mobile-awareness
 * - The fish physics + rendering pipeline
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { FISH_CONFIG } from "./fish-config";
import { renderFish } from "./fish-renderer";
import { createFishState, updateFish, resizeFish } from "./fish-physics";
import type { FishState } from "./fish-renderer";

export default function FishCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<ReturnType<typeof createFishState> | null>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const scrollRef = useRef({ y: 0, delta: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  // ── Setup ──
  useEffect(() => {
    // Check reduced motion preference
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // ── Canvas sizing ──
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (stateRef.current) {
      resizeFish(stateRef.current.fish, window.innerWidth, window.innerHeight);
    }
  }, []);

  // ── Animation loop ──
  const animate = useCallback(
    (timestamp: number) => {
      if (reducedMotion) return;

      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const dt = Math.min(0.05, (timestamp - lastFrameRef.current) / 1000);
      lastFrameRef.current = timestamp;

      const canvas = canvasRef.current;
      const state = stateRef.current;
      if (!canvas || !state) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      const viewW = window.innerWidth;
      const viewH = window.innerHeight;

      // Wait for entrance delay
      if (elapsed < FISH_CONFIG.behavior.entranceDelay / 1000) {
        ctx.clearRect(0, 0, viewW, viewH);
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      // Smooth scroll delta decay
      scrollRef.current.delta *= 0.9;

      // Update physics
      updateFish(state.fish, state.internal, {
        viewW,
        viewH,
        scrollY: scrollRef.current.y,
        scrollDelta: scrollRef.current.delta,
        cursorX: mouseRef.current.x,
        cursorY: mouseRef.current.y,
        cursorActive: mouseRef.current.active,
        dt,
        elapsed: elapsed - FISH_CONFIG.behavior.entranceDelay / 1000,
      });

      // Render
      ctx.clearRect(0, 0, viewW, viewH);
      renderFish(ctx, state.fish);

      animRef.current = requestAnimationFrame(animate);
    },
    [reducedMotion]
  );

  // ── Lifecycle ──
  useEffect(() => {
    if (reducedMotion) return;

    // Initialize state
    stateRef.current = createFishState(window.innerWidth, window.innerHeight);
    resizeCanvas();

    // Events
    const onResize = () => resizeCanvas();
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onMouseLeave = () => {
      mouseRef.current.active = false;
    };
    const onScroll = () => {
      const newY = window.scrollY;
      scrollRef.current.delta = newY - scrollRef.current.y;
      scrollRef.current.y = newY;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("scroll", onScroll, { passive: true });

    // Start loop
    lastFrameRef.current = performance.now();
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reducedMotion, animate, resizeCanvas]);

  // Don't render canvas if reduced motion
  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: FISH_CONFIG.zIndex.canvas }}
    />
  );
}
