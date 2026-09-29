"use client";

import Link from "next/link";
import { Siren } from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ALARM_STATUS_LABELS } from "@/lib/constants";
import type { Severity } from "@/lib/schema";
import { timeAgo } from "@/lib/format";
import type { Overview } from "@/lib/repo/overview";

const DOT: Record<Severity, string> = {
  info: "bg-info",
  warning: "bg-warning",
  critical: "bg-destructive",
};

export function AlarmFeed({
  data,
  openWorkOrders,
  className,
}: {
  data: Overview["feed"];
  openWorkOrders: number;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Siren className="size-4 text-destructive" aria-hidden />
          Alarm feed
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Link
              href="/work-orders"
              className="hover:text-foreground hover:underline"
            >
              {openWorkOrders} open WOs
            </Link>
            <Link href="/alarms" className="hover:text-foreground hover:underline">
              View all
            </Link>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active alarms — network is quiet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    DOT[a.severity]
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {a.code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(a.ts)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[13px]" title={a.message}>
                    {a.message}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "shrink-0",
                    a.status === "acknowledged" &&
                      "bg-warning/10 text-warning"
                  )}
                >
                  {ALARM_STATUS_LABELS[a.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
