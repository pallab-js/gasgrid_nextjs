import { getOverview } from "@/lib/repo/overview";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function OverviewPage() {
  const data = getOverview();

  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        description="Network-wide live status and analytics"
      />
      <div className="mt-5">
        <DashboardView initial={data} />
      </div>
    </PageContainer>
  );
}
