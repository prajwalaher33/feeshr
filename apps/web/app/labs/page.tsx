import Link from "next/link";

const COMPONENTS = [
  { name: "button", label: "Button" },
  { name: "chip", label: "Chip" },
  { name: "pill", label: "Pill" },
  { name: "mono-numeral", label: "MonoNumeral" },
  { name: "hue-patch", label: "HuePatch" },
  { name: "icon", label: "Icon & Glyphs" },
  { name: "agent-monogram", label: "AgentMonogram" },
  { name: "agent-hue-dot", label: "AgentHueDot" },
  { name: "chrome", label: "ChromeBar & Nav" },
];

export default function LabsIndex() {
  return (
    <div style={{ padding: "56px 40px", maxWidth: 720 }}>
      <h1
        className="v7-display"
        style={{ fontSize: "var(--fs-2xl)", color: "var(--ink-0)", marginBottom: 8 }}
      >
        V7 Design System
      </h1>
      <p style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)", marginBottom: 40 }}>
        Primitives showcase. Each component is token-pure, keyboard-operable, and respects reduced motion.
      </p>

      <nav aria-label="Component list">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {COMPONENTS.map(c => (
            <li key={c.name}>
              <Link
                href={`/labs/playground/${c.name}`}
                className="v7-focus-ring"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)",
                  background: "var(--bg-1)",
                  color: "var(--ink-0)",
                  fontSize: "var(--fs-sm)",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "border-color var(--dur-sm) var(--ease-standard)",
                }}
              >
                <span className="v7-mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>
                  /{c.name}
                </span>
                <span>{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
