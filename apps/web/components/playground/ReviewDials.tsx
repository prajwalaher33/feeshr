"use client";

import React, { useEffect, useState, useRef } from "react";
import { getAgentHue } from "@/lib/agentHue";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReviewScores {
  correctness: number; // 0–1
  security: number;    // 0–1
  quality: number;     // 0–1
}

export interface ReviewDialsProps {
  scores: ReviewScores;
  reviewerId: string;
  visible: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DIAL_SIZE = 24;
const STROKE_WIDTH = 3;
const ANIM_DURATION = 420; // ms, cinema easing

const LABELS: [keyof ReviewScores, string][] = [
  ["correctness", "C"],
  ["security", "S"],
  ["quality", "Q"],
];

// ─── Component ──────────────────────────────────────────────────────────────

export function ReviewDials({ scores, reviewerId, visible }: ReviewDialsProps) {
  const [animProgress, setAnimProgress] = useState(0);
  const animRef = useRef<number>(0);
  const startRef = useRef(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!visible) {
      setAnimProgress(0);
      return;
    }

    if (reducedMotion.current) {
      setAnimProgress(1);
      return;
    }

    startRef.current = performance.now();

    function tick() {
      const elapsed = performance.now() - startRef.current;
      const t = Math.min(elapsed / ANIM_DURATION, 1);
      // Cinema easing: cubic-bezier(0.22, 1, 0.36, 1) approximation
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimProgress(eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [visible]);

  if (!visible) return null;

  const hue = getAgentHue(reviewerId);
  const radius = (DIAL_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      style={{ display: "flex", gap: 4, alignItems: "center" }}
      role="group"
      aria-label={`Review scores: correctness ${Math.round(scores.correctness * 100)}%, security ${Math.round(scores.security * 100)}%, quality ${Math.round(scores.quality * 100)}%`}
    >
      {LABELS.map(([key, label]) => {
        const value = scores[key];
        const fillLength = circumference * value * animProgress;
        const dashOffset = circumference - fillLength;

        return (
          <div
            key={key}
            style={{ position: "relative", width: DIAL_SIZE, height: DIAL_SIZE }}
            title={`${key}: ${Math.round(value * 100)}%`}
          >
            <svg
              width={DIAL_SIZE}
              height={DIAL_SIZE}
              viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
              style={{ transform: "rotate(-90deg)" }}
            >
              {/* Background track */}
              <circle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={radius}
                fill="none"
                stroke="var(--bg-2)"
                strokeWidth={STROKE_WIDTH}
              />
              {/* Filled arc */}
              <circle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={radius}
                fill="none"
                stroke={hue}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </svg>
            {/* Center label */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 7,
                fontWeight: 600,
                color: "var(--ink-3)",
                fontFamily: "var(--font-jetbrains)",
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
