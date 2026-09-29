"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NODE_KIND_LABELS,
  NODE_STATUS_LABELS,
  ZONE_LABELS,
} from "@/lib/constants";
import { fmtDec, fmtInt, timeAgo } from "@/lib/format";
import type { StationsRegister } from "@/lib/repo/stations";
import type { NetworkGraph } from "@/lib/repo/network";
import type { NodeKind, NodeStatus, Zone } from "@/lib/schema";
import { Sparkline } from "@/components/shared/sparkline";

const STATUS_BADGE: Record<NodeStatus, string> = {
  operational: "bg-success/10 text-success border-success/30",
  maintenance: "bg-warning/10 text-warning border-warning/30",
  isolated: "bg-muted text-muted-foreground border-border",
  faulty: "bg-destructive/10 text-destructive border-destructive/30",
  planned: "bg-info/10 text-info border-info/30",
};

type SortKey = "code" | "kind" | "zone" | "status" | "p" | "f" | "alarms";

function SortHead({
  label,
  k,
  sort,
  setSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground"
        )}
        onClick={() =>
          setSort({ key: k, dir: active && sort.dir === 1 ? -1 : 1 })
        }
      >
        {label}
        {active ? (
          sort.dir === 1 ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

export function StationsRegister({ initial }: { initial: StationsRegister }) {
  const [rows, setRows] = useState(initial.rows);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | NodeKind>("all");
  const [zone, setZone] = useState<"all" | Zone>("all");
  const [status, setStatus] = useState<"all" | NodeStatus>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "code",
    dir: 1,
  });

  /* live readings */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/live/nodes", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const body = (await res.json()) as Pick<NetworkGraph, "ts" | "nodes">;
        if (!alive) return;
        const byId = new Map(body.nodes.map((n) => [n.id, n]));
        setRows((prev) =>
          prev.map((r) => {
            const live = byId.get(r.id);
            if (!live) return r;
            if (r.p === live.p && r.f === live.f && r.status === live.status && r.openAlarms === live.openAlarms)
              return r;
            return {
              ...r,
              p: live.p,
              f: live.f,
              status: live.status as NodeStatus,
              openAlarms: live.openAlarms,
            };
          })
        );
      } catch {
        /* transient */
      }
    };
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (q === "" ||
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)) &&
        (kind === "all" || r.kind === kind) &&
        (zone === "all" || r.zone === zone) &&
        (status === "all" || r.status === status)
    );
    const dir = sort.dir;
    out.sort((a, b) => {
      switch (sort.key) {
        case "code":
          return a.code.localeCompare(b.code) * dir;
        case "kind":
          return (a.kind + a.code).localeCompare(b.kind + b.code) * dir;
        case "zone":
          return (a.zone + a.code).localeCompare(b.zone + b.code) * dir;
        case "status":
          return (a.status + a.code).localeCompare(b.status + b.code) * dir;
        case "p":
          return ((a.p ?? -1) - (b.p ?? -1)) * dir;
        case "f":
          return ((a.f ?? -1) - (b.f ?? -1)) * dir;
        case "alarms":
          return (a.openAlarms - b.openAlarms) * dir;
      }
    });
    return out;
  }, [rows, query, kind, zone, status, sort]);

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code or name…"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as NodeKind | "all")}>
            <SelectTrigger size="sm" className="w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {(Object.keys(NODE_KIND_LABELS) as NodeKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {NODE_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={zone} onValueChange={(v) => setZone(v as Zone | "all")}>
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
            value={status}
            onValueChange={(v) => setStatus(v as NodeStatus | "all")}
          >
            <SelectTrigger size="sm" className="w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {(Object.keys(NODE_STATUS_LABELS) as NodeStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {NODE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {view.length} of {rows.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Station" k="code" sort={sort} setSort={setSort} />
                <SortHead label="Kind" k="kind" sort={sort} setSort={setSort} />
                <SortHead label="Zone" k="zone" sort={sort} setSort={setSort} />
                <SortHead label="Status" k="status" sort={sort} setSort={setSort} />
                <SortHead label="Pressure" k="p" sort={sort} setSort={setSort} className="text-right" />
                <SortHead label="Flow" k="f" sort={sort} setSort={setSort} className="text-right" />
                <TableHead>24 h flow</TableHead>
                <SortHead label="Alarms" k="alarms" sort={sort} setSort={setSort} className="text-right" />
                <TableHead>Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/stations/${r.id}`}
                      className="block hover:text-primary"
                    >
                      <span className="font-mono text-xs font-medium">{r.code}</span>
                      <span className="block max-w-44 truncate text-[11px] text-muted-foreground">
                        {r.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{NODE_KIND_LABELS[r.kind]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ZONE_LABELS[r.zone]}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[r.status]}>
                      {NODE_STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tnum">
                    {r.p != null ? `${fmtDec(r.p)} bar` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tnum">
                    {r.f != null ? fmtInt(r.f) : "—"}
                  </TableCell>
                  <TableCell className="w-28">
                    <Sparkline
                      data={r.trend}
                      height={26}
                      color="var(--chart-1)"
                      fill={false}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.openAlarms > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 font-mono text-[10px] font-semibold text-white">
                        {r.openAlarms}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.ts != null ? timeAgo(r.ts) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {view.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                    No assets match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
