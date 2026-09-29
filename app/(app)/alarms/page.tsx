import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { AlarmsConsole } from "@/components/alarms/console";
import { requireSession } from "@/lib/auth";
import { getAlarmsPage } from "@/lib/repo/alarms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Alarms" };

const STATUSES = ["open", "acknowledged", "resolved"] as const;

export default async function AlarmsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [session, sp] = await Promise.all([requireSession(), searchParams]);
  const initialStatus = STATUSES.includes(
    sp.status as (typeof STATUSES)[number]
  )
    ? (sp.status as (typeof STATUSES)[number])
    : "open";
  const data = getAlarmsPage();

  return (
    <PageContainer>
      <PageHeader
        title="Alarms"
        description="Acknowledge, resolve and audit network events across every monitored asset"
      />
      <AlarmsConsole
        initial={data}
        role={session.role}
        initialStatus={initialStatus}
      />
    </PageContainer>
  );
}
