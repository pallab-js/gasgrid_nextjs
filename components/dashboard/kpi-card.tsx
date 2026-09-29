"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";

const TONES = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
} as const;

export function KpiCard({
  label,
  value,
  sub,
  deltaPct,
  deltaLabel = "vs yesterday",
  tone = "default",
  icon: Icon,
  href,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  deltaPct?: number | null;
  deltaLabel?: string;
  tone?: keyof typeof TONES;
  icon: LucideIcon;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-muted-foreground">{label}</span>
          <Icon className="size-4 text-muted-foreground/60" aria-hidden />
        </div>
        <div
          className={cn(
            "font-heading text-2xl leading-none font-semibold tracking-tight tnum",
            TONES[tone]
          )}
        >
          {value}
        </div>
        <div className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
          {typeof deltaPct === "number" ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-4xl px-1.5 py-0.5 font-medium tnum",
                deltaPct >= 0
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {deltaPct >= 0 ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {Math.abs(deltaPct).toFixed(1)}%
            </span>
          ) : null}
          {sub ?? (typeof deltaPct === "number" ? deltaLabel : null)}
        </div>
      </CardContent>
    </>
  );

  if (href) {
    return (
      <Card className={cn("transition-colors hover:ring-primary/40", className)}>
        <Link href={href} className="block focus-visible:outline-none">
          {body}
        </Link>
      </Card>
    );
  }
  return <Card className={className}>{body}</Card>;
}
