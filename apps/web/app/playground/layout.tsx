import { ChromeProvider } from "@/components/chrome/ChromeProvider";

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-0)",
      color: "var(--ink-0)",
    }}>
      <ChromeProvider>
        {children}
      </ChromeProvider>
    </div>
  );
}
