import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { consumers, nodes, readings } from "@/lib/schema";
import type {
  ConsumerCategory,
  ConsumerStatus,
  InvoiceStatus,
} from "@/lib/schema";

export type ConsumerRow = {
  id: number;
  code: string;
  name: string;
  category: ConsumerCategory;
  status: ConsumerStatus;
  nodeCode: string | null;
  nodeId: number | null;
  meterSerial: string | null;
  tariffGroup: string | null;
  approvedLoad: number | null;
  connectedOn: number | null;
  latestPeriod: string | null;
  latestConsumption: number | null;
  latestStatus: InvoiceStatus | null;
};

export type ConsumersRegister = {
  ts: number;
  rows: ConsumerRow[];
  counts: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    unpaid: number;
    overdue: number;
  };
};

export function getConsumersRegister(): ConsumersRegister {
  const db = getDb();

  const consRows = db
    .select({
      id: consumers.id,
      code: consumers.code,
      name: consumers.name,
      category: consumers.category,
      status: consumers.status,
      nodeCode: nodes.code,
      nodeId: consumers.nodeId,
      meterSerial: consumers.meterSerial,
      tariffGroup: consumers.tariffGroup,
      approvedLoad: consumers.approvedLoadSm3h,
      connectedOn: consumers.connectedOn,
    })
    .from(consumers)
    .leftJoin(nodes, eq(consumers.nodeId, nodes.id))
    .orderBy(asc(consumers.code))
    .all();

  /* latest reading per consumer (data set is small — compute in JS) */
  const allReadings = db
    .select({
      consumerId: readings.consumerId,
      period: readings.period,
      consumption: readings.consumptionSm3,
      status: readings.status,
    })
    .from(readings)
    .orderBy(asc(readings.period))
    .all();

  const latest = new Map<number, (typeof allReadings)[number]>();
  for (const r of allReadings) latest.set(r.consumerId, r);

  const rows: ConsumerRow[] = consRows.map((c) => {
    const l = latest.get(c.id);
    return {
      ...c,
      latestPeriod: l?.period ?? null,
      latestConsumption: l ? Math.round(l.consumption) : null,
      latestStatus: l?.status ?? null,
    };
  });

  const counts = {
    total: rows.length,
    byCategory: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    unpaid: 0,
    overdue: 0,
  };
  for (const r of rows) {
    counts.byCategory[r.category] = (counts.byCategory[r.category] ?? 0) + 1;
    counts.byStatus[r.status] = (counts.byStatus[r.status] ?? 0) + 1;
    if (r.latestStatus === "unpaid") counts.unpaid += 1;
    if (r.latestStatus === "overdue") counts.overdue += 1;
  }

  return { ts: Date.now(), rows, counts };
}

export type ConsumerDetail = {
  consumer: ConsumerRow;
  address: string | null;
  lat: number;
  lng: number;
  readings: {
    period: string;
    openingIdx: number;
    closingIdx: number;
    consumption: number;
    amount: number;
    status: InvoiceStatus;
    dueOn: number | null;
    paidOn: number | null;
  }[];
};

export function getConsumerDetail(id: number): ConsumerDetail | null {
  const db = getDb();
  const c = db
    .select({
      id: consumers.id,
      code: consumers.code,
      name: consumers.name,
      category: consumers.category,
      status: consumers.status,
      nodeCode: nodes.code,
      nodeId: consumers.nodeId,
      meterSerial: consumers.meterSerial,
      tariffGroup: consumers.tariffGroup,
      approvedLoad: consumers.approvedLoadSm3h,
      connectedOn: consumers.connectedOn,
      address: consumers.address,
      lat: consumers.lat,
      lng: consumers.lng,
    })
    .from(consumers)
    .leftJoin(nodes, eq(consumers.nodeId, nodes.id))
    .where(eq(consumers.id, id))
    .get();
  if (!c) return null;

  const rRows = db
    .select({
      period: readings.period,
      openingIdx: readings.openingIdx,
      closingIdx: readings.closingIdx,
      consumption: readings.consumptionSm3,
      amount: readings.amount,
      status: readings.status,
      dueOn: readings.dueOn,
      paidOn: readings.paidOn,
    })
    .from(readings)
    .where(eq(readings.consumerId, id))
    .orderBy(asc(readings.period))
    .all();

  const { address, lat, lng, ...rest } = c;
  const latest = rRows[rRows.length - 1];

  return {
    consumer: {
      ...rest,
      latestPeriod: latest?.period ?? null,
      latestConsumption: latest ? Math.round(latest.consumption) : null,
      latestStatus: latest?.status ?? null,
    },
    address,
    lat,
    lng,
    readings: rRows.map((r) => ({
      ...r,
      consumption: Math.round(r.consumption),
      amount: Math.round(r.amount),
    })),
  };
}
