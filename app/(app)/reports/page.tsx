import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { ReportView } from "@/components/reports/report-view";
import { currentPeriod } from "@/lib/format";
import { availablePeriods, getReport } from "@/lib/repo/reports";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const periods = availablePeriods();
  const preferred = periods.includes(currentPeriod())
    ? currentPeriod()
    : (periods[0] ?? currentPeriod());
  const report = getReport(preferred);

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Monthly operations summary: energy balance, commercial performance, availability and event statistics"
      />
      <ReportView initial={report} />
    </PageContainer>
  );
}
