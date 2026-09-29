import {
  Activity,
  BarChart3,
  BellRing,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Map as MapIcon,
  Settings,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/schema";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: Role;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/network", label: "Network graph", icon: Share2 },
      { href: "/map", label: "Map", icon: MapIcon },
      { href: "/telemetry", label: "Telemetry", icon: Activity },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/alarms", label: "Alarms", icon: BellRing },
      { href: "/work-orders", label: "Work orders", icon: ClipboardList },
      { href: "/stations", label: "Stations", icon: Building2 },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/consumers", label: "Consumers", icon: Users },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings, minRole: "admin" }],
  },
];

export function visibleNav(role: Role): NavGroup[] {
  const rank = { viewer: 0, operator: 1, admin: 2 } as const;
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.minRole || rank[role] >= rank[i.minRole]),
  })).filter((g) => g.items.length > 0);
}

export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Overview";
  const items = NAV.flatMap((g) => g.items).sort(
    (a, b) => b.href.length - a.href.length
  );
  const match = items.find(
    (i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(i.href + "/"))
  );
  if (match) {
    if (pathname !== match.href) return match.label.replace(/s$/, "");
    return match.label;
  }
  return "GasNext";
}
