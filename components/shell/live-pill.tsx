"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { Radio } from "lucide-react";
import { useLiveStatus } from "@/lib/live/provider";
import type { LiveStatus } from "@/lib/types";

/** Status refreshes every 10s; treat >30s without a fresh snapshot as stale. */
const STALE_AFTER_MS = 30_000;

export function LivePill({ className }: { className?: string }) {
  const status = useLiveStatus<LiveStatus>();

  // Local 5s ticker (no network) so the stale indicator updates even when the
  // shared stream has gone quiet. `now` is state, not a render-time Date.now().
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const kick = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  const online = status == null || now == null ? null : now - status.ts <= STALE_AFTER_MS;

  const critical = status?.openCritical ?? 0;

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 text-xs",
        className
      )}
      title={status ? `Last update ${new Date(status.ts).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}` : undefined}
    >
      <span className="relative flex size-2">
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full",
            online === false
              ? "bg-destructive"
              : status?.simulator === false
                ? "bg-warning"
                : "bg-success animate-ping"
          )}
        />
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            online === false
              ? "bg-destructive"
              : status?.simulator === false
                ? "bg-warning"
                : "bg-success"
          )}
        />
      </span>
      <span className="font-medium text-foreground">
        {online === false ? "Stale" : status?.simulator === false ? "Paused" : "Live"}
      </span>
      <Radio className="size-3.5 text-muted-foreground" aria-hidden />
      {critical > 0 ? (
        <span className="rounded-md border border-destructive/40 bg-destructive/15 px-1.5 py-0.5 font-medium text-destructive">
          {critical} critical
        </span>
      ) : null}
      {status && status.openAlarms > 0 ? (
        <span className="text-muted-foreground">{status.openAlarms} open</span>
      ) : null}
    </div>
  );
}
