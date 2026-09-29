import type { WoStatus } from "@/lib/schema";

export const TERMINAL_WO: WoStatus[] = ["done", "cancelled"];

export const WO_NEXT: Record<WoStatus, WoStatus[]> = {
  open: ["assigned", "in_progress", "blocked", "cancelled"],
  assigned: ["open", "in_progress", "blocked", "cancelled"],
  in_progress: ["assigned", "blocked", "done", "cancelled"],
  blocked: ["open", "assigned", "in_progress", "cancelled"],
  done: [],
  cancelled: [],
};
