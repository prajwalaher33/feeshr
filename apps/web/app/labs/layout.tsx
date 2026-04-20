import { notFound } from "next/navigation";

export default function LabsLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_LABS !== "1") {
    notFound();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-0)",
      color: "var(--ink-0)",
      fontFamily: "var(--font-inter), system-ui, sans-serif",
    }}>
      {children}
    </div>
  );
}
