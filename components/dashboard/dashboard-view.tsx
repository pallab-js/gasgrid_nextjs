"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Gauge,
  Siren,
  Wallet,
  Waves,
  Network as NetworkIcon,
} from "lucide-react";
import type { Overview } from "@/lib/repo/overview";
import { fmtInt, inr, pct } from "@/lib/format";
import { KpiCard } from "./kpi-card";
import {
  AlarmTrendChart,
  ConsumerDonut,
  DemandAreaChart,
  RevenueChart,
  ZoneFlowChart,
} from "./charts";
import { AlarmFeed } from "./alarm-feed";
import { StationTable } from "./station-table";

export function DashboardView({ initial }: { initial: Overview }) {
  const [data, setData] = useState<Overview>(initial);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/live/overview", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Overview;
        if (alive) setData(json);
      } catch {
        /* transient — next poll retries */
      }
    };
    const id = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const k = data.kpis;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Gas intake"
          value={`${fmtInt(k.intakeSm3h)}`}
          sub="sm³/h · 24 h ago"
          deltaPct={k.intakeDeltaPct}
          icon={Gauge}
        />
        <KpiCard
          label="Demand"
          value={`${fmtInt(k.demandSm3h)}`}
          sub="sm³/h · 24 h ago"
          deltaPct={k.demandDeltaPct}
          icon={Waves}
        />
        <KpiCard
          label="Availability"
          value={pct(k.availabilityPct)}
          sub={`${k.nodesDown} of ${k.nodesTotal} assets off-line`}
          tone={k.nodesDown === 0 ? "success" : "warning"}
          icon={NetworkIcon}
        />
        <KpiCard
          label="Pressure compliance"
          value={pct(k.compliancePct)}
          sub="stations within band"
          tone={k.compliancePct >= 95 ? "success" : "warning"}
          icon={Activity}
        />
        <KpiCard
          label="Open alarms"
          value={fmtInt(k.openAlarms)}
          sub={`${k.criticalAlarms} critical · ack or resolve`}
          tone={k.openAlarms === 0 ? "success" : k.criticalAlarms > 0 ? "danger" : "warning"}
          icon={Siren}
          href="/alarms"
        />
        <KpiCard
          label="Collections (MTD)"
          value={inr(k.collectionsMtd)}
          sub={`${pct(k.collectionPct)} of ${inr(k.billedMtd)} billed`}
          tone={k.collectionPct >= 70 ? "success" : "warning"}
          icon={Wallet}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <DemandAreaChart data={data.demand24} className="xl:col-span-2" />
        <ConsumerDonut data={data.consumerMix} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AlarmTrendChart data={data.alarmTrend} />
        <ZoneFlowChart data={data.zoneFlow} />
        <RevenueChart data={data.revenue} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AlarmFeed
          data={data.feed}
          openWorkOrders={k.openWorkOrders}
          className="xl:col-span-2"
        />
        <StationTable data={data.stations} />
      </section>

      <p className="pt-1 text-xs text-muted-foreground">
        Last updated {new Date(data.ts).toLocaleTimeString("en-IN", { hour12: false })} ·
        auto-refreshes every 6 s ·{" "}
        <Link href="/telemetry" className="hover:text-foreground hover:underline">
          Explore telemetry
        </Link>
      </p>
    </div>
  );
}
