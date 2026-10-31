import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getMapData } from "@/lib/repo/mapdata";
import { SchematicMap } from "@/components/map/schematic-map";
import { PageContainer, PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage() {
  const user = await getCurrentUser();
  const data = getMapData();

  return (
    <PageContainer>
      <PageHeader
        title="Map"
        description={`${data.nodes.length} assets · ${data.consumers.length} active consumers · schematic basemap (offline)`}
      />
      <div className="mt-4 min-h-0 flex-1">
        <div className="relative isolate h-full min-h-[480px] overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <SchematicMap initial={data} role={user?.role ?? "viewer"} />
        </div>
      </div>
    </PageContainer>
  );
}
