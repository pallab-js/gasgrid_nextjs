"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CircleCheck, Loader2, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ackAlarmAction } from "@/lib/actions/alarms";
import {
  ALARM_STATUS_LABELS,
  ALARM_TYPE_LABELS,
  NODE_KIND_LABELS,
  NODE_STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  SEVERITY_TONE,
  WO_STATUS_LABELS,
  ZONE_LABELS,
} from "@/lib/constants";
import { fmtDate, fmtInt, timeAgo } from "@/lib/format";
import type { StationPage } from "@/lib/repo/stations";
import type { NodeDetailPayload } from "@/lib/repo/node-detail";
import type { Role } from "@/lib/schema";
import { Gauge } from "@/components/shared/gauge";

const STATUS_BADGE: Record<string, string> = {
  operational: "bg-success/10 text-success border-success/30",
  maintenance: "bg-warning/10 text-warning border-warning/30",
  isolated: "bg-muted text-muted-foreground border-border",
  faulty: "bg-destructive/10 text-destructive border-destructive/30",
  planned: "bg-info/10 text-info border-info/30",
};

function fmtTick(ts: number, bucketMs: number) {
  const d = new Date(ts);
  if (bucketMs >= 3_600_000 && bucketMs % 86_400_000 !== 0) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (bucketMs >= 86_400_000) return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function StationView({
  data,
  role,
}: {
  data: StationPage;
  role: Role;
}) {
  const [live, setLive] = useState<NodeDetailPayload | null>(null);
  const [pending, startTransition] = useTransition();
  const canAct = role === "admin" || role === "operator";

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/nodes/${data.node.id}`, {
          cache: "no-store",
        });
        if (res.ok && alive) setLive((await res.json()) as NodeDetailPayload);
      } catch {
        /* transient */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [data.node.id]);

  const ack = (alarmId: number) => {
    startTransition(async () => {
      try {
        await ackAlarmAction(alarmId);
        toast.success("Alarm acknowledged");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message.replace(/^[A-Z_]+:\s*/, "") : "Action failed"
        );
      }
    });
  };

  const latestP = live?.latest?.p ?? data.latest?.p ?? null;
  const latestF = live?.latest?.f ?? data.latest?.f ?? null;
  const latestTs = live?.latest?.ts ?? data.latest?.ts ?? null;
  const band = data.band;
  const gaugeMax = band ? Math.ceil(band.over * 1.3) : 40;

  const chart = data.hourly24.map((h) => ({
    time: fmtTick(h.ts, 3_600_000),
    pressure: h.p || null,
    flow: h.f || null,
  }));

  const openAlarms = data.alarms.filter((a) => a.status !== "resolved");

  return (
    <div className="space-y-4">
      {/* header */}
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {data.node.code}
              </Badge>
              <Badge variant="outline" className={STATUS_BADGE[data.node.status]}>
                {NODE_STATUS_LABELS[data.node.status]}
              </Badge>
              <Badge variant="secondary">{NODE_KIND_LABELS[data.node.kind]}</Badge>
              <Badge variant="secondary">{ZONE_LABELS[data.node.zone]}</Badge>
              {openAlarms.length > 0 ? (
                <Badge className="bg-destructive/15 text-destructive">
                  {openAlarms.length} open alarm{openAlarms.length > 1 ? "s" : ""}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{data.node.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.node.address ?? "—"}
              {data.node.commissionedOn
                ? ` · commissioned ${fmtDate(data.node.commissionedOn)}`
                : ""}
              {data.consumerCount > 0
                ? ` · ${data.consumerCount} downstream consumer${data.consumerCount > 1 ? "s" : ""}`
                : ""}
            </p>
            {data.node.notes ? (
              <p className="text-sm text-muted-foreground">{data.node.notes}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href={`/map?node=${data.node.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <MapPinned className="size-3.5" />
              View on map
            </Link>
            <p className="text-[11px] text-muted-foreground">
              {latestTs ? `last seen ${timeAgo(latestTs)}` : "no telemetry"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* gauges + config */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Live pressure</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Gauge
              value={latestP}
              min={0}
              max={gaugeMax}
              band={band ?? undefined}
              label={band ? `band ${band.under}–${band.over} bar` : "bar"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold tnum">
              {latestF != null ? fmtInt(latestF) : "—"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                sm³/h
              </span>
            </p>
            <Separator className="my-3" />
            {data.detail ? (
              <div className="space-y-1.5 text-[13px]">
                {data.detail.capacityMmscfd != null ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capacity</span>
                    <span className="font-medium">{data.detail.capacityMmscfd} MMSCFD</span>
                  </div>
                ) : null}
                {data.detail.inletSetBar != null ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inlet setpoint</span>
                    <span className="font-medium">{data.detail.inletSetBar} bar</span>
                  </div>
                ) : null}
                {data.detail.outletSetBar != null ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outlet setpoint</span>
                    <span className="font-medium">{data.detail.outletSetBar} bar</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last inspection</span>
                  <span className="font-medium">
                    {data.detail.lastInspectionOn
                      ? fmtDate(data.detail.lastInspectionOn)
                      : "—"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No station configuration.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety & telemetry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.detail ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant={data.detail.slamShut ? "default" : "secondary"}>
                  Slam-shut {data.detail.slamShut ? "✓" : "✗"}
                </Badge>
                <Badge variant={data.detail.odorizer ? "default" : "secondary"}>
                  Odoriser {data.detail.odorizer ? "✓" : "✗"}
                </Badge>
                <Badge variant={data.detail.scadaRtu ? "default" : "secondary"}>
                  SCADA RTU {data.detail.scadaRtu ? "✓" : "✗"}
                </Badge>
                <Badge variant={data.detail.monitorRegulator ? "default" : "secondary"}>
                  Monitor regulator {data.detail.monitorRegulator ? "✓" : "✗"}
                </Badge>
              </div>
            ) : null}
            {data.valve ? (
              <>
                <Separator />
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valve</span>
                    <span className="font-medium capitalize">
                      {data.valve.type.replace("_", " ")} · {data.valve.state}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last exercised</span>
                    <span className="font-medium">
                      {data.valve.lastExercisedOn
                        ? fmtDate(data.valve.lastExercisedOn)
                        : "—"}
                    </span>
                  </div>
                </div>
              </>
            ) : null}
            <Separator />
            <p className="text-[11px] text-muted-foreground">
              Coordinates {data.node.lat.toFixed(5)}, {data.node.lng.toFixed(5)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 24 h chart */}
      <Card>
        <CardHeader>
          <CardTitle>24-hour pressure & flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ left: -8, right: -8, top: 6 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} minTickGap={30} />
                <YAxis
                  yAxisId="p"
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  yAxisId="f"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                  }
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(value, name) => [
                    `${Number(value).toLocaleString("en-IN")}`,
                    name === "p" ? "Pressure (bar)" : "Flow (sm³/h)",
                  ]}
                />
                <Bar yAxisId="f" dataKey="flow" fill="var(--chart-3)" fillOpacity={0.25} radius={[3, 3, 0, 0]} />
                <Line
                  yAxisId="p"
                  dataKey="pressure"
                  type="monotone"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-[var(--chart-1)]" />
              Pressure (left axis)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3 rounded-sm bg-[var(--chart-3)] opacity-40" />
              Flow (right axis)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* events + work orders */}
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">
            Events ({data.alarms.length})
          </TabsTrigger>
          <TabsTrigger value="wo">
            Work orders ({data.workOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-3">
          <Card>
            <CardContent>
              {data.alarms.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No alarm events recorded for this asset.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.alarms.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-3">
                      <Badge variant="outline" className={SEVERITY_TONE[a.severity]}>
                        {a.severity}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]">{a.message}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {ALARM_TYPE_LABELS[a.type]} · {fmtDate(a.ts)} ·{" "}
                          {timeAgo(a.ts)} · {ALARM_STATUS_LABELS[a.status]}
                        </p>
                      </div>
                      {a.status === "open" && canAct ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 shrink-0 text-xs"
                          disabled={pending}
                          onClick={() => ack(a.id)}
                        >
                          {pending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <CircleCheck className="size-3" />
                          )}
                          Ack
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wo" className="mt-3">
          <Card>
            <CardContent>
              {data.workOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No work orders for this asset.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.workOrders.map((w) => (
                    <li key={w.id} className="flex items-start gap-3 py-3">
                      <Badge
                        variant="outline"
                        className={`${PRIORITY_TONE[w.priority as keyof typeof PRIORITY_TONE]} shrink-0`}
                      >
                        {PRIORITY_LABELS[w.priority as keyof typeof PRIORITY_LABELS]}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]">
                          <span className="font-mono text-xs">{w.code}</span>{" "}
                          {w.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {WO_STATUS_LABELS[w.status]} · {w.type} · created{" "}
                          {fmtDate(w.createdAt)}
                          {w.assignee ? ` · ${w.assignee}` : ""}
                          {w.dueOn ? ` · due ${fmtDate(w.dueOn)}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/work-orders"
                className="mt-3 inline-block text-xs text-primary hover:underline"
              >
                Open work order board →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
