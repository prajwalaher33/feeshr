export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
      background: "#000000",
      color: "#f5f5f7",
    }}>
      {children}
    </div>
  );
}
