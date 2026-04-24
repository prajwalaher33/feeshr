export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
      background: "#030506",
      color: "#f0f2f8",
    }}>
      {children}
    </div>
  );
}
