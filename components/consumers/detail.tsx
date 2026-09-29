"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CATEGORY_LABELS,
  CONSUMER_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_TONE,
} from "@/lib/constants";
import { fmtDate, fmtInt, inr } from "@/lib/format";
import type { ConsumerDetail } from "@/lib/repo/consumers";
import type { ConsumerStatus } from "@/lib/schema";
import { cn } from "cn";

const STATUS_TONE: Record<ConsumerStatus, string> = {
  active: "border-success/40 text-success",
  pending: "border-warning/40 text-warning",
  disconnected: "border-border text-muted-foreground",
};

export function ConsumerDetail({ data }: { data: ConsumerDetail }) {
  const c = data.consumer;
  const latest = data.readings[data.readings.length - 1];
  const chart = data.readings.slice(-12).map((r) => ({
    period: r.period.slice(2),
    consumption: r.consumption,
    amount: r.amount,
    status: r.status,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {c.code}
              </Badge>
              <Badge variant="outline" className={cn(STATUS_TONE[c.status])}>
                {CONSUMER_STATUS_LABELS[c.status]}
              </Badge>
              <Badge variant="secondary">{CATEGORY_LABELS[c.category]}</Badge>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.address ?? "—"}
              {c.connectedOn ? ` · connected ${fmtDate(c.connectedOn)}` : ""}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              Feeder:{" "}
              {c.nodeId ? (
                <Link href={`/stations/${c.nodeId}`} className="font-mono text-primary hover:underline">
                  {c.nodeCode}
                </Link>
              ) : (
                "—"
              )}
            </p>
            <p className="mt-0.5">
              {data.lat.toFixed(5)}, {data.lng.toFixed(5)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tariff group</span>
              <span className="font-medium">{c.tariffGroup ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Approved load</span>
              <span className="font-medium">
                {c.approvedLoad != null ? `${fmtInt(c.approvedLoad)} sm³/h` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meter serial</span>
              <span className="font-mono font-medium">{c.meterSerial ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Feeder node</span>
              <span className="font-mono font-medium">{c.nodeCode ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest meter reading</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Period</span>
              <span className="font-medium">{latest?.period ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Index</span>
              <span className="font-mono font-medium tnum">
                {latest ? `${fmtInt(latest.openingIdx)} → ${fmtInt(latest.closingIdx)}` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consumption</span>
              <span className="font-mono font-medium tnum">
                {latest ? `${fmtInt(latest.consumption)} sm³` : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{latest ? inr(latest.amount) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {latest ? (
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", INVOICE_TONE[latest.status])}
                >
                  {INVOICE_STATUS_LABELS[latest.status]}
                </Badge>
              ) : (
                "—"
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span className="font-medium">{latest ? fmtDate(latest.dueOn) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium">{latest ? fmtDate(latest.paidOn) : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly consumption</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -8, right: 8, top: 6 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                  }
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(value, name, p) => {
                    const status = (p.payload as { status: string }).status;
                    return [
                      name === "consumption"
                        ? `${Number(value).toLocaleString("en-IN")} sm³`
                        : inr(Number(value)),
                      name === "consumption"
                        ? `Consumption (${status})`
                        : "Billed amount",
                    ];
                  }}
                />
                <Bar dataKey="consumption" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {chart.map((r) => (
                    <Cell
                      key={r.period}
                      fill={
                        r.status === "paid"
                          ? "var(--chart-1)"
                          : r.status === "overdue"
                            ? "var(--destructive)"
                            : "var(--chart-4)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3 rounded-sm bg-[var(--chart-1)]" /> paid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3 rounded-sm bg-[var(--chart-4)]" /> unpaid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3 rounded-sm bg-[var(--destructive)]" /> overdue
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 text-right font-medium">Consumption</th>
                <th className="py-2 pr-3 text-right font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Due</th>
                <th className="py-2 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...data.readings].reverse().map((r) => (
                <tr key={r.period}>
                  <td className="py-2 pr-3 font-mono">{r.period}</td>
                  <td className="py-2 pr-3 text-right font-mono tnum">
                    {fmtInt(r.consumption)} sm³
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tnum">
                    {inr(r.amount)}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", INVOICE_TONE[r.status])}
                    >
                      {INVOICE_STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmtDate(r.dueOn)}</td>
                  <td className="py-2 text-muted-foreground">{fmtDate(r.paidOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Separator className="mt-3" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {data.readings.length} billing periods on record
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
