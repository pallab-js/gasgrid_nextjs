"use client";

/**
 * Shared live-data layer.
 *
 * Replaces the per-component `setInterval(fetch(...))` loops that each screen
 * used to run independently. A single `LiveProvider` (mounted once in the app
 * shell) owns one timer and fetches only the `/api/live/*` snapshot endpoints
 * that currently have at least one mounted subscriber. Subscriptions are
 * reference-counted, so two components reading the same endpoint share a single
 * fetch instead of racing two intervals.
 *
 * Per-endpoint cadence is preserved exactly as the original components had it.
 * Parameterized detail views (node drawer, telemetry explorer) are intentionally
 * out of scope — they are transient and param-scoped, not background fan-out.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

/* ── endpoint registry ── */

export type LiveEndpoint =
  | "status"
  | "overview"
  | "nodes"
  | "alarms"
  | "work-orders";

/** Per-endpoint poll cadence in ms — matches the original component intervals. */
const CADENCE: Record<LiveEndpoint, number> = {
  status: 10_000,
  overview: 6_000,
  nodes: 5_000,
  alarms: 10_000,
  "work-orders": 15_000,
};

const URL: Record<LiveEndpoint, string> = {
  status: "/api/live/status",
  overview: "/api/live/overview",
  nodes: "/api/live/nodes",
  alarms: "/api/live/alarms",
  "work-orders": "/api/live/work-orders",
};

type Slot = {
  data: unknown;
  refs: number;
  lastFetch: number;
  inFlight: boolean;
  listeners: Set<() => void>;
};

class LiveStore {
  private slots = new Map<LiveEndpoint, Slot>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private slot(ep: LiveEndpoint): Slot {
    let s = this.slots.get(ep);
    if (!s) {
      s = { data: undefined, refs: 0, lastFetch: 0, inFlight: false, listeners: new Set() };
      this.slots.set(ep, s);
    }
    return s;
  }

  /** Seed an endpoint with an SSR `initial` value without forcing a fetch. */
  seed(ep: LiveEndpoint, initial: unknown) {
    const s = this.slot(ep);
    if (s.data === undefined && initial !== undefined) {
      s.data = initial;
    }
  }

  getSnapshot(ep: LiveEndpoint): unknown {
    return this.slot(ep).data;
  }

  subscribe(ep: LiveEndpoint, listener: () => void): () => void {
    const s = this.slot(ep);
    s.listeners.add(listener);
    s.refs += 1;
    this.ensureTimer();
    // Kick an immediate fetch if this endpoint has never loaded from the server.
    if (!s.inFlight && s.lastFetch === 0) void this.fetchOne(ep);
    return () => {
      s.listeners.delete(listener);
      s.refs -= 1;
      if (this.noSubscribers()) this.stopTimer();
    };
  }

  private noSubscribers(): boolean {
    for (const s of this.slots.values()) if (s.refs > 0) return false;
    return true;
  }

  private emit(s: Slot) {
    for (const l of s.listeners) l();
  }

  private async fetchOne(ep: LiveEndpoint) {
    const s = this.slot(ep);
    if (s.inFlight) return;
    s.inFlight = true;
    s.lastFetch = Date.now();
    try {
      const res = await fetch(URL[ep], { cache: "no-store" });
      if (res.ok) {
        s.data = await res.json();
        this.emit(s);
      }
    } catch {
      /* transient — next tick retries */
    } finally {
      s.inFlight = false;
    }
  }

  private ensureTimer() {
    if (this.timer) return;
    // Base tick at 1s; each endpoint fetches only when its own cadence elapses.
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [ep, s] of this.slots) {
        if (s.refs <= 0) continue;
        if (now - s.lastFetch >= CADENCE[ep]) void this.fetchOne(ep);
      }
    }, 1_000);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Force an immediate refetch (used after a mutation for instant feedback). */
  refetch(ep: LiveEndpoint) {
    void this.fetchOne(ep);
  }
}

/* ── context ── */

const LiveContext = createContext<LiveStore | null>(null);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  // Lazy state initializer constructs the store exactly once, without reading
  // a ref during render.
  const [store] = useState(() => new LiveStore());
  return <LiveContext.Provider value={store}>{children}</LiveContext.Provider>;
}

/* ── generic hook ── */

function useLive<T>(ep: LiveEndpoint, initial?: T): T | undefined {
  const store = useContext(LiveContext);
  if (!store) {
    throw new Error("useLive must be used within <LiveProvider>");
  }

  // Seed the SSR value exactly once via a lazy state initializer so the first
  // paint matches the server-rendered page without reading a ref in render.
  useState(() => {
    if (initial !== undefined) store.seed(ep, initial);
    return null;
  });

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(ep, cb),
    [store, ep]
  );
  const getSnapshot = useCallback(() => store.getSnapshot(ep), [store, ep]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as
    | T
    | undefined;

  return value ?? initial;
}

/** Returns a stable callback that forces an immediate refetch of an endpoint. */
export function useLiveRefetch(ep: LiveEndpoint): () => void {
  const store = useContext(LiveContext);
  if (!store) {
    throw new Error("useLiveRefetch must be used within <LiveProvider>");
  }
  return useCallback(() => store.refetch(ep), [store, ep]);
}

/* ── typed hooks (import the payload types where used) ── */

export function useLiveStatus<T>(initial?: T) {
  return useLive<T>("status", initial);
}
export function useLiveOverview<T>(initial?: T) {
  return useLive<T>("overview", initial);
}
export function useLiveNodes<T>(initial?: T) {
  return useLive<T>("nodes", initial);
}
export function useLiveAlarms<T>(initial?: T) {
  return useLive<T>("alarms", initial);
}
export function useLiveWorkOrders<T>(initial?: T) {
  return useLive<T>("work-orders", initial);
}

/* Re-export for tests / debugging */
export { useLive };
