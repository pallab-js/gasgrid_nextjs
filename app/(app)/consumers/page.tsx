import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { ConsumersRegister } from "@/components/consumers/register";
import { getConsumersRegister } from "@/lib/repo/consumers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Consumers" };

export default async function ConsumersPage() {
  const register = getConsumersRegister();
  return (
    <PageContainer>
      <PageHeader
        title="Consumers"
        description="Connection register by category, meter readings and billing status"
      />
      <ConsumersRegister initial={register} />
    </PageContainer>
  );
}
