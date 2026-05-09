"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchActiveLocks,
  fetchWorkflowInstances,
  fetchSubtasks,
  fetchDecisions,
  fetchPoccChains,
} from "@/lib/api";

interface PulseTile {
  label: string;
  value: number | null;
  href: string;
  color: string;
  hint: string;
}

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Server-issuing client component (`"use client"`) so the counts auto-refresh
 * every 30s without a hydration round-trip. Each tile deep-links to the
 * observation surface that owns the underlying data.
 */
export function NetworkPulse() {
  const [tiles, setTiles] = useState<PulseTile[]>(() =>
    INITIAL.map((t) => ({ ...t, value: null })),
  );

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const [locks, wfActive, openSubtasks, openDecisions, sealedChains] =
        await Promise.allSettled([
          fetchActiveLocks({ limit: 200 }),
          fetchWorkflowInstances({ status: "active", limit: 200 }),
          fetchSubtasks({ status: "open", limit: 200 }),
          fetchDecisions({ status: "open" }),
          fetchPoccChains({ status: "sealed", limit: 200 }),
        ]);
      if (cancelled) return;
      const counts: Record<string, number> = {
        locks: locks.status === "fulfilled" ? locks.value.locks.length : 0,
        workflows:
          wfActive.status === "fulfilled" ? wfActive.value.instances.length : 0,
        subtasks:
          openSubtasks.status === "fulfilled"
            ? openSubtasks.value.subtasks.length
            : 0,
        decisions:
          openDecisions.status === "fulfilled"
            ? openDecisions.value.decisions.length
            : 0,
        chains:
          sealedChains.status === "fulfilled"
            ? sealedChains.value.chains.length
            : 0,
      };
      setTiles(
        INITIAL.map((t) => ({ ...t, value: counts[t.key] ?? 0 })),
      );
    };
    tick();
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="px-6 pb-12">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-baseline justify-between mb-3">
          <h2
            className="text-[12px] uppercase tracking-[0.16em] text-white/40"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Network pulse
          </h2>
          <span
            className="text-[10px] text-white/20"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            refreshes every 30s
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {tiles.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className="card-hover p-3 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: t.color }}
                />
                <span
                  className="text-[10px] uppercase tracking-[0.12em] text-white/40"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {t.label}
                </span>
              </div>
              <div
                className="text-[22px] font-bold text-white tracking-tight tabular-nums"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t.value === null ? (
                  <span className="text-white/15">—</span>
                ) : (
                  t.value
                )}
              </div>
              <div
                className="text-[10px] text-white/25"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {t.hint}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

interface InitTile extends Omit<PulseTile, "value"> {
  key: string;
}

const INITIAL: InitTile[] = [
  {
    key: "locks",
    label: "Active locks",
    href: "/locks",
    color: "#22d3ee",
    hint: "agents holding work",
  },
  {
    key: "workflows",
    label: "Workflows",
    href: "/workflows",
    color: "#6366f1",
    hint: "in-flight processes",
  },
  {
    key: "subtasks",
    label: "Open subtasks",
    href: "/subtasks",
    color: "#f7c948",
    hint: "ready to claim",
  },
  {
    key: "decisions",
    label: "Open decisions",
    href: "/decisions",
    color: "#8b5cf6",
    hint: "awaiting votes",
  },
  {
    key: "chains",
    label: "Sealed PoCC",
    href: "/pocc",
    color: "#28c840",
    hint: "proven work units",
  },
];
