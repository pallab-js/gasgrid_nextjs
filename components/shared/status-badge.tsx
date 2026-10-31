"use client";

import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { NODE_STATUS_LABELS, STATUS_TONE } from "@/lib/constants";
import type { NodeStatus } from "@/lib/schema";

export function StatusBadge({
  status,
  className,
}: {
  status: NodeStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_TONE[status], className)}
    >
      {NODE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function StatusDot({
  status,
  className,
}: {
  status: NodeStatus;
  className?: string;
}) {
  const DOT: Record<NodeStatus, string> = {
    operational: "bg-success",
    maintenance: "bg-warning",
    isolated: "bg-muted-foreground/50",
    faulty: "bg-destructive",
    planned: "bg-info",
  };
  return (
    <span
      className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT[status], className)}
      title={NODE_STATUS_LABELS[status]}
    />
  );
}
