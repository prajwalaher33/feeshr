import { create } from "zustand";

interface NetworkState {
  opacity: number;
  setOpacity: (v: number) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  opacity: 0.3,
  setOpacity: (v) => set({ opacity: v }),
}));
