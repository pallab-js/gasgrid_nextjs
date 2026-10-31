import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getNetwork } from "@/lib/repo/network";
import { NetworkView } from "@/components/network/network-view";
import { PageContainer, PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Network graph" };

export default async function NetworkPage() {
  const user = await getCurrentUser();
  const data = getNetwork();

  return (
    <PageContainer>
      <PageHeader
        title="Network graph"
        description={`${data.nodes.length} assets · ${data.edges.length} pipeline segments · click a node for live detail`}
      />
      <div className="mt-4 min-h-0 flex-1">
        <div className="relative h-full min-h-[480px] overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <NetworkView initial={data} role={user?.role ?? "viewer"} />
        </div>
      </div>
    </PageContainer>
  );
}
