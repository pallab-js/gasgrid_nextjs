import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import {
  TelemetryExplorer,
  type ExplorerNode,
} from "@/components/telemetry/explorer";
import { getDb } from "@/lib/db";
import { nodes } from "@/lib/schema";
import { getTelemetrySeries } from "@/lib/repo/telemetry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Telemetry" };

export default async function TelemetryPage() {
  const db = getDb();
  const all: ExplorerNode[] = db
    .select({
      id: nodes.id,
      code: nodes.code,
      name: nodes.name,
      kind: nodes.kind,
    })
    .from(nodes)
    .orderBy(sql`case when ${nodes.kind} = 'CGS' then 0 else 1 end`, nodes.code)
    .all();

  const preferred = all.filter((n) => n.kind === "CGS").slice(0, 2);
  const defaultIds = (preferred.length ? preferred : all.slice(0, 2)).map(
    (n) => n.id
  );
  const initial = getTelemetrySeries(defaultIds, "p", "24h");

  return (
    <PageContainer>
      <PageHeader
        title="Telemetry explorer"
        description="Pressure, flow and temperature across assets over 1 hour to 30 days"
      />
      <TelemetryExplorer nodes={all} initial={initial} />
    </PageContainer>
  );
}
