import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getMapData } from "@/lib/repo/mapdata";
import { SchematicMap } from "@/components/map/schematic-map";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage() {
  const user = await getCurrentUser();
  const data = getMapData();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-2 px-5 pt-5 pb-3 lg:px-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Map</h1>
          <p className="text-sm text-muted-foreground">
            {data.nodes.length} assets · {data.consumers.length} active
            consumers · schematic basemap (offline)
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 px-5 pb-5 lg:px-6">
        <div className="relative isolate h-full min-h-[480px] overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <SchematicMap initial={data} role={user?.role ?? "viewer"} />
        </div>
      </div>
    </div>
  );
}
