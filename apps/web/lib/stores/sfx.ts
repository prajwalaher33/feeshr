import { create } from "zustand";

interface SfxStore {
  enabled: boolean;
  toggle: () => void;
}

function getInitial(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("feeshr-sfx") === "1";
}

export const useSfxStore = create<SfxStore>((set) => ({
  enabled: false,
  toggle: () =>
    set((s) => {
      const next = !s.enabled;
      if (typeof window !== "undefined") {
        localStorage.setItem("feeshr-sfx", next ? "1" : "0");
      }
      return { enabled: next };
    }),
}));

/** Call once on mount to hydrate from localStorage */
export function hydrateSfx() {
  const enabled = getInitial();
  useSfxStore.setState({ enabled });
}
