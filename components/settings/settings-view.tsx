"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { CirclePlus, Loader2, RotateCcw, Save, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createUserAction,
  injectTestAlarmAction,
  resetPasswordAction,
  saveThresholdsAction,
  setSimulatorAction,
  updateUserAction,
} from "@/lib/actions/settings";
import { fmtDateTime, timeAgo } from "@/lib/format";
import type { SettingsPage, Thresholds } from "@/lib/repo/settings";
import type { Role } from "@/lib/schema";
import { cn } from "cn";

const ROLES: Role[] = ["admin", "operator", "viewer"];
const ZONES: { key: "primary" | "secondary" | "tertiary"; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "tertiary", label: "Tertiary" },
];

type UserDialog =
  | { mode: "create" }
  | { mode: "edit"; id: number; username: string }
  | null;

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function SettingsView({ initial }: { initial: SettingsPage }) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  const [userDialog, setUserDialog] = useState<UserDialog>(null);
  const [userForm, setUserForm] = useState({
    username: "",
    fullName: "",
    password: "",
    role: "viewer" as Role,
    active: true,
  });
  const [pwDialog, setPwDialog] = useState<{ id: number; username: string } | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");

  const [th, setTh] = useState<Thresholds>(initial.thresholds);
  const [simEnabled, setSimEnabled] = useState(initial.simulator.enabled);
  const [simInterval, setSimInterval] = useState(
    String(initial.simulator.intervalMs)
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/live/settings", { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as SettingsPage;
        setData(next);
        setTh(next.thresholds);
        setSimEnabled(next.simulator.enabled);
        setSimInterval(String(next.simulator.intervalMs));
      }
    } catch {
      /* transient */
    }
  }, []);

  const run = (fn: () => Promise<void>, ok: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
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

  const num = (v: string) => Number(v);
  const thDirty = JSON.stringify(th) !== JSON.stringify(data.thresholds);

  return (
    <div className="space-y-4">
      {/* ── users ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Users & roles</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setUserForm({
                username: "",
                fullName: "",
                password: "",
                role: "viewer",
                active: true,
              });
              setUserDialog({ mode: "create" });
            }}
            disabled={pending}
          >
            <CirclePlus className="size-4" /> New user
          </Button>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Username</th>
                <th className="py-2 pr-3 font-medium">Full name</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Created</th>
                <th className="py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-3 font-mono">{u.username}</td>
                  <td className="py-2 pr-3">{u.fullName}</td>
                  <td className="py-2 pr-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize",
                        u.role === "admin" &&
                          "border-destructive/40 text-destructive",
                        u.role === "operator" &&
                          "border-info/40 text-info"
                      )}
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    {u.active ? (
                      <span className="text-success">active</span>
                    ) : (
                      <span className="text-muted-foreground">inactive</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {fmtDateTime(u.createdAt)}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={pending}
                        onClick={() => {
                          setUserForm({
                            username: u.username,
                            fullName: u.fullName,
                            password: "",
                            role: u.role,
                            active: u.active,
                          });
                          setUserDialog({ mode: "edit", id: u.id, username: u.username });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={pending}
                        onClick={() => {
                          setNewPassword("");
                          setPwDialog({ id: u.id, username: u.username });
                        }}
                      >
                        <RotateCcw className="size-3" /> Password
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── thresholds ── */}
        <Card>
          <CardHeader>
            <CardTitle>Alarm thresholds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {ZONES.map((z) => (
                <div key={z.key} className="grid grid-cols-3 items-center gap-3">
                  <span className="text-sm">{z.label} zone</span>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      under (bar)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={th[z.key].under}
                      onChange={(e) =>
                        setTh({
                          ...th,
                          [z.key]: { ...th[z.key], under: num(e.target.value) },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      over (bar)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={th[z.key].over}
                      onChange={(e) =>
                        setTh({
                          ...th,
                          [z.key]: { ...th[z.key], over: num(e.target.value) },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 items-center gap-3">
                <span className="text-sm">High flow · CGS</span>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    threshold (sm³/h)
                  </Label>
                  <Input
                    type="number"
                    step="100"
                    value={th.high_flow_cgs}
                    onChange={(e) =>
                      setTh({ ...th, high_flow_cgs: num(e.target.value) })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                applied by the simulator on its next tick
              </span>
              <Button
                size="sm"
                disabled={pending || !thDirty}
                onClick={() =>
                  run(() => saveThresholdsAction(th), "Thresholds saved")
                }
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── simulator ── */}
        <Card>
          <CardHeader>
            <CardTitle>Telemetry simulator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Enabled</p>
                <p className="text-[11px] text-muted-foreground">
                  writes live telemetry and raises threshold alarms
                </p>
              </div>
              <Switch
                checked={simEnabled}
                onCheckedChange={(v) => {
                  setSimEnabled(v);
                  run(() => setSimulatorAction({ enabled: v }), v ? "Simulator enabled" : "Simulator paused");
                }}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  tick interval (1000–60000 ms)
                </Label>
                <Input
                  type="number"
                  min={1000}
                  max={60000}
                  step={500}
                  value={simInterval}
                  onChange={(e) => setSimInterval(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || Number(simInterval) === data.simulator.intervalMs}
                onClick={() =>
                  run(
                    () => setSimulatorAction({ intervalMs: Number(simInterval) }),
                    "Interval updated"
                  )
                }
              >
                Apply interval
              </Button>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Inject test alarm</p>
                  <p className="text-[11px] text-muted-foreground">
                    raises a critical HIGH_FLOW alarm on the first CGS — audited
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run(() => injectTestAlarmAction(), "Test alarm injected")
                  }
                >
                  <Zap className="size-4" /> Inject
                </Button>
              </div>
            </div>
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>
                status:{" "}
                <span className={simEnabled ? "text-success" : "text-warning"}>
                  {simEnabled ? "running" : "paused"}
                </span>
              </span>
              <span>interval: {data.simulator.intervalMs} ms</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── system ── */}
      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Licensee</span>
              <span className="font-medium">{data.company}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Database</span>
              <span className="truncate font-mono text-xs">
                {data.system.dbPath}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Size</span>
              <span className="font-mono">{fmtBytes(data.system.dbSizeBytes)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Migration</span>
              <span className="font-mono text-xs">
                {data.system.migrationTag ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">App</span>
              <span className="font-mono">{data.system.appVersion}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Next.js</span>
              <span className="font-mono">{data.system.nextVersion}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Node</span>
              <span className="font-mono">{data.system.nodeVersion}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {Object.entries(data.system.counts).map(([k, v]) => (
              <Badge key={k} variant="secondary" className="font-mono text-[10px]">
                {k}: {v.toLocaleString("en-IN")}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── audit ── */}
      <Card>
        <CardHeader>
          <CardTitle>Audit log (last {data.audit.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Who</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Entity</th>
                  <th className="py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.audit.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">
                      {fmtDateTime(a.ts)}{" "}
                      <span className="text-[10px]">({timeAgo(a.ts)})</span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono">
                      {a.username ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="font-mono text-[11px]">{a.action}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {a.entity}
                      {a.entityId ? `#${a.entityId}` : ""}
                    </td>
                    <td className="max-w-md truncate py-1.5 font-mono text-[10px] text-muted-foreground">
                      {a.details ? JSON.stringify(a.details) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── user dialog ── */}
      <Dialog
        open={userDialog !== null}
        onOpenChange={(o) => {
          if (!o) setUserDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userDialog?.mode === "create" ? "New user" : "Edit user"}
            </DialogTitle>
            <DialogDescription>
              Role changes take effect on the user&apos;s next request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {userDialog?.mode === "create" ? (
              <div className="space-y-1.5">
                <Label htmlFor="u-name">Username</Label>
                <Input
                  id="u-name"
                  value={userForm.username}
                  onChange={(e) =>
                    setUserForm({ ...userForm, username: e.target.value })
                  }
                  placeholder="e.g. rahul_k"
                  className="font-mono"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={userDialog?.mode === "edit" ? userDialog.username : ""} disabled className="font-mono" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="u-full">Full name</Label>
              <Input
                id="u-full"
                value={userForm.fullName}
                onChange={(e) =>
                  setUserForm({ ...userForm, fullName: e.target.value })
                }
              />
            </div>
            {userDialog?.mode === "create" ? (
              <div className="space-y-1.5">
                <Label htmlFor="u-pw">Password</Label>
                <Input
                  id="u-pw"
                  type="password"
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({ ...userForm, password: e.target.value })
                  }
                  placeholder="min 6 characters"
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(v) =>
                    setUserForm({ ...userForm, role: v as Role })
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={userForm.active}
                  onCheckedChange={(v) =>
                    setUserForm({ ...userForm, active: v })
                  }
                />
                <Label className="text-xs">active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setUserDialog(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                if (userDialog?.mode === "create") {
                  run(async () => {
                    await createUserAction({
                      username: userForm.username,
                      fullName: userForm.fullName,
                      password: userForm.password,
                      role: userForm.role,
                    });
                    setUserDialog(null);
                  }, "User created");
                } else if (userDialog?.mode === "edit") {
                  run(async () => {
                    await updateUserAction(userDialog.id, {
                      fullName: userForm.fullName,
                      role: userForm.role,
                      active: userForm.active,
                    });
                    setUserDialog(null);
                  }, "User updated");
                }
              }}
            >
              {userDialog?.mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── password dialog ── */}
      <Dialog
        open={pwDialog !== null}
        onOpenChange={(o) => {
          if (!o) setPwDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password · {pwDialog?.username}</DialogTitle>
            <DialogDescription>
              The user&apos;s sessions will be revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="min 6 characters"
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPwDialog(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                if (!pwDialog) return;
                run(async () => {
                  await resetPasswordAction(pwDialog.id, newPassword);
                  setPwDialog(null);
                }, "Password reset");
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
