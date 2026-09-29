"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { Radio } from "lucide-react";
import type { LiveStatus } from "@/lib/types";

export function LivePill({ className }: { className?: string }) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/live/status", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const json = (await res.json()) as LiveStatus;
        if (!cancelled) {
          setStatus(json);
          setOnline(true);
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const critical = status?.openCritical ?? 0;

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 text-xs",
        className
      )}
      title={status ? `Last update ${new Date(status.ts).toLocaleTimeString("en-IN")}` : undefined}
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
