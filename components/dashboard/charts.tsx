"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { Overview } from "@/lib/repo/overview";
import { periodLabel } from "@/lib/format";

function ChartCard({
  title,
  className,
  children,
  action,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const hourLabel = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export function DemandAreaChart({
  data,
  className,
}: {
  data: Overview["demand24"];
  className?: string;
}) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        time: hourLabel(d.ts),
        intake: d.intake,
        demand: d.demand,
      })),
    [data]
  );
  const config = {
    intake: { label: "Intake", color: "var(--chart-1)" },
    demand: { label: "Demand", color: "var(--chart-3)" },
  } satisfies ChartConfig;

  return (
    <ChartCard title="24-hour gas profile" className={className}>
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <AreaChart data={chartData} margin={{ left: -14, right: 6, top: 6 }}>
          <defs>
            <linearGradient id="fillIntake" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-intake)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-intake)" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="fillDemand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-demand)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-demand)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={28}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
            }
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="intake"
            type="monotone"
            fill="url(#fillIntake)"
            stroke="var(--color-intake)"
            strokeWidth={2}
            dot={false}
          />
          <Area
            dataKey="demand"
            type="monotone"
            fill="url(#fillDemand)"
            stroke="var(--color-demand)"
            strokeWidth={2}
            dot={false}
          />
          <Legend content={<ChartLegendContent />} verticalAlign="top" align="right" />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function ConsumerDonut({
  data,
  className,
}: {
  data: Overview["consumerMix"];
  className?: string;
}) {
  const chartData = data.map((d) => ({ name: d.category, value: d.count }));
  const config = {
    DOMESTIC: { label: "Domestic", color: "var(--chart-1)" },
    COMMERCIAL: { label: "Commercial", color: "var(--chart-3)" },
    INDUSTRIAL: { label: "Industrial", color: "var(--chart-5)" },
    CNG: { label: "CNG", color: "var(--chart-4)" },
    INSTITUTIONAL: { label: "Institutional", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartCard title="Active consumers" className={className}>
      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={`var(--color-${entry.name})`} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend content={<ChartLegendContent />} />
        </PieChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function AlarmTrendChart({
  data,
  className,
}: {
  data: Overview["alarmTrend"];
  className?: string;
}) {
  const chartData = data.map((d) => ({
    day: new Date(d.day).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
    critical: d.critical,
    warning: d.warning,
    info: d.info,
  }));
  const config = {
    critical: { label: "Critical", color: "var(--destructive)" },
    warning: { label: "Warning", color: "var(--chart-5)" },
    info: { label: "Info", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  return (
    <ChartCard title="Alarms — last 14 days" className={className}>
      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <BarChart data={chartData} margin={{ left: -18, right: 6, top: 6 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="critical" stackId="a" fill="var(--color-critical)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="warning" stackId="a" fill="var(--color-warning)" />
          <Bar dataKey="info" stackId="a" fill="var(--color-info)" radius={[3, 3, 0, 0]} />
          <Legend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

const ZONE_NAMES: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
};

export function ZoneFlowChart({
  data,
  className,
}: {
  data: Overview["zoneFlow"];
  className?: string;
}) {
  const chartData = data.map((d) => ({
    zone: ZONE_NAMES[d.zone] ?? d.zone,
    flow: d.flow,
  }));
  const config = {
    flow: { label: "Flow (sm³/h)", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartCard title="Flow by network zone" className={className}>
      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 12, top: 6 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
            }
          />
          <YAxis
            type="category"
            dataKey="zone"
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="flow" fill="var(--color-flow)" radius={[0, 4, 4, 0]} barSize={22} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function RevenueChart({
  data,
  className,
}: {
  data: Overview["revenue"];
  className?: string;
}) {
  const chartData = data.map((d) => ({
    period: periodLabel(d.period),
    billed: d.billed,
    collected: d.collected,
  }));
  const config = {
    billed: { label: "Billed", color: "var(--chart-4)" },
    collected: { label: "Collected", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartCard title="Billing vs collection" className={className}>
      <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
        <BarChart data={chartData} margin={{ left: 4, right: 6, top: 6 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) =>
              v >= 100_000 ? `₹${(v / 100_000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}k`
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => [
                  `₹${Number(value).toLocaleString("en-IN")}`,
                  name === "billed" ? "Billed" : "Collected",
                ]}
              />
            }
          />
          <Legend content={<ChartLegendContent />} />
          <Bar dataKey="billed" fill="var(--color-billed)" radius={[4, 4, 0, 0]} barSize={18} />
          <Bar dataKey="collected" fill="var(--color-collected)" radius={[4, 4, 0, 0]} barSize={18} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
