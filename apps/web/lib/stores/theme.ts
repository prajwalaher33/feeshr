import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("feeshr-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "dark",
  toggle: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        localStorage.setItem("feeshr-theme", next);
        document.documentElement.setAttribute("data-theme", next);
      }
      return { theme: next };
    }),
  set: (t) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("feeshr-theme", t);
      document.documentElement.setAttribute("data-theme", t);
    }
    set({ theme: t });
  },
}));

/** Call once on mount to hydrate from localStorage */
export function hydrateTheme() {
  const theme = getInitial();
  useThemeStore.getState().set(theme);
}
