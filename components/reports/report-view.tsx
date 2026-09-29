"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS } from "@/lib/constants";
import { fmtDateTime, fmtInt, inr, periodLabel as fmtPeriod } from "@/lib/format";
import type { ReportPayload } from "@/lib/repo/reports";
import { cn } from "cn";

function csv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SectionCard({
  title,
  onExport,
  filename,
  children,
}: {
  title: string;
  onExport: () => void;
  filename: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => {
            onExport();
            toast.success(`${filename} downloaded`);
          }}
        >
          <Download className="size-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ReportView({ initial }: { initial: ReportPayload }) {
  const [data, setData] = useState(initial);
  const [period, setPeriod] = useState(initial.period);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (period === initial.period) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/report?period=${period}`, {
          cache: "no-store",
        });
        if (res.ok) setData((await res.json()) as ReportPayload);
        else toast.error("Could not load that period");
      } catch {
        toast.error("Could not load that period");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [period, initial.period]);

  const p = data;

  const kpi = [
    {
      label: "Unaccounted gas",
      value: p.energy.ufgPct != null ? `${p.energy.ufgPct.toFixed(2)} %` : "—",
      tone: p.energy.ufgPct != null && p.energy.ufgPct < 3 ? "text-success" : "text-warning",
    },
    {
      label: "Availability",
      value: `${p.availability.overallPct.toFixed(1)} %`,
      tone: p.availability.overallPct >= 99 ? "text-success" : "text-warning",
    },
    {
      label: "Invoiced",
      value: inr(p.revenue.invoiced),
      tone: "",
    },
    {
      label: "Collected",
      value: inr(p.revenue.collected),
      tone: "text-success",
    },
    {
      label: "Alarms in period",
      value: String(p.alarmStats.total),
      tone: p.alarmStats.open ? "text-destructive" : "",
    },
    {
      label: "WOs raised",
      value: String(p.woStats.created),
      tone: "",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger size="sm" className="w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {p.periods.map((per) => (
              <SelectItem key={per} value={per}>
                {fmtPeriod(per)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> loading…
          </span>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          generated {fmtDateTime(p.generatedAt)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpi.map((k) => (
          <Card key={k.label} className="py-3">
            <CardContent className="space-y-1 px-4">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className={cn("font-mono text-lg font-semibold tnum", k.tone)}>
                {k.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Energy balance"
          filename={`energy-${p.period}.csv`}
          onExport={() =>
            csv(
              `energy-${p.period}.csv`,
              ["metric", "value"],
              [
                ["CGS intake (sm3)", p.energy.intakeSm3],
                ["Delivered downstream (sm3)", p.energy.deliveredSm3],
                ["UFG %", p.energy.ufgPct?.toFixed(3) ?? ""],
                ["Avg daily (sm3)", p.energy.avgDailySm3],
                ["Avg demand (MMSCFD)", p.energy.avgDemandMmscfd],
              ]
            )
          }
        >
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 text-muted-foreground">CGS intake</td>
                <td className="py-2 text-right font-mono tnum">
                  {fmtInt(p.energy.intakeSm3)} sm³
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">
                  Delivered downstream (DPRS/CNG/MRS)
                </td>
                <td className="py-2 text-right font-mono tnum">
                  {fmtInt(p.energy.deliveredSm3)} sm³
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">
                  Unaccounted gas (UFG)
                </td>
                <td className="py-2 text-right font-mono tnum">
                  {p.energy.ufgPct != null ? `${p.energy.ufgPct.toFixed(2)} %` : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Avg daily delivery</td>
                <td className="py-2 text-right font-mono tnum">
                  {fmtInt(p.energy.avgDailySm3)} sm³
                </td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Avg demand</td>
                <td className="py-2 text-right font-mono tnum">
                  {p.energy.avgDemandMmscfd} MMSCFD
                </td>
              </tr>
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          title="Revenue & collection"
          filename={`revenue-${p.period}.csv`}
          onExport={() =>
            csv(
              `revenue-${p.period}.csv`,
              ["metric", "amount_inr"],
              [
                ["Invoiced", p.revenue.invoiced],
                ["Collected", p.revenue.collected],
                ["Outstanding", p.revenue.outstanding],
                ["Collection %", p.revenue.collectionPct?.toFixed(2) ?? ""],
              ]
            )
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">Invoiced</p>
                <p className="font-mono text-base font-semibold tnum">
                  {inr(p.revenue.invoiced)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Collected</p>
                <p className="font-mono text-base font-semibold text-success tnum">
                  {inr(p.revenue.collected)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Outstanding</p>
                <p className="font-mono text-base font-semibold text-destructive tnum">
                  {inr(p.revenue.outstanding)}
                </p>
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>collection efficiency</span>
                <span className="font-mono tnum">
                  {p.revenue.collectionPct?.toFixed(1) ?? "—"}%
                </span>
              </div>
              <Progress
                value={p.revenue.collectionPct ?? 0}
                className="h-2"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Category-wise consumption (metered)"
        filename={`category-${p.period}.csv`}
        onExport={() =>
          csv(
            `category-${p.period}.csv`,
            ["category", "consumers", "consumption_sm3", "share_pct", "amount_inr"],
            p.categories.map((c) => [
              c.category,
              c.consumers,
              c.consumptionSm3,
              c.sharePct.toFixed(2),
              c.amount,
            ])
          )
        }
      >
        <div className="space-y-2.5">
          {p.categories.map((c) => (
            <div key={c.category} className="grid grid-cols-12 items-center gap-3 text-sm">
              <span className="col-span-3">{CATEGORY_LABELS[c.category]}</span>
              <span className="col-span-2 font-mono text-xs tnum">
                {c.consumers} conn
              </span>
              <span className="col-span-2 font-mono text-xs tnum">
                {fmtInt(c.consumptionSm3)} sm³
              </span>
              <div className="col-span-3">
                <div className="h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, c.sharePct)}%` }}
                  />
                </div>
              </div>
              <span className="col-span-1 font-mono text-xs tnum text-muted-foreground">
                {c.sharePct.toFixed(1)}%
              </span>
              <span className="col-span-1 text-right font-mono text-xs tnum">
                {inr(c.amount)}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Network availability (SCADA coverage)"
          filename={`availability-${p.period}.csv`}
          onExport={() =>
            csv(
              `availability-${p.period}.csv`,
              ["station", "name", "hours_with_data", "expected_hours", "pct"],
              p.availability.nodes.map((n) => [
                n.code,
                n.name,
                n.hoursWithData,
                n.expectedHours,
                n.pct.toFixed(2),
              ])
            )
          }
        >
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Station</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Hours</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Expected</th>
                  <th className="py-1.5 text-right font-medium">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.availability.nodes.map((n) => (
                  <tr key={n.nodeId}>
                    <td className="py-1.5 pr-3 font-mono">{n.code}</td>
                    <td className="py-1.5 pr-3 text-right font-mono tnum">
                      {n.hoursWithData}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono tnum">
                      {n.expectedHours}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 text-right font-mono tnum",
                        n.pct >= 99 ? "text-success" : n.pct >= 95 ? "text-warning" : "text-destructive"
                      )}
                    >
                      {n.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Alarm & work order statistics"
          filename={`alarm-wo-${p.period}.csv`}
          onExport={() => {
            csv(
              `alarm-wo-${p.period}.csv`,
              ["section", "key", "value"],
              [
                ["alarms", "total", p.alarmStats.total],
                ["alarms", "open", p.alarmStats.open],
                ["alarms", "acknowledged", p.alarmStats.acknowledged],
                ["alarms", "resolved", p.alarmStats.resolved],
                ["alarms", "critical", p.alarmStats.critical],
                ["alarms", "warning", p.alarmStats.warning],
                ["alarms", "info", p.alarmStats.info],
                ...p.alarmStats.topNodes.map((n) => ["alarms.top", n.code, n.count]),
                ["work_orders", "created", p.woStats.created],
                ["work_orders", "done", p.woStats.done],
                ["work_orders", "cancelled", p.woStats.cancelled],
                ["work_orders", "in_flight", p.woStats.inFlight],
                ...p.woStats.byPriority.map((w) => [
                  "work_orders.priority",
                  w.priority,
                  w.count,
                ]),
              ]
            );
          }}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-2 text-[11px] text-muted-foreground">Alarms</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  {p.alarmStats.critical} critical
                </Badge>
                <Badge variant="outline" className="border-warning/40 text-warning">
                  {p.alarmStats.warning} warning
                </Badge>
                <Badge variant="outline" className="border-info/40 text-info">
                  {p.alarmStats.info} info
                </Badge>
                <Badge variant="outline">{p.alarmStats.open} open</Badge>
              </div>
              <table className="mt-3 w-full text-xs">
                <tbody className="divide-y divide-border">
                  {p.alarmStats.topNodes.map((n) => (
                    <tr key={n.nodeId}>
                      <td className="py-1 font-mono">{n.code}</td>
                      <td className="py-1 text-right font-mono tnum">
                        {n.count} alarms
                      </td>
                    </tr>
                  ))}
                  {p.alarmStats.topNodes.length === 0 ? (
                    <tr>
                      <td className="py-2 text-muted-foreground">no alarms</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-[11px] text-muted-foreground">Work orders</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-1 text-muted-foreground">Raised</td>
                    <td className="py-1 text-right font-mono tnum">{p.woStats.created}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">In flight</td>
                    <td className="py-1 text-right font-mono tnum">{p.woStats.inFlight}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Done</td>
                    <td className="py-1 text-right font-mono tnum">{p.woStats.done}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-muted-foreground">Cancelled</td>
                    <td className="py-1 text-right font-mono tnum">{p.woStats.cancelled}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.woStats.byPriority.map((w) => (
                  <Badge key={w.priority} variant="secondary" className="text-[10px]">
                    {w.priority} · {w.count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
