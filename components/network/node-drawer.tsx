"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, CircleCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ackAlarmAction } from "@/lib/actions/alarms";
import {
  ALARM_STATUS_LABELS,
  ALARM_TYPE_LABELS,
  NODE_STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONE,
  SEVERITY_TONE,
  WO_STATUS_LABELS,
  ZONE_LABELS,
} from "@/lib/constants";
import { fmtDate, fmtInt, timeAgo } from "@/lib/format";
import type { NodeDetailPayload } from "@/lib/repo/node-detail";
import type { Role } from "@/lib/schema";
import { Gauge } from "@/components/shared/gauge";
import { Sparkline } from "@/components/shared/sparkline";

const STATION_KINDS = ["CGS", "DPRS", "CNG", "MRS", "IPRS"];

const STATUS_BADGE: Record<string, string> = {
  operational: "bg-success/10 text-success border-success/30",
  maintenance: "bg-warning/10 text-warning border-warning/30",
  isolated: "bg-muted text-muted-foreground border-border",
  faulty: "bg-destructive/10 text-destructive border-destructive/30",
  planned: "bg-info/10 text-info border-info/30",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4">
      <h3 className="mb-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

export function NodeDrawer({
  nodeId,
  role,
  onClose,
}: {
  nodeId: number | null;
  role: Role;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<NodeDetailPayload | null>(null);
  const [pending, startTransition] = useTransition();
  const canAct = role === "admin" || role === "operator";

  useEffect(() => {
    if (nodeId == null) return; // detail is ignored while the sheet is closed
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/nodes/${nodeId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as NodeDetailPayload;
        if (alive) setDetail(json);
      } catch {
        /* transient */
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [nodeId]);

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

  const ready = detail && detail.node && detail.node.id === nodeId;
  const n = ready ? detail! : null;
  const band = n?.band;
  const gaugeMax = band ? Math.ceil(band.over * 1.3) : 40;

  return (
    <Sheet open={nodeId != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[430px] max-w-[100vw] gap-0 overflow-y-auto p-0"
      >
        <SheetTitle className="sr-only">Asset detail</SheetTitle>

        {!ready ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : n ? (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {n.node!.code}
                </Badge>
                <Badge variant="outline" className={STATUS_BADGE[n.node!.status]}>
                  {NODE_STATUS_LABELS[n.node!.status as keyof typeof NODE_STATUS_LABELS] ?? n.node!.status}
                </Badge>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base leading-tight font-semibold">{n.node!.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {n.node!.kind} · {ZONE_LABELS[n.node!.zone as keyof typeof ZONE_LABELS] ?? n.node!.zone} zone
                    {n.node!.commissionedOn ? ` · since ${fmtDate(n.node!.commissionedOn)}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {STATION_KINDS.includes(n.node!.kind) ? (
                    <Link
                      href={`/stations/${n.node!.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Station detail
                    </Link>
                  ) : null}
                  <Link
                    href={`/map?node=${n.node!.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View on map
                  </Link>
                </div>
              </div>
            </SheetHeader>

            {n.latest || n.band ? (
              <Section title="Live readings">
                <div className="flex items-end justify-between gap-4">
                  <Gauge
                    value={n.latest?.p ?? null}
                    min={0}
                    max={gaugeMax}
                    band={n.band ?? undefined}
                    label="Pressure"
                    size={168}
                  />
                  <div className="flex-1 space-y-3 pb-2">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Flow</p>
                      <p className="font-mono text-xl font-semibold tnum">
                        {n.latest ? fmtInt(n.latest.f) : "—"}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          sm³/h
                        </span>
                      </p>
                    </div>
                    <Sparkline
                      data={n.series.map((s) => s.f)}
                      color="var(--chart-3)"
                      valueSuffix=" sm³/h"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>1 h flow</span>
                      <span>{n.latest ? timeAgo(n.latest.ts) : "no data"}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>1 h pressure trend</span>
                    <span>
                      {band ? `band ${band.under}–${band.over} bar` : ""}
                    </span>
                  </div>
                  <Sparkline
                    data={n.series.map((s) => s.p)}
                    color="var(--chart-1)"
                    valueSuffix=" bar"
                  />
                </div>
                {n.latest ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Temp {n.latest.tempC.toFixed(1)} °C
                  </p>
                ) : null}
              </Section>
            ) : (
              <Section title="Live readings">
                <p className="text-sm text-muted-foreground">
                  Passive asset — no RTU telemetry on this node.
                </p>
                {n.valve ? (
                  <div className="mt-2">
                    <KV
                      k="Valve state"
                      v={
                        <Badge variant="outline" className="capitalize">
                          {n.valve.state}
                        </Badge>
                      }
                    />
                    <KV k="Type" v={<span className="capitalize">{n.valve.type.replace("_", " ")}</span>} />
                    <KV
                      k="Last exercised"
                      v={n.valve.lastExercisedOn ? fmtDate(n.valve.lastExercisedOn) : "—"}
                    />
                  </div>
                ) : null}
              </Section>
            )}

            <Separator />

            {n.detail ? (
              <>
                <Section title="Configuration">
                  {n.detail.capacityMmscfd != null ? (
                    <KV k="Capacity" v={`${n.detail.capacityMmscfd} MMSCFD`} />
                  ) : null}
                  {n.detail.inletSetBar != null ? (
                    <KV k="Inlet setpoint" v={`${n.detail.inletSetBar} bar`} />
                  ) : null}
                  {n.detail.outletSetBar != null ? (
                    <KV k="Outlet setpoint" v={`${n.detail.outletSetBar} bar`} />
                  ) : null}
                  <KV
                    k="Safety devices"
                    v={
                      <span className="flex gap-1">
                        {n.detail.slamShut ? <Badge variant="secondary">Slam-shut</Badge> : null}
                        {n.detail.odorizer ? <Badge variant="secondary">Odoriser</Badge> : null}
                        {n.detail.scadaRtu ? <Badge variant="secondary">SCADA</Badge> : null}
                      </span>
                    }
                  />
                  <KV
                    k="Last inspection"
                    v={n.detail.lastInspectionOn ? fmtDate(n.detail.lastInspectionOn) : "—"}
                  />
                </Section>
                <Separator />
              </>
            ) : null}

            <Section title={`Open alarms (${n.alarms.length})`}>
              {n.alarms.length === 0 ? (
                <p className="text-sm text-muted-foreground">None — all clear.</p>
              ) : (
                <ul className="space-y-2">
                  {n.alarms.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-border bg-muted/30 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={SEVERITY_TONE[a.severity]}
                        >
                          {a.severity}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(a.ts)}
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {ALARM_STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px]">{a.message}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {ALARM_TYPE_LABELS[a.type]}
                        </Badge>
                        {a.status === "open" && canAct ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 px-2 text-[11px]"
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
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Separator />

            <Section title={`Linked work orders (${n.workOrders.length})`}>
              {n.workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No work orders.</p>
              ) : (
                <ul className="space-y-2">
                  {n.workOrders.map((w) => (
                    <li key={w.id} className="flex items-start gap-2 text-[13px]">
                      <Badge
                        variant="outline"
                        className={`${PRIORITY_TONE[w.priority as keyof typeof PRIORITY_TONE]} shrink-0`}
                      >
                        {PRIORITY_LABELS[w.priority as keyof typeof PRIORITY_LABELS]}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          <span className="font-mono text-xs">{w.code}</span>{" "}
                          {w.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {WO_STATUS_LABELS[w.status as keyof typeof WO_STATUS_LABELS]}
                          {w.assignee ? ` · ${w.assignee}` : ""}
                          {w.dueOn ? ` · due ${fmtDate(w.dueOn)}` : ""}
                        </p>
                      </div>
                      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/work-orders"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Open work order board →
              </Link>
            </Section>

            {n.node!.address || n.node!.notes ? (
              <>
                <Separator />
                <Section title="Notes">
                  {n.node!.address ? (
                    <p className="text-[13px] text-muted-foreground">{n.node!.address}</p>
                  ) : null}
                  {n.node!.notes ? (
                    <p className="mt-1 text-[13px]">{n.node!.notes}</p>
                  ) : null}
                </Section>
              </>
            ) : null}
          </>
        ) : (
          <div className="p-5 text-sm text-muted-foreground">Node not found.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
