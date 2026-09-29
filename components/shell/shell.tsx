"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { Role } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Clock } from "./clock";
import { LivePill } from "./live-pill";
import { Brand, SidebarNav } from "./sidebar-nav";
import { titleForPath } from "./nav";
import { UserMenu } from "./user-menu";

export type ShellUser = {
  id: number;
  name: string;
  username: string;
  role: Role;
};

export function Shell({
  user,
  company,
  children,
}: {
  user: ShellUser;
  company: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <SidebarNav role={user.role} />
        <div className="border-t border-sidebar-border px-5 py-3">
          <p className="truncate text-[11px] text-muted-foreground" title={company}>
            {company}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/40 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <h2 className="truncate text-sm font-medium text-muted-foreground">
            {title}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <LivePill />
            <Clock />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <SidebarNav
            role={user.role}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
