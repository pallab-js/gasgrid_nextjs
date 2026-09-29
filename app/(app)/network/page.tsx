import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getNetwork } from "@/lib/repo/network";
import { NetworkView } from "@/components/network/network-view";

export const metadata: Metadata = { title: "Network graph" };

export default async function NetworkPage() {
  const user = await getCurrentUser();
  const data = getNetwork();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-2 px-5 pt-5 pb-3 lg:px-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Network graph
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.nodes.length} assets · {data.edges.length} pipeline segments ·
            click a node for live detail
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 px-5 pb-5 lg:px-6">
        <div className="relative h-full min-h-[480px] overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <NetworkView initial={data} role={user?.role ?? "viewer"} />
        </div>
      </div>
    </div>
  );
}
