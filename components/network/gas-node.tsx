"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Building2,
  Disc3,
  Factory,
  FlaskConical,
  Fuel,
  GitBranch,
  Gauge as GaugeIcon,
} from "lucide-react";
import { cn } from "cn";
import { ZONE_STROKE } from "@/lib/constants";
import type { NodeKind, NodeStatus, Zone } from "@/lib/schema";

export type GasNodeData = {
  code: string;
  name: string;
  kind: NodeKind;
  zone: Zone;
  status: NodeStatus;
  p: number | null;
  f: number | null;
  ts: number | null;
  openAlarms: number;
  selected?: boolean;
};

export type GasFlowNode = Node<GasNodeData, "gas">;

const KIND_ICON: Record<NodeKind, typeof Fuel> = {
  CGS: Fuel,
  DPRS: GaugeIcon,
  IPRS: GaugeIcon,
  CNG: Fuel,
  MRS: Factory,
  VALVE: Disc3,
  JUNCTION: GitBranch,
  ODORISER: FlaskConical,
};

const STATUS_RING: Record<NodeStatus, string> = {
  operational: "ring-success/45",
  maintenance: "ring-warning/55",
  isolated: "ring-muted-foreground/40",
  faulty: "ring-destructive/70",
  planned: "ring-info/50",
};

const STATUS_DOT: Record<NodeStatus, string> = {
  operational: "bg-success",
  maintenance: "bg-warning",
  isolated: "bg-muted-foreground/50",
  faulty: "bg-destructive",
  planned: "bg-info",
};

function GasNodeImpl({ data }: NodeProps<GasFlowNode>) {
  const Icon = KIND_ICON[data.kind] ?? Building2;
  const zoneColor = ZONE_STROKE[data.zone];
  const hasTelemetry = data.p != null;

  return (
    <div
      className={cn(
        "relative w-[172px] rounded-xl bg-card/95 px-3 py-2 ring-2 backdrop-blur-sm transition-shadow",
        STATUS_RING[data.status]
      )}
      style={{ boxShadow: `0 0 0 1px ${zoneColor}55, 0 8px 20px -8px #00000080` }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-muted-foreground/60"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-muted-foreground/60"
      />

      <div className="flex items-center gap-1.5">
        <Icon
          className="size-3.5 shrink-0"
          style={{ color: zoneColor }}
          aria-hidden
        />
        <span className="font-mono text-xs font-semibold">{data.code}</span>
        <span
          className={cn("ml-auto size-1.5 shrink-0 rounded-full", STATUS_DOT[data.status])}
          title={data.status}
        />
      </div>

      <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={data.name}>
        {data.name}
      </p>

      <div className="mt-1 flex items-center gap-2 font-mono text-[11px] tnum">
        <span className={cn(hasTelemetry ? "text-foreground/85" : "text-muted-foreground/50")}>
          {hasTelemetry ? `${data.p!.toFixed(1)} bar` : "no RTU"}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground">
          {data.f != null ? `${Math.round(data.f).toLocaleString("en-IN")}` : "—"}
        </span>
      </div>

      {data.openAlarms > 0 ? (
        <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 font-mono text-[10px] font-semibold text-white shadow-lg">
          {data.openAlarms}
        </span>
      ) : null}
    </div>
  );
}

export const GasNode = memo(GasNodeImpl);
