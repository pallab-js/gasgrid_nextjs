"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  CATEGORY_LABELS,
  CONSUMER_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_TONE,
} from "@/lib/constants";
import { fmtDate, fmtInt } from "@/lib/format";
import type { ConsumersRegister } from "@/lib/repo/consumers";
import type {
  ConsumerCategory,
  ConsumerStatus,
  InvoiceStatus,
} from "@/lib/schema";
import { cn } from "cn";

const PAGE_SIZE = 25;

const STATUS_TONE: Record<ConsumerStatus, string> = {
  active: "border-success/40 text-success",
  pending: "border-warning/40 text-warning",
  disconnected: "border-border text-muted-foreground",
};

export function ConsumersRegister({ initial }: { initial: ConsumersRegister }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ConsumerCategory>("all");
  const [status, setStatus] = useState<"all" | ConsumerStatus>("all");
  const [invoice, setInvoice] = useState<"all" | InvoiceStatus>("all");
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initial.rows.filter(
      (r) =>
        (!q ||
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          (r.meterSerial ?? "").toLowerCase().includes(q)) &&
        (category === "all" || r.category === category) &&
        (status === "all" || r.status === status) &&
        (invoice === "all" || r.latestStatus === invoice)
    );
  }, [initial.rows, query, category, status, invoice]);

  const pages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const slice = view.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE);

  const reset = () => setPage(0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="py-3">
          <CardContent className="flex items-center justify-between px-4">
            <span className="text-xs text-muted-foreground">Consumers</span>
            <span className="font-mono text-xl font-semibold tnum">
              {initial.counts.total}
            </span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center justify-between px-4">
            <span className="text-xs text-muted-foreground">Active</span>
            <span className="font-mono text-xl font-semibold tnum text-success">
              {initial.counts.byStatus.active ?? 0}
            </span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center justify-between px-4">
            <span className="text-xs text-muted-foreground">Unpaid (latest)</span>
            <span className="font-mono text-xl font-semibold tnum text-info">
              {initial.counts.unpaid}
            </span>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center justify-between px-4">
            <span className="text-xs text-muted-foreground">Overdue (latest)</span>
            <span className="font-mono text-xl font-semibold tnum text-destructive">
              {initial.counts.overdue}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  reset();
                }}
                placeholder="Search name, code or meter…"
                className="h-8 w-60 pl-8 text-xs"
              />
            </div>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v as "all" | ConsumerCategory);
                reset();
              }}
            >
              <SelectTrigger size="sm" className="w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any category</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as ConsumerCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as "all" | ConsumerStatus);
                reset();
              }}
            >
              <SelectTrigger size="sm" className="w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {(Object.keys(CONSUMER_STATUS_LABELS) as ConsumerStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {CONSUMER_STATUS_LABELS[s]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <Select
              value={invoice}
              onValueChange={(v) => {
                setInvoice(v as "all" | InvoiceStatus);
                reset();
              }}
            >
              <SelectTrigger size="sm" className="w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any billing</SelectItem>
                <SelectItem value="paid">Paid (latest)</SelectItem>
                <SelectItem value="unpaid">Unpaid (latest)</SelectItem>
                <SelectItem value="overdue">Overdue (latest)</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              {view.length} of {initial.rows.length}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consumer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Feeder</TableHead>
                <TableHead>Meter</TableHead>
                <TableHead className="text-right">Latest reading</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Connected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/consumers/${r.id}`}
                      className="block hover:text-primary"
                    >
                      <span className="font-mono text-xs font-medium">{r.code}</span>
                      <span className="block max-w-52 truncate text-[11px] text-muted-foreground">
                        {r.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {CATEGORY_LABELS[r.category]}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", STATUS_TONE[r.status])}
                    >
                      {CONSUMER_STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.nodeId ? (
                      <Link
                        href={`/stations/${r.nodeId}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {r.nodeCode}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.meterSerial ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <span className="font-mono tnum">
                      {r.latestPeriod ?? "—"}
                    </span>
                    <span className="block font-mono text-[11px] text-muted-foreground tnum">
                      {r.latestConsumption != null
                        ? `${fmtInt(r.latestConsumption)} sm³`
                        : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.latestStatus ? (
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", INVOICE_TONE[r.latestStatus])}
                      >
                        {INVOICE_STATUS_LABELS[r.latestStatus]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDate(r.connectedOn)}
                  </TableCell>
                </TableRow>
              ))}
              {slice.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No consumers match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-3">
            <span className="text-xs text-muted-foreground">
              page {cur + 1} of {pages}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={cur === 0}
                onClick={() => setPage(cur - 1)}
              >
                <ChevronLeft className="size-3" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={cur >= pages - 1}
                onClick={() => setPage(cur + 1)}
              >
                Next <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
