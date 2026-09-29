"use client";

import Link from "next/link";
import { cn } from "cn";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NODE_KIND_SHORT,
  NODE_STATUS_LABELS,
  ZONE_LABELS,
} from "@/lib/constants";
import { fmtDec, fmtInt, timeAgo } from "@/lib/format";
import type { Overview } from "@/lib/repo/overview";
import type { NodeStatus } from "@/lib/schema";

const STATUS_DOT: Record<NodeStatus, string> = {
  operational: "bg-success",
  maintenance: "bg-warning",
  isolated: "bg-muted-foreground/40",
  faulty: "bg-destructive",
  planned: "bg-info",
};

export function StationTable({
  data,
  className,
}: {
  data: Overview["stations"];
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>Station snapshot</CardTitle>
        <CardAction>
          <Link
            href="/stations"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Register
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="max-h-[320px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Station</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Pressure</TableHead>
                <TableHead className="text-right">Flow</TableHead>
                <TableHead>Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/stations/${s.id}`}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          STATUS_DOT[s.status]
                        )}
                        aria-hidden
                      />
                      <span className="font-mono text-xs">{s.code}</span>
                      <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
                        {NODE_KIND_SHORT[s.kind as keyof typeof NODE_KIND_SHORT] ?? s.kind}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ZONE_LABELS[s.zone]}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tnum">
                    {s.p != null ? `${fmtDec(s.p)} bar` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tnum">
                    {s.f != null ? fmtInt(s.f) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.ts != null ? timeAgo(s.ts) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function NodeStatusDot({ status }: { status: NodeStatus }) {
  return (
    <span
      className={cn("inline-block size-1.5 rounded-full", STATUS_DOT[status])}
      title={NODE_STATUS_LABELS[status]}
    />
  );
}
