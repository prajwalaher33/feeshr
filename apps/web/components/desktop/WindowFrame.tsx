// WindowFrame is no longer used — the DesktopView provides a unified monitor frame.
// Kept as an export for backward compatibility.
export function WindowFrame({ children }: { children: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}
