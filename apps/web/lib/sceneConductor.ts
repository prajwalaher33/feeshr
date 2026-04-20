/**
 * SceneConductor — global choreography guardrail.
 * Serializes cinema-tier animations so two never play simultaneously.
 * UI-tier motion (<340ms) bypasses this entirely.
 *
 * Queues with priority; preempts lower-priority cinema if a higher one fires.
 */

export type CinemaPriority = "low" | "medium" | "high";

interface CinemaEntry {
  id: string;
  priority: CinemaPriority;
  duration: number; // ms
  onStart: () => void;
  onEnd: () => void;
}

const PRIORITY_RANK: Record<CinemaPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

let activeEntry: CinemaEntry | null = null;
let activeTimeout: ReturnType<typeof setTimeout> | null = null;
const queue: CinemaEntry[] = [];

function processQueue() {
  if (activeEntry) return;
  if (queue.length === 0) return;

  // Sort by priority (highest first)
  queue.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);

  const next = queue.shift()!;
  activeEntry = next;
  next.onStart();

  activeTimeout = setTimeout(() => {
    next.onEnd();
    activeEntry = null;
    activeTimeout = null;
    processQueue();
  }, next.duration);
}

/**
 * Schedule a cinema-tier animation.
 * If a higher-priority entry arrives while one is playing,
 * the active entry is preempted (onEnd called immediately).
 */
export function scheduleCinema(entry: CinemaEntry): () => void {
  // Check if we should preempt
  if (activeEntry && PRIORITY_RANK[entry.priority] > PRIORITY_RANK[activeEntry.priority]) {
    // Preempt current
    if (activeTimeout) clearTimeout(activeTimeout);
    activeEntry.onEnd();
    activeEntry = null;
    activeTimeout = null;

    // Insert new entry at front
    queue.unshift(entry);
    processQueue();
  } else if (activeEntry) {
    // Queue behind active
    queue.push(entry);
  } else {
    queue.push(entry);
    processQueue();
  }

  // Return cancel function
  return () => {
    if (activeEntry?.id === entry.id) {
      if (activeTimeout) clearTimeout(activeTimeout);
      activeEntry.onEnd();
      activeEntry = null;
      activeTimeout = null;
      processQueue();
    } else {
      const idx = queue.findIndex(e => e.id === entry.id);
      if (idx !== -1) queue.splice(idx, 1);
    }
  };
}

/** Check if any cinema animation is currently active */
export function isCinemaActive(): boolean {
  return activeEntry !== null;
}

/** Get the active cinema entry ID (for testing/debugging) */
export function getActiveCinemaId(): string | null {
  return activeEntry?.id ?? null;
}

/** Clear all queued and active cinema (for cleanup) */
export function clearCinema(): void {
  if (activeTimeout) clearTimeout(activeTimeout);
  if (activeEntry) activeEntry.onEnd();
  activeEntry = null;
  activeTimeout = null;
  queue.length = 0;
}
