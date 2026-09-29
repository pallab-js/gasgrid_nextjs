"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CircleCheck,
  CircleDot,
  Loader2,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ackAlarmAction, resolveAlarmAction } from "@/lib/actions/alarms";
import { ALARM_TYPE_LABELS, SEVERITY_TONE } from "@/lib/constants";
import { fmtDateTime, timeAgo } from "@/lib/format";
import type { AlarmsPage as AlarmsPageData } from "@/lib/repo/alarms";
import {
  ALARM_TYPES,
  type AlarmType,
  type Role,
  type Severity,
} from "@/lib/schema";
import { cn } from "cn";

const SEVERITIES: Severity[] = ["critical", "warning", "info"];
const RANGES = [
  { key: "24h", hours: 24 },
  { key: "7d", hours: 24 * 7 },
  { key: "30d", hours: 24 * 30 },
  { key: "all", hours: 0 },
] as const;

const SEV_DOT: Record<Severity, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card className="py-3">
      <CardContent className="flex items-center justify-between px-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-xl font-semibold tnum", tone)}>
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

export function AlarmsConsole({
  initial,
  role,
  initialStatus,
}: {
  initial: AlarmsPageData;
  role: Role;
  initialStatus: "open" | "acknowledged" | "resolved";
}) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<"open" | "acknowledged" | "resolved">(
    initialStatus
  );
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [type, setType] = useState<"all" | AlarmType>("all");
  const [node, setNode] = useState<"all" | string>("all");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("7d");
  const [pending, startTransition] = useTransition();
  const [resolveTarget, setResolveTarget] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const canAct = role === "admin" || role === "operator";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/live/alarms", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as AlarmsPageData);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  const rows = useMemo(() => {
    const now = data.ts;
    const hours = RANGES.find((r) => r.key === range)!.hours;
    const from = hours ? now - hours * 3_600_000 : 0;
    return data.rows.filter(
      (r) =>
        r.status === tab &&
        (severity === "all" || r.severity === severity) &&
        (type === "all" || r.type === type) &&
        (node === "all" || String(r.nodeId) === node) &&
        r.ts >= from
    );
  }, [data.rows, data.ts, tab, severity, type, node, range]);

  const act = (fn: () => Promise<void>, ok: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        await refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message.replace(/^[A-Z_]+:\s*/, "")
            : "Action failed"
        );
      }
    });
  };

  const actionButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void
  ) => {
    if (!canAct) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="secondary" className="h-7 text-xs" disabled>
              {icon}
              {label}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Operator role required</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs"
        disabled={pending}
        onClick={onClick}
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : icon}
        {label}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Open alarms"
          value={data.counts.open}
          tone={data.counts.open ? "text-destructive" : "text-success"}
        />
        <KpiCard
          label="Critical open"
          value={data.counts.critical}
          tone={data.counts.critical ? "text-destructive" : "text-success"}
        />
        <KpiCard label="Acknowledged" value={data.counts.acknowledged} tone="text-warning" />
        <KpiCard label="Resolved (loaded)" value={data.counts.resolved} tone="text-muted-foreground" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
        >
          <TabsList>
            <TabsTrigger value="open" className="gap-1.5">
              Open
              <Badge variant="secondary" className="ml-1 font-mono text-[10px]">
                {data.counts.open}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="acknowledged" className="gap-1.5">
              Acknowledged
              <Badge variant="secondary" className="ml-1 font-mono text-[10px]">
                {data.counts.acknowledged}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved
              <Badge variant="secondary" className="ml-1 font-mono text-[10px]">
                {data.counts.resolved}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={severity}
          onValueChange={(v) => setSeverity(v as "all" | Severity)}
        >
          <SelectTrigger size="sm" className="w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any severity</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(v) => setType(v as "all" | AlarmType)}>
          <SelectTrigger size="sm" className="w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any type</SelectItem>
            {ALARM_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {ALARM_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={node} onValueChange={setNode}>
          <SelectTrigger size="sm" className="w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any asset</SelectItem>
            {data.filterNodes.map((n) => (
              <SelectItem key={n.id} value={String(n.id)}>
                {n.code} · {n.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium",
                range === r.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Severity</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Asset</th>
                  <th className="py-2 pr-3 font-medium">Message</th>
                  <th className="py-2 pr-3 font-medium">Value / threshold</th>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            SEV_DOT[r.severity as Severity]
                          )}
                        />
                        <Badge
                          variant="outline"
                          className={SEVERITY_TONE[r.severity as Severity]}
                        >
                          {r.severity}
                        </Badge>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {ALARM_TYPE_LABELS[r.type as AlarmType] ?? r.type}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/stations/${r.nodeId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.nodeCode}
                      </Link>
                    </td>
                    <td className="max-w-md py-2.5 pr-3 text-[13px]">
                      {r.message}
                      {r.note ? (
                        <span className="block text-[11px] text-muted-foreground">
                          note: {r.note}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs tnum">
                      {r.value != null ? r.value.toFixed(2) : "—"}
                      {r.threshold != null ? (
                        <span className="text-muted-foreground">
                          {" / "}
                          {r.threshold.toFixed(2)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-xs whitespace-nowrap">
                      {fmtDateTime(r.ts)}
                      <span className="block text-[11px] text-muted-foreground">
                        {timeAgo(r.ts)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      <Badge
                        variant="outline"
                        className={cn(
                          r.status === "open" &&
                            "border-destructive/40 text-destructive",
                          r.status === "acknowledged" &&
                            "border-warning/40 text-warning",
                          r.status === "resolved" &&
                            "border-success/40 text-success"
                        )}
                      >
                        {r.status}
                      </Badge>
                      {r.ackBy ? (
                        <span className="block text-[11px] text-muted-foreground">
                          by {r.ackBy}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        {r.status === "open"
                          ? actionButton(
                              "Ack",
                              <CircleCheck className="size-3" />,
                              () =>
                                act(
                                  () => ackAlarmAction(r.id),
                                  "Alarm acknowledged"
                                )
                            )
                          : null}
                        {r.status !== "resolved"
                          ? actionButton(
                              "Resolve",
                              <ShieldAlert className="size-3" />,
                              () => {
                                setResolveNote("");
                                setResolveTarget(r.id);
                              }
                            )
                          : null}
                        {r.status === "resolved" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CircleDot className="size-3" />
                            {r.resolvedAt ? timeAgo(r.resolvedAt) : ""}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No {tab} alarms match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={resolveTarget !== null}
        onOpenChange={(o) => {
          if (!o) setResolveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve alarm</DialogTitle>
            <DialogDescription>
              Add a resolution note (optional). This action is audited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-note">Note</Label>
            <Textarea
              id="resolve-note"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="e.g. valve cycled, pressure normalised, leak repaired"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setResolveTarget(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const id = resolveTarget;
                if (id == null) return;
                act(async () => {
                  await resolveAlarmAction(id, resolveNote || undefined);
                  setResolveTarget(null);
                }, "Alarm resolved");
              }}
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
