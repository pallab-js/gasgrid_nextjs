"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createWorkOrderAction,
  updateWorkOrderAction,
  type WorkOrderInput,
} from "@/lib/actions/work-orders";
import {
  PRIORITY_LABELS,
  PRIORITY_TONE,
  WO_STATUS_LABELS,
  WO_TYPE_LABELS,
} from "@/lib/constants";
import { fmtDate, timeAgo } from "@/lib/format";
import {
  PRIORITIES,
  WO_TYPES,
  type Priority,
  type WoStatus,
  type WoType,
} from "@/lib/schema";
import type { WorkOrdersBoard, WoRow } from "@/lib/repo/work-orders";
import { TERMINAL_WO, WO_NEXT } from "@/lib/wo-status";
import { cn } from "cn";

const ACTIVE: WoStatus[] = ["open", "assigned", "in_progress", "blocked"];
const CLOSED: WoStatus[] = ["done", "cancelled"];

type FormState = {
  title: string;
  description: string;
  type: WoType;
  priority: Priority;
  nodeId: string;
  assignedTo: string;
  dueDate: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  type: "corrective",
  priority: "medium",
  nodeId: "none",
  assignedTo: "none",
  dueDate: "",
};

function toDateInput(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateInput(v: string): number | null {
  if (!v) return null;
  const d = new Date(`${v}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function WoCard({
  row,
  now,
  canAct,
  onEdit,
  onStatus,
}: {
  row: WoRow;
  now: number;
  canAct: boolean;
  onEdit: (r: WoRow) => void;
  onStatus: (r: WoRow, s: WoStatus) => void;
}) {
  const terminal = TERMINAL_WO.includes(row.status);
  const overdue = !terminal && row.dueOn != null && row.dueOn < now;
  const next = WO_NEXT[row.status];

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{row.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {row.code}
          </p>
        </div>
        {canAct ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 shrink-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
              {next.length ? (
                next.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    className="text-xs"
                    onClick={() => onStatus(row, s)}
                  >
                    {WO_STATUS_LABELS[s]}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem className="text-xs" disabled>
                  Terminal status
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={() => onEdit(row)}>
                <Pencil className="size-3" /> Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge
          variant="outline"
          className={cn("text-[10px]", PRIORITY_TONE[row.priority as Priority])}
        >
          {PRIORITY_LABELS[row.priority as Priority]}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {WO_TYPE_LABELS[row.type as WoType] ?? row.type}
        </Badge>
        {row.nodeId ? (
          <Link href={`/stations/${row.nodeId}`}>
            <Badge variant="outline" className="font-mono text-[10px] hover:border-primary">
              {row.nodeCode}
            </Badge>
          </Link>
        ) : null}
      </div>

      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <p>
          {row.assignee ? `→ ${row.assignee}` : "unassigned"}
          {row.createdBy ? ` · by ${row.createdBy}` : ""}
        </p>
        <p className={overdue ? "font-medium text-destructive" : undefined}>
          {row.dueOn
            ? `due ${fmtDate(row.dueOn)}${overdue ? " · overdue" : ""}`
            : "no due date"}
          {terminal && row.closedAt ? ` · closed ${timeAgo(row.closedAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

export function WorkOrderBoard({
  initial,
  role,
}: {
  initial: WorkOrdersBoard;
  role: "admin" | "operator" | "viewer";
}) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"all" | Priority>("all");
  const [assignee, setAssignee] = useState<"all" | "none" | string>("all");
  const [showClosed, setShowClosed] = useState(true);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const canAct = role !== "viewer";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/live/work-orders", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as WorkOrdersBoard);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (!q ||
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.nodeCode ?? "").toLowerCase().includes(q)) &&
        (priority === "all" || r.priority === priority) &&
        (assignee === "all" ||
          (assignee === "none" ? !r.assignee : r.assignee === assignee))
    );
  }, [data.rows, search, priority, assignee]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setDialog("create");
  };

  const openEdit = (r: WoRow) => {
    setForm({
      title: r.title,
      description: r.description ?? "",
      type: r.type as WoType,
      priority: r.priority as Priority,
      nodeId: r.nodeId != null ? String(r.nodeId) : "none",
      assignedTo: r.assignee ? String(
        data.users.find((u) => u.username === r.assignee)?.id ?? "none"
      ) : "none",
      dueDate: toDateInput(r.dueOn),
    });
    setEditId(r.id);
    setDialog("edit");
  };

  const submit = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const input: WorkOrderInput = {
      title: form.title,
      description: form.description,
      type: form.type,
      priority: form.priority,
      nodeId: form.nodeId === "none" ? null : Number(form.nodeId),
      assignedTo: form.assignedTo === "none" ? null : Number(form.assignedTo),
      dueOn: fromDateInput(form.dueDate),
    };
    startTransition(async () => {
      try {
        if (dialog === "create") {
          await createWorkOrderAction(input);
          toast.success("Work order created");
        } else if (editId != null) {
          await updateWorkOrderAction(editId, input);
          toast.success("Work order updated");
        }
        setDialog(null);
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

  const moveStatus = (r: WoRow, s: WoStatus) => {
    startTransition(async () => {
      try {
        await updateWorkOrderAction(r.id, {
          title: r.title,
          description: r.description ?? undefined,
          type: r.type as WoType,
          priority: r.priority as Priority,
          nodeId: r.nodeId,
          assignedTo: data.users.find((u) => u.username === r.assignee)?.id ?? null,
          dueOn: r.dueOn,
          status: s,
        });
        toast.success(`${r.code} → ${WO_STATUS_LABELS[s]}`);
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

  const now = data.ts;

  const renderColumn = (status: WoStatus) => {
    const rows = filtered.filter((r) => r.status === status);
    return (
      <div key={status} className="min-w-60 flex-1">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">
            {WO_STATUS_LABELS[status]}
          </span>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {rows.length}
          </Badge>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <WoCard
              key={r.id}
              row={r}
              now={now}
              canAct={canAct}
              onEdit={openEdit}
              onStatus={moveStatus}
            />
          ))}
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
              none
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, code or asset…"
          className="h-8 w-56 text-xs"
        />
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as "all" | Priority)}
        >
          <SelectTrigger size="sm" className="w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any priority</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger size="sm" className="w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any assignee</SelectItem>
            <SelectItem value="none">Unassigned</SelectItem>
            {data.users.map((u) => (
              <SelectItem key={u.id} value={u.username}>
                {u.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowClosed((v) => !v)}
        >
          {showClosed ? "Hide" : "Show"} closed
        </Button>

        <div className="ml-auto">
          {canAct ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> New work order
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" disabled>
                  <Plus className="size-4" /> New work order
                </Button>
              </TooltipTrigger>
              <TooltipContent>Operator role required</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {ACTIVE.map(renderColumn)}
        {showClosed ? (
          <div className="flex min-w-60 flex-1 flex-col gap-4 border-l border-border pl-4">
            {CLOSED.map(renderColumn)}
          </div>
        ) : null}
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create" ? "New work order" : "Edit work order"}
            </DialogTitle>
            <DialogDescription>
              Changes are audited. Only operator roles can modify work orders.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wo-title">Title</Label>
              <Input
                id="wo-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Regulator diaphragm replacement"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as WoType })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WO_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {WO_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm({ ...form, priority: v as Priority })
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Asset</Label>
                <Select
                  value={form.nodeId}
                  onValueChange={(v) => setForm({ ...form, nodeId: v })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {data.assets.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} · {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Select
                  value={form.assignedTo}
                  onValueChange={(v) => setForm({ ...form, assignedTo: v })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— unassigned —</SelectItem>
                    {data.users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username} · {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wo-due">Due date</Label>
              <Input
                id="wo-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wo-desc">Description</Label>
              <Textarea
                id="wo-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Scope of work, safety notes, materials…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {dialog === "create" ? "Create" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
