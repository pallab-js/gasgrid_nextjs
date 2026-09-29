import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StationView } from "@/components/stations/station-view";
import { requireSession } from "@/lib/auth";
import { getStationPage } from "@/lib/repo/stations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Station" };

export default async function StationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const data = await getStationPage(id);
  if (!data) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={data.node.name}
        description={`${data.node.code} · ${data.node.kind}`}
      />
      <StationView data={data} role={session.role} />
    </PageContainer>
  );
}
