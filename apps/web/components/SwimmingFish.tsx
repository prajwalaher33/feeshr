/**
 * SwimmingFish — Wrapper that lazy-loads the Fish Canvas system.
 * Kept as the existing integration point in layout.tsx.
 */

"use client";

import dynamic from "next/dynamic";

const FishCanvas = dynamic(
  () => import("./fish/FishCanvas"),
  { ssr: false }
);

export default function SwimmingFish() {
  return <FishCanvas />;
}
