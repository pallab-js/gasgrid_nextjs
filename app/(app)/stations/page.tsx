import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StationsRegister } from "@/components/stations/register";
import { getStationsRegister } from "@/lib/repo/stations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Stations" };

export default async function StationsPage() {
  const register = await getStationsRegister();
  return (
    <PageContainer>
      <PageHeader
        title="Stations"
        description={`${register.rows.length} monitored assets across primary, secondary and tertiary networks`}
      />
      <StationsRegister initial={register} />
    </PageContainer>
  );
}
