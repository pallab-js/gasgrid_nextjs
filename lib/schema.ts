import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ─────────────────────────── enums ─────────────────────────── */

export const ROLES = ["admin", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const NODE_KINDS = [
  "CGS",
  "DPRS",
  "IPRS",
  "CNG",
  "MRS",
  "VALVE",
  "JUNCTION",
  "ODORISER",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const ZONES = ["primary", "secondary", "tertiary"] as const;
export type Zone = (typeof ZONES)[number];

export const NODE_STATUSES = [
  "operational",
  "maintenance",
  "isolated",
  "faulty",
  "planned",
] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const CONSUMER_CATEGORIES = [
  "DOMESTIC",
  "COMMERCIAL",
  "INDUSTRIAL",
  "CNG",
  "INSTITUTIONAL",
] as const;
export type ConsumerCategory = (typeof CONSUMER_CATEGORIES)[number];

export const CONSUMER_STATUSES = ["active", "pending", "disconnected"] as const;
export type ConsumerStatus = (typeof CONSUMER_STATUSES)[number];

export const INVOICE_STATUSES = ["unpaid", "paid", "overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const ALARM_TYPES = [
  "OVER_PRESSURE",
  "UNDER_PRESSURE",
  "LEAK_SUSPECTED",
  "COMM_LOSS",
  "VALVE_ANOMALY",
  "HIGH_FLOW",
  "LOW_FLOW",
] as const;
export type AlarmType = (typeof ALARM_TYPES)[number];

export const SEVERITIES = ["info", "warning", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ALARM_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type AlarmStatus = (typeof ALARM_STATUSES)[number];

export const WO_TYPES = [
  "preventive",
  "corrective",
  "inspection",
  "leak_repair",
  "construction",
] as const;
export type WoType = (typeof WO_TYPES)[number];

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const WO_STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;
export type WoStatus = (typeof WO_STATUSES)[number];

export const MATERIALS = ["steel", "PE", "MDPE", "GI", "copper"] as const;
export type Material = (typeof MATERIALS)[number];

export const VALVE_TYPES = [
  "slam_shut",
  "sectionalising",
  "isolation",
  "prv",
] as const;
export type ValveType = (typeof VALVE_TYPES)[number];

export const VALVE_STATES = ["open", "closed", "throttled"] as const;
export type ValveState = (typeof VALVE_STATES)[number];

/* ─────────────────────────── types ─────────────────────────── */

export type NodeMeta = {
  inlet?: number;
  outlet?: number;
  notes?: string;
  manufacturer?: string;
  serial?: string;
};

export type SegmentShape = {
  map: [number, number][];
  graph: [number, number][];
};

/* ─────────────────────────── tables ─────────────────────────── */

/** Epoch milliseconds (plain integer — keep values as numbers everywhere). */
const ts = (name: string) => integer(name);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ROLES }).notNull().default("viewer"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [uniqueIndex("users_username_uq").on(t.username)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull(),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts: ts("ts").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [index("audit_ts_idx").on(t.ts)]
);

export const nodes = sqliteTable(
  "nodes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: NODE_KINDS }).notNull(),
    zone: text("zone", { enum: ZONES }).notNull(),
    status: text("status", { enum: NODE_STATUSES }).notNull().default("operational"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    gx: real("gx").notNull(),
    gy: real("gy").notNull(),
    address: text("address"),
    commissionedOn: ts("commissioned_on"),
    notes: text("notes"),
    meta: text("meta", { mode: "json" }).$type<NodeMeta>().default(sql`'{}'`),
  },
  (t) => [uniqueIndex("nodes_code_uq").on(t.code)]
);

export const stationDetail = sqliteTable(
  "station_detail",
  {
    nodeId: integer("node_id")
      .primaryKey()
      .references(() => nodes.id, { onDelete: "cascade" }),
    capacityMmscfd: real("capacity_mmscfd"),
    inletSetBar: real("inlet_set_bar"),
    outletSetBar: real("outlet_set_bar"),
    monitorRegulator: integer("monitor_regulator", { mode: "boolean" }).default(false),
    slamShut: integer("slam_shut", { mode: "boolean" }).default(false),
    odorizer: integer("odorizer", { mode: "boolean" }).default(false),
    scadaRtu: integer("scada_rtu", { mode: "boolean" }).default(false),
    lastInspectionOn: ts("last_inspection_on"),
  },
  (t) => [index("station_detail_node_idx").on(t.nodeId)]
);

export const segments = sqliteTable(
  "segments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name"),
    fromNode: integer("from_node")
      .notNull()
      .references(() => nodes.id),
    toNode: integer("to_node")
      .notNull()
      .references(() => nodes.id),
    zone: text("zone", { enum: ZONES }).notNull(),
    material: text("material", { enum: MATERIALS }).notNull(),
    diameterMm: real("diameter_mm").notNull(),
    lengthM: real("length_m").notNull(),
    maopBar: real("maop_bar").notNull(),
    laidOn: ts("laid_on"),
    status: text("status", { enum: NODE_STATUSES }).notNull().default("operational"),
    routeName: text("route_name"),
    shape: text("shape", { mode: "json" }).$type<SegmentShape>(),
  },
  (t) => [uniqueIndex("segments_code_uq").on(t.code)]
);

export const valves = sqliteTable(
  "valves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    nodeId: integer("node_id")
      .notNull()
      .unique()
      .references(() => nodes.id, { onDelete: "cascade" }),
    segmentId: integer("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: VALVE_TYPES }).notNull().default("isolation"),
    state: text("state", { enum: VALVE_STATES }).notNull().default("open"),
    lastExercisedOn: ts("last_exercised_on"),
  },
  (t) => [uniqueIndex("valves_code_uq").on(t.code)]
);

export const consumers = sqliteTable(
  "consumers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category", { enum: CONSUMER_CATEGORIES }).notNull(),
    status: text("status", { enum: CONSUMER_STATUSES }).notNull().default("active"),
    nodeId: integer("node_id").references(() => nodes.id, { onDelete: "set null" }),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    address: text("address"),
    connectedOn: ts("connected_on"),
    approvedLoadSm3h: real("approved_load_sm3h"),
    meterSerial: text("meter_serial"),
    tariffGroup: text("tariff_group"),
  },
  (t) => [
    uniqueIndex("consumers_code_uq").on(t.code),
    index("consumers_category_idx").on(t.category),
    index("consumers_node_idx").on(t.nodeId),
  ]
);

export const readings = sqliteTable(
  "readings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    consumerId: integer("consumer_id")
      .notNull()
      .references(() => consumers.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    openingIdx: real("opening_idx").notNull(),
    closingIdx: real("closing_idx").notNull(),
    consumptionSm3: real("consumption_sm3").notNull(),
    amount: real("amount").notNull(),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("unpaid"),
    dueOn: ts("due_on"),
    paidOn: ts("paid_on"),
  },
  (t) => [
    uniqueIndex("readings_consumer_period_uq").on(t.consumerId, t.period),
    index("readings_period_idx").on(t.period),
  ]
);

export const telemetry = sqliteTable(
  "telemetry",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nodeId: integer("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    ts: ts("ts").notNull(),
    pressureBar: real("pressure_bar").notNull(),
    flowSm3h: real("flow_sm3h").notNull(),
    tempC: real("temp_c").notNull(),
  },
  (t) => [index("telemetry_node_ts_idx").on(t.nodeId, t.ts)]
);

export const telemetryHourly = sqliteTable(
  "telemetry_hourly",
  {
    nodeId: integer("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    hourTs: ts("hour_ts").notNull(),
    pAvg: real("p_avg").notNull(),
    pMax: real("p_max").notNull(),
    pMin: real("p_min").notNull(),
    fAvg: real("f_avg").notNull(),
    fMax: real("f_max").notNull(),
    samples: integer("samples").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.nodeId, t.hourTs] }),
    index("hourly_node_ts_idx").on(t.nodeId, t.hourTs),
  ]
);

export const alarms = sqliteTable(
  "alarms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nodeId: integer("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    ts: ts("ts").notNull(),
    type: text("type", { enum: ALARM_TYPES }).notNull(),
    severity: text("severity", { enum: SEVERITIES }).notNull(),
    message: text("message").notNull(),
    value: real("value"),
    threshold: real("threshold"),
    status: text("status", { enum: ALARM_STATUSES }).notNull().default("open"),
    ackBy: integer("ack_by").references(() => users.id, { onDelete: "set null" }),
    ackAt: ts("ack_at"),
    resolvedAt: ts("resolved_at"),
    note: text("note"),
  },
  (t) => [
    index("alarms_status_ts_idx").on(t.status, t.ts),
    index("alarms_node_ts_idx").on(t.nodeId, t.ts),
  ]
);

export const workOrders = sqliteTable(
  "work_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type", { enum: WO_TYPES }).notNull().default("corrective"),
    priority: text("priority", { enum: PRIORITIES }).notNull().default("medium"),
    status: text("status", { enum: WO_STATUSES }).notNull().default("open"),
    nodeId: integer("node_id").references(() => nodes.id, { onDelete: "set null" }),
    segmentId: integer("segment_id").references(() => segments.id, {
      onDelete: "set null",
    }),
    assignedTo: integer("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    dueOn: ts("due_on"),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: ts("created_at").notNull(),
    closedAt: ts("closed_at"),
  },
  (t) => [
    uniqueIndex("work_orders_code_uq").on(t.code),
    index("work_orders_status_idx").on(t.status),
  ]
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
});

/* ─────────────────────────── relations ─────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  stationDetail: one(stationDetail),
  alarms: many(alarms),
  consumers: many(consumers),
}));

export const stationDetailRelations = relations(stationDetail, ({ one }) => ({
  node: one(nodes, {
    fields: [stationDetail.nodeId],
    references: [nodes.id],
  }),
}));

export const consumersRelations = relations(consumers, ({ one, many }) => ({
  node: one(nodes, { fields: [consumers.nodeId], references: [nodes.id] }),
  readings: many(readings),
}));

export const readingsRelations = relations(readings, ({ one }) => ({
  consumer: one(consumers, {
    fields: [readings.consumerId],
    references: [consumers.id],
  }),
}));

export const alarmsRelations = relations(alarms, ({ one }) => ({
  node: one(nodes, { fields: [alarms.nodeId], references: [nodes.id] }),
  ackUser: one(users, { fields: [alarms.ackBy], references: [users.id] }),
}));

export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  node: one(nodes, { fields: [workOrders.nodeId], references: [nodes.id] }),
  assignee: one(users, { fields: [workOrders.assignedTo], references: [users.id] }),
}));

export const segmentsRelations = relations(segments, ({ one }) => ({
  from: one(nodes, { fields: [segments.fromNode], references: [nodes.id] }),
  to: one(nodes, { fields: [segments.toNode], references: [nodes.id] }),
}));

/* ─────────────────────────── inferred types ─────────────────────────── */

export type User = typeof users.$inferSelect;
export type NodeRow = typeof nodes.$inferSelect;
export type StationDetail = typeof stationDetail.$inferSelect;
export type SegmentRow = typeof segments.$inferSelect;
export type ValveRow = typeof valves.$inferSelect;
export type ConsumerRow = typeof consumers.$inferSelect;
export type ReadingRow = typeof readings.$inferSelect;
export type TelemetryRow = typeof telemetry.$inferSelect;
export type AlarmRow = typeof alarms.$inferSelect;
export type WorkOrderRow = typeof workOrders.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
