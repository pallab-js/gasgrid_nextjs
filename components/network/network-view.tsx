"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Crosshair, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZONE_STROKE } from "@/lib/constants";
import type { NetworkGraph } from "@/lib/repo/network";
import type { NodeStatus, Role, Zone } from "@/lib/schema";
import { GasNode, type GasFlowNode } from "./gas-node";
import { NodeDrawer } from "./node-drawer";

const nodeTypes = { gas: GasNode };

type ZoneFilter = "all" | Zone;
type StatusFilter = "all" | NodeStatus | "alarm";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Any status",
  operational: "Operational",
  maintenance: "Maintenance",
  isolated: "Isolated",
  faulty: "Faulty",
  planned: "Planned",
  alarm: "Has open alarm",
};

function buildNodes(g: NetworkGraph): GasFlowNode[] {
  return g.nodes.map((n) => ({
    id: String(n.id),
    type: "gas" as const,
    position: { x: n.gx, y: n.gy },
    data: {
      code: n.code,
      name: n.name,
      kind: n.kind,
      zone: n.zone,
      status: n.status,
      p: n.p,
      f: n.f,
      ts: n.ts,
      openAlarms: n.openAlarms,
    },
  }));
}

function buildEdges(g: NetworkGraph): Edge[] {
  return g.edges.map((e) => {
    const isolated = e.status === "isolated" || e.status === "faulty";
    const dashed = e.status === "maintenance" || e.status === "planned";
    return {
      id: `e${e.id}`,
      source: String(e.from),
      target: String(e.to),
      type: "smoothstep" as const,
      style: {
        stroke: isolated ? "var(--destructive)" : ZONE_STROKE[e.zone],
        strokeWidth: 1.5 + Math.min(e.diameterMm / 45, 4),
        strokeDasharray: dashed ? "7 5" : undefined,
        opacity: isolated ? 0.9 : 0.75,
      },
    };
  });
}

export function NetworkView({
  initial,
  role,
}: {
  initial: NetworkGraph;
  role: Role;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<GasFlowNode>(
    buildNodes(initial)
  );
  const [edges, , onEdgesChange] = useEdgesState<Edge>(buildEdges(initial));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const rfRef = useRef<ReactFlowInstance<GasFlowNode, Edge> | null>(null);

  /* live merge — polled node badges (p, f, status, alarm count) */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/live/nodes", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          nodes: NetworkGraph["nodes"];
        };
        if (!alive) return;
        const byId = new Map(body.nodes.map((n) => [n.id, n]));
        setNodes((prev) =>
          prev.map((node) => {
            const live = byId.get(Number(node.id));
            if (!live) return node;
            const d = node.data;
            if (
              d.p === live.p &&
              d.f === live.f &&
              d.status === live.status &&
              d.openAlarms === live.openAlarms
            ) {
              return node;
            }
            return {
              ...node,
              data: {
                ...d,
                p: live.p,
                f: live.f,
                ts: live.ts,
                status: live.status,
                openAlarms: live.openAlarms,
              },
            };
          })
        );
      } catch {
        /* transient */
      }
    };
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [setNodes]);

  /* filters as derived visibility (positions & data stay untouched) */
  const { displayNodes, displayEdges } = useMemo((): {
    displayNodes: GasFlowNode[];
    displayEdges: Edge[];
  } => {
    const q = query.trim().toLowerCase();
    const hidden = new Set<string>();
    for (const n of nodes) {
      const d = n.data;
      const zoneOk = zoneFilter === "all" || d.zone === zoneFilter;
      const statusOk =
        statusFilter === "all"
          ? true
          : statusFilter === "alarm"
            ? d.openAlarms > 0
            : d.status === statusFilter;
      const queryOk =
        q === "" ||
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q);
      if (!(zoneOk && statusOk && queryOk)) hidden.add(n.id);
    }
    return {
      displayNodes: nodes.map((n) => ({ ...n, hidden: hidden.has(n.id) })),
      displayEdges: edges.map((e) => ({
        ...e,
        hidden: hidden.has(e.source) || hidden.has(e.target),
      })),
    };
  }, [nodes, edges, zoneFilter, statusFilter, query]);

  const filterCount =
    (zoneFilter === "all" ? 0 : 1) +
    (statusFilter === "all" ? 0 : 1) +
    (query.trim() ? 1 : 0);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          rfRef.current = instance;
        }}
        onNodeClick={(_, node) => setSelectedId(Number(node.id))}
        onPaneClick={() => setSelectedId(null)}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        className="bg-canvas/0"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="rgba(255,255,255,0.14)" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="rgba(10,13,58,0.75)"
          nodeColor={(n) =>
            ZONE_STROKE[(n.data as GasFlowNode["data"]).zone] ?? "#5865f2"
          }
          style={{ width: 170, height: 116, borderRadius: 12 }}
        />
      </ReactFlow>

      {/* toolbar + legend */}
      <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/90 p-2 shadow-xl backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search node…"
              className="h-8 w-40 pl-8 text-xs"
            />
          </div>
          <Select
            value={zoneFilter}
            onValueChange={(v) => setZoneFilter(v as ZoneFilter)}
          >
            <SelectTrigger size="sm" className="w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="secondary">Secondary</SelectItem>
              <SelectItem value="tertiary">Tertiary</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger size="sm" className="w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              rfRef.current?.fitView({ padding: 0.18, maxZoom: 1.2, duration: 400 })
            }
            title="Fit network to view"
          >
            <Crosshair className="size-3.5" />
            Fit
          </Button>
          {filterCount > 0 ? (
            <span className="px-1 text-[11px] text-muted-foreground">
              {filterCount} filter{filterCount > 1 ? "s" : ""} on
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/70 bg-card/80 px-3 py-1.5 text-[11px] text-muted-foreground shadow-lg backdrop-blur">
          {(
            [
              ["primary", "Primary"],
              ["secondary", "Secondary"],
              ["tertiary", "Tertiary"],
            ] as const
          ).map(([zone, label]) => (
            <span key={zone} className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{ background: ZONE_STROKE[zone] }}
              />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-destructive" />
            Isolated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-muted-foreground" style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px)" }} />
            Maint.
          </span>
          <span className="text-muted-foreground/70">Ring = status · dot = live</span>
        </div>
      </div>

      <NodeDrawer
        nodeId={selectedId}
        role={role}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
