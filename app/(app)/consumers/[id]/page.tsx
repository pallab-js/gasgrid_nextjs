import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { ConsumerDetail } from "@/components/consumers/detail";
import { getConsumerDetail } from "@/lib/repo/consumers";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) return { title: "Consumer" };
  const data = getConsumerDetail(id);
  if (!data) return { title: "Consumer" };
  return { title: data.consumer.name };
}

export default async function ConsumerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const data = getConsumerDetail(id);
  if (!data) notFound();

  return (
    <PageContainer>
      <PageHeader
        title={data.consumer.name}
        description={`${data.consumer.code} · ${data.consumer.category}`}
      />
      <ConsumerDetail data={data} />
    </PageContainer>
  );
}
