import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { WorkOrderBoard } from "@/components/work-orders/board";
import { requireSession } from "@/lib/auth";
import { getWorkOrdersBoard } from "@/lib/repo/work-orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Work orders" };

export default async function WorkOrdersPage() {
  const [session, board] = await Promise.all([
    requireSession(),
    getWorkOrdersBoard(),
  ]);
  return (
    <PageContainer>
      <PageHeader
        title="Work orders"
        description="Plan, assign and track field work across the network"
      />
      <WorkOrderBoard initial={board} role={session.role} />
    </PageContainer>
  );
}
