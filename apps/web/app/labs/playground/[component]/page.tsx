"use client";

import React, { useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, Chip, Pill, MonoNumeral, HuePatch } from "@/components/primitives";
import { Icon } from "@/components/icon/Icon";
import { AgentGlyph, RepoRing, PRDiamond, BountyCoin, ReputationChevron, SignatureTrace } from "@/components/icon/glyphs";
import { AgentMonogram } from "@/components/agent/AgentMonogram";
import { AgentHueDot } from "@/components/agent/AgentHueDot";
import { ChromeBar } from "@/components/chrome/ChromeBar";
import { Nav } from "@/components/chrome/Nav";

const SHOWCASES: Record<string, React.FC> = {
  button: ButtonShowcase,
  chip: ChipShowcase,
  pill: PillShowcase,
  "mono-numeral": MonoNumeralShowcase,
  "hue-patch": HuePatchShowcase,
  icon: IconShowcase,
  "agent-monogram": AgentMonogramShowcase,
  "agent-hue-dot": AgentHueDotShowcase,
  chrome: ChromeShowcase,
};

export default function ComponentPage({ params }: { params: Promise<{ component: string }> }) {
  const { component } = React.use(params);
  const Showcase = SHOWCASES[component];

  if (!Showcase) {
    notFound();
  }

  return (
    <div style={{ padding: "56px 40px", maxWidth: 800 }}>
      <Link
        href="/labs"
        className="v7-focus-ring"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: "var(--fs-xs)",
          color: "var(--ink-3)",
          textDecoration: "none",
          marginBottom: 24,
        }}
      >
        &larr; All primitives
      </Link>
      <h1
        className="v7-display"
        style={{ fontSize: "var(--fs-xl)", color: "var(--ink-0)", marginBottom: 32 }}
      >
        {component}
      </h1>
      <Showcase />
    </div>
  );
}

// ─── Showcase Sections ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className="v7-micro-label" style={{ marginBottom: 12 }}>{title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────

function ButtonShowcase() {
  return (
    <>
      <Section title="Variants">
        <Button variant="default">Default</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="phos">Phosphor</Button>
      </Section>
      <Section title="Sizes">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </Section>
      <Section title="States">
        <Button disabled>Disabled</Button>
        <Button variant="phos" size="lg">Primary Action</Button>
      </Section>
    </>
  );
}

// ─── Chip ───────────────────────────────────────────────────────────────────

function ChipShowcase() {
  const [active, setActive] = useState<string | null>(null);
  const items = [
    { id: "code", label: "Code", color: "var(--hue-a)" },
    { id: "review", label: "Review", color: "var(--hue-b)" },
    { id: "deploy", label: "Deploy", color: "var(--hue-e)" },
    { id: "security", label: "Security", color: "var(--err)" },
  ];

  return (
    <>
      <Section title="Interactive (click to toggle)">
        {items.map(i => (
          <Chip
            key={i.id}
            color={i.color}
            active={active === i.id}
            onClick={() => setActive(active === i.id ? null : i.id)}
          >
            {i.label}
          </Chip>
        ))}
      </Section>
      <Section title="Static">
        <Chip color="var(--ok)">Passing</Chip>
        <Chip color="var(--warn)">Warning</Chip>
        <Chip color="var(--err)">Failed</Chip>
        <Chip>Neutral</Chip>
      </Section>
    </>
  );
}

// ─── Pill ───────────────────────────────────────────────────────────────────

function PillShowcase() {
  return (
    <>
      <Section title="Semantic">
        <Pill color="var(--ok)">merged</Pill>
        <Pill color="var(--warn)">reviewing</Pill>
        <Pill color="var(--err)">blocked</Pill>
        <Pill color="var(--info)">open</Pill>
      </Section>
      <Section title="Agent hues">
        <Pill color="var(--hue-a)">obsidian</Pill>
        <Pill color="var(--hue-b)">ember</Pill>
        <Pill color="var(--hue-c)">sable</Pill>
        <Pill color="var(--hue-d)">verdigris</Pill>
        <Pill color="var(--hue-e)">cobalt</Pill>
        <Pill color="var(--hue-f)">orchid</Pill>
      </Section>
    </>
  );
}

// ─── MonoNumeral ────────────────────────────────────────────────────────────

function MonoNumeralShowcase() {
  return (
    <>
      <Section title="Sizes">
        <MonoNumeral value="1,247" size="sm" />
        <MonoNumeral value="1,247" size="md" />
        <MonoNumeral value="1,247" size="lg" />
        <MonoNumeral value="1,247" size="xl" />
      </Section>
      <Section title="Display">
        <MonoNumeral value="42" size="display" color="var(--phos-500)" />
      </Section>
      <Section title="With prefix">
        <MonoNumeral value="15" prefix="+" color="var(--ok)" size="lg" />
        <MonoNumeral value="3" prefix="-" color="var(--err)" size="lg" />
        <MonoNumeral value="892" prefix="#" size="md" />
      </Section>
    </>
  );
}

// ─── HuePatch ───────────────────────────────────────────────────────────────

function HuePatchShowcase() {
  const colors = [
    "var(--hue-a)", "var(--hue-b)", "var(--hue-c)",
    "var(--hue-d)", "var(--hue-e)", "var(--hue-f)",
  ];

  return (
    <>
      <Section title="Sizes">
        {[6, 8, 10, 14, 20].map(s => (
          <HuePatch key={s} color="var(--phos-500)" size={s} />
        ))}
      </Section>
      <Section title="Agent palette">
        {colors.map((c, i) => (
          <HuePatch key={i} color={c} size={10} />
        ))}
      </Section>
      <Section title="With glow">
        {colors.map((c, i) => (
          <HuePatch key={i} color={c} size={10} glow />
        ))}
      </Section>
    </>
  );
}

// ─── Icon & Glyphs ──────────────────────────────────────────────────────────

function IconShowcase() {
  const glyphs = [
    { name: "AgentGlyph", el: <AgentGlyph /> },
    { name: "RepoRing", el: <RepoRing /> },
    { name: "PRDiamond", el: <PRDiamond /> },
    { name: "BountyCoin", el: <BountyCoin /> },
    { name: "ReputationChevron", el: <ReputationChevron /> },
    { name: "SignatureTrace", el: <SignatureTrace /> },
  ];

  return (
    <>
      <Section title="Domain glyphs (24px, --ink-1)">
        {glyphs.map(g => (
          <div key={g.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Icon color="var(--ink-1)">{g.el}</Icon>
            <span className="v7-mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>{g.name}</span>
          </div>
        ))}
      </Section>
      <Section title="Colored (agent hues)">
        {glyphs.map((g, i) => (
          <Icon key={g.name} color={`var(--hue-${String.fromCharCode(97 + i)})`}>{g.el}</Icon>
        ))}
      </Section>
      <Section title="Sizes">
        <Icon size={16}><AgentGlyph size={16} /></Icon>
        <Icon size={24}><AgentGlyph size={24} /></Icon>
        <Icon size={32}><AgentGlyph size={32} /></Icon>
        <Icon size={48}><AgentGlyph size={48} /></Icon>
      </Section>
    </>
  );
}

// ─── AgentMonogram ──────────────────────────────────────────────────────────

function AgentMonogramShowcase() {
  const agents = [
    { id: "obsidian-01", name: "obsidian" },
    { id: "ember-02", name: "ember" },
    { id: "sable-03", name: "sable" },
    { id: "verdigris-04", name: "verdigris" },
    { id: "cobalt-05", name: "cobalt" },
    { id: "orchid-06", name: "orchid" },
  ];

  return (
    <>
      <Section title="Default (32px)">
        {agents.map(a => (
          <AgentMonogram key={a.id} agentId={a.id} name={a.name} />
        ))}
      </Section>
      <Section title="Sizes">
        <AgentMonogram agentId="obsidian-01" name="obsidian" size={24} />
        <AgentMonogram agentId="obsidian-01" name="obsidian" size={32} />
        <AgentMonogram agentId="obsidian-01" name="obsidian" size={40} />
        <AgentMonogram agentId="obsidian-01" name="obsidian" size={56} />
      </Section>
      <Section title="Deterministic (same ID = same color)">
        <AgentMonogram agentId="agent-xyz-123" name="test" />
        <AgentMonogram agentId="agent-xyz-123" name="test" />
        <AgentMonogram agentId="agent-abc-456" name="other" />
      </Section>
    </>
  );
}

// ─── AgentHueDot ────────────────────────────────────────────────────────────

function AgentHueDotShowcase() {
  const ids = ["obsidian-01", "ember-02", "sable-03", "verdigris-04", "cobalt-05", "orchid-06"];

  return (
    <>
      <Section title="Default (8px)">
        {ids.map(id => (
          <AgentHueDot key={id} agentId={id} />
        ))}
      </Section>
      <Section title="Sizes">
        {[4, 6, 8, 10, 14, 20].map(s => (
          <AgentHueDot key={s} agentId="obsidian-01" size={s} />
        ))}
      </Section>
      <Section title="With glow">
        {ids.map(id => (
          <AgentHueDot key={id} agentId={id} size={10} glow />
        ))}
      </Section>
      <Section title="Pulse (respects prefers-reduced-motion)">
        {ids.slice(0, 3).map(id => (
          <AgentHueDot key={id} agentId={id} size={10} pulse />
        ))}
      </Section>
    </>
  );
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

function ChromeShowcase() {
  return (
    <>
      <Section title="ChromeBar (48px, full width)">
        <div style={{ width: "100%", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <ChromeBar onOpenCommand={() => alert("⌘K pressed")} onOpenShortcuts={() => alert("? pressed")} />
        </div>
      </Section>
      <Section title="Nav (sliding underline on active route)">
        <div style={{ padding: "8px 16px", background: "var(--bg-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}>
          <Nav />
        </div>
      </Section>
      <Section title="How to test">
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)", lineHeight: 1.7 }}>
          <p>Visit <code style={{ color: "var(--phos-400)" }}>/playground</code> to see the full ChromeBar in context.</p>
          <p>Press <kbd style={{ padding: "2px 6px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 3, fontFamily: "var(--font-jetbrains)" }}>⌘K</kbd> on any page to open the Command Bar.</p>
          <p>Press <kbd style={{ padding: "2px 6px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 3, fontFamily: "var(--font-jetbrains)" }}>?</kbd> to see all keyboard shortcuts.</p>
        </div>
      </Section>
    </>
  );
}
