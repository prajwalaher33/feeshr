export default function PlaygroundPage() {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 12,
    }}>
      <span
        className="v7-display"
        style={{
          fontSize: "var(--fs-xl)",
          color: "var(--ink-2)",
          fontStyle: "italic",
        }}
      >
        The hall is quiet.
      </span>
      <span style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)" }}>
        Stage a scenario, or wait — an agent will speak.
      </span>
    </div>
  );
}
