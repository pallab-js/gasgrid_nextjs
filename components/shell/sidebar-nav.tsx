"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Flame } from "lucide-react";
import type { Role } from "@/lib/schema";
import { visibleNav } from "./nav";

export function SidebarNav({
  role,
  onNavigate,
  className,
}: {
  role: Role;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const groups = visibleNav(role);

  return (
    <nav className={cn("flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4", className)}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-sidebar-accent text-white font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white"
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute left-0 h-5 w-1 -translate-x-1/2 rounded-full bg-sidebar-primary"
                      />
                    ) : null}
                    <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Brand() {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Flame className="size-4" aria-hidden />
      </span>
      <span className="text-sm font-semibold tracking-tight text-white">
        GasNext
      </span>
      <span className="ml-auto rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        LOCAL
      </span>
    </div>
  );
}
