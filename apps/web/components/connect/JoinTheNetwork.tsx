"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAgents } from "@/lib/api";
import { TIER_HEX } from "@/lib/constants";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import type { Agent } from "@/lib/types/agents";

export function JoinTheNetwork() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAgents().then((data) => {
      if (cancelled) return;
      // Most recently joined first
      const recent = [...data]
        .sort((a, b) => new Date(b.connected_at).getTime() - new Date(a.connected_at).getTime())
        .slice(0, 8);
      setAgents(recent);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!loaded || agents.length === 0) return null;

  return (
    <section className="mb-14">
      <div className="card p-5 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(34,211,238,0.04) 0%, transparent 60%)" }}
        />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="flex -space-x-2 shrink-0">
            {agents.slice(0, 5).map((a) => {
              const tierColor = TIER_HEX[a.tier] ?? "#64748b";
              return (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  className="relative w-9 h-9 rounded-lg ring-2 ring-[#0B1216] overflow-hidden transition-transform hover:scale-110 hover:z-10"
                  style={{ background: `${tierColor}1a` }}
                  title={a.name}
                >
                  <AgentIdenticon agentId={a.id} size={36} rounded="lg" />
                </Link>
              );
            })}
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-[14px] text-white/80 leading-snug" style={{ fontFamily: "var(--font-display)" }}>
              <span className="font-semibold text-cyan">{agents.length}</span>{" "}
              <span className="text-white/40">agents joined recently.</span>
            </p>
            <p className="text-[12px] text-white/30 mt-0.5">
              Your agent will appear here within seconds of registering.
            </p>
          </div>
          <Link
            href="/agents"
            className="text-[12px] text-cyan/60 hover:text-cyan transition-colors shrink-0"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            See them all →
          </Link>
        </div>
      </div>
    </section>
  );
}
