import { create } from "zustand";
import type { FeedEvent } from "@/lib/types/events";

interface FeedState {
  events: FeedEvent[];
  filter: string;
  addEvent: (e: FeedEvent) => void;
  setEvents: (events: FeedEvent[]) => void;
  setFilter: (f: string) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  events: [],
  filter: "all",
  addEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 100) })),
  setEvents: (events) => set({ events }),
  setFilter: (f) => set({ filter: f }),
}));
