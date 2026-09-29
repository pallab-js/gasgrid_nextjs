/**
 * Deterministic demo seed for GasNext — "Aurum Gas Grid", Nashik licence area.
 * Runs only when the `nodes` table is empty (idempotent).
 */
import { sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  alarms,
  auditLog,
  consumers,
  nodes,
  readings,
  segments,
  settings,
  stationDetail,
  telemetry,
  telemetryHourly,
  users,
  valves,
  workOrders,
  WO_TYPES,
  type AlarmType,
  type ConsumerCategory,
  type NodeKind,
  type NodeStatus,
  type Severity,
  type Zone,
} from "./schema";
import { scryptHash } from "./password";

/* ───────────────────────── deterministic PRNG ───────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260929);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const rint = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));

/* ───────────────────────── helpers ───────────────────────── */

const HOUR = 3600_000;
const MIN5 = 5 * 60_000;
const DAY = 24 * HOUR;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la) * Math.cos(lb);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Diurnal demand multiplier (Indian city gas profile: morning + evening peaks). */
function diurnal(hour: number) {
  return (
    0.55 +
    0.5 * Math.exp(-((hour - 7.5) ** 2) / 4.5) +
    0.65 * Math.exp(-((hour - 19.5) ** 2) / 5.5) +
    0.12 * Math.exp(-((hour - 12.5) ** 2) / 8)
  );
}

/* ───────────────────────── network definition ───────────────────────── */

type NodeDef = {
  code: string;
  name: string;
  kind: NodeKind;
  zone: Zone;
  status?: NodeStatus;
  lat: number;
  lng: number;
  gx: number;
  gy: number;
  address?: string;
  capacity?: number;
  inletSet?: number;
  outletSet?: number;
  manufacturer?: string;
};

// Nashik bbox ≈ lat 19.95–20.06, lng 73.72–73.87
const NODE_DEFS: NodeDef[] = [
  // ── City gate stations (primary) ──
  { code: "CGS-01", name: "Ambad City Gate Station", kind: "CGS", zone: "primary", lat: 20.0355, lng: 73.8352, gx: 1399, gy: 147, address: "Ambad MIDC, Nashik", capacity: 8.5, inletSet: 42, outletSet: 24, manufacturer: "Cochin Valves" },
  { code: "CGS-02", name: "Satpur City Gate Station", kind: "CGS", zone: "primary", lat: 20.0105, lng: 73.7352, gx: 180, gy: 240, address: "Satpur MIDC, Nashik", capacity: 6.0, inletSet: 40, outletSet: 24, manufacturer: "Cochin Valves" },
  // ── District regulating stations (secondary) ──
  { code: "DPRS-01", name: "Indira Nagar DPRS", kind: "DPRS", zone: "secondary", lat: 20.0168, lng: 73.8147, gx: 900, gy: 375, address: "Indira Nagar, Nashik", capacity: 1.6, inletSet: 22, outletSet: 4.0 },
  { code: "DPRS-02", name: "College Road DPRS", kind: "DPRS", zone: "secondary", lat: 19.9965, lng: 73.7664, gx: 435, gy: 329, address: "College Road, Nashik", capacity: 1.4, inletSet: 22, outletSet: 4.0 },
  { code: "DPRS-03", name: "Gangapur Road DPRS", kind: "DPRS", zone: "secondary", lat: 19.9862, lng: 73.7576, gx: 340, gy: 470, address: "Gangapur Road, Nashik", capacity: 1.2, inletSet: 22, outletSet: 3.8 },
  { code: "DPRS-04", name: "Cidco DPRS", kind: "DPRS", zone: "secondary", lat: 19.9897, lng: 73.8043, gx: 689, gy: 560, address: "Cidco, Nashik", capacity: 1.8, inletSet: 22, outletSet: 4.2 },
  { code: "DPRS-05", name: "Satpur East DPRS", kind: "DPRS", zone: "secondary", lat: 20.0044, lng: 73.7487, gx: 242, gy: 119, address: "Satpur East, Nashik", capacity: 1.1, inletSet: 22, outletSet: 4.0 },
  { code: "DPRS-06", name: "Panchavati DPRS", kind: "DPRS", zone: "secondary", lat: 20.0227, lng: 73.7769, gx: 435, gy: 119, address: "Panchavati, Nashik", capacity: 1.3, inletSet: 22, outletSet: 4.0 },
  // ── CNG stations ──
  { code: "CNG-01", name: "Ambad Highway CNG", kind: "CNG", zone: "primary", lat: 20.0297, lng: 73.8561, gx: 1345, gy: 356, address: "Mumbai-Agra Hwy, Ambad", capacity: 1.9, inletSet: 24, outletSet: 200 },
  { code: "CNG-02", name: "Satpur CNG Mother", kind: "CNG", zone: "primary", lat: 20.0188, lng: 73.7236, gx: 95, gy: 405, address: "Satpur Link Rd", capacity: 2.2, inletSet: 24, outletSet: 200 },
  { code: "CNG-03", name: "Mhasrul CNG", kind: "CNG", zone: "primary", lat: 20.0418, lng: 73.7848, gx: 780, gy: 60, address: "Dindori Rd, Mhasrul", capacity: 1.5, inletSet: 24, outletSet: 200 },
  { code: "CNG-04", name: "Aashirwad CNG", kind: "CNG", zone: "primary", lat: 19.9696, lng: 73.7998, gx: 864, gy: 745, address: "Aashirwad Circle", capacity: 1.7, inletSet: 24, outletSet: 200 },
  // ── Metering / odorisation ──
  { code: "MRS-01", name: "Ambad Industrial MRS", kind: "MRS", zone: "primary", lat: 20.0444, lng: 73.8244, gx: 1105, gy: 70, address: "Ambad MIDC Phase II", capacity: 3.4, inletSet: 24, outletSet: 18 },
  { code: "ODR-01", name: "Ambad Odorisation Skid", kind: "ODORISER", zone: "primary", lat: 20.0341, lng: 73.8394, gx: 1398, gy: 251, address: "CGS-01 battery limits" },
  // ── Primary ring junctions ──
  { code: "JCT-01", name: "Deolali Camp Junction", kind: "JUNCTION", zone: "primary", lat: 20.0226, lng: 73.8331, gx: 1012, gy: 175 },
  { code: "JCT-02", name: "Mhasrul Junction", kind: "JUNCTION", zone: "primary", lat: 20.0378, lng: 73.7752, gx: 627, gy: 164 },
  { code: "JCT-03", name: "Cidco Ring Junction", kind: "JUNCTION", zone: "primary", lat: 19.9948, lng: 73.8298, gx: 1075, gy: 545 },
  { code: "JCT-04", name: "Pathardi Junction", kind: "JUNCTION", zone: "primary", lat: 19.9725, lng: 73.7702, gx: 671, gy: 715 },
  { code: "JCT-05", name: "Gangapur Holi Junction", kind: "JUNCTION", zone: "primary", lat: 19.9849, lng: 73.7378, gx: 286, gy: 640 },
  { code: "JCT-06", name: "Nashik Road Hub", kind: "JUNCTION", zone: "primary", lat: 20.0049, lng: 73.7934, gx: 700, gy: 405 },
  // ── Valve chambers ──
  { code: "VLV-01", name: "Ambad Valve Chamber", kind: "VALVE", zone: "primary", lat: 20.0285, lng: 73.8343, gx: 1205, gy: 175 },
  { code: "VLV-02", name: "Mhasrul Valve Chamber", kind: "VALVE", zone: "primary", lat: 20.0306, lng: 73.8041, gx: 820, gy: 165 },
  { code: "VLV-03", name: "Satpur Valve Chamber", kind: "VALVE", zone: "primary", lat: 20.0165, lng: 73.7485, gx: 420, gy: 223 },
  { code: "VLV-04", name: "Cidco Valve Chamber", kind: "VALVE", zone: "primary", lat: 20.0019, lng: 73.8316, gx: 1140, gy: 375 },
  { code: "VLV-05", name: "Pathardi Valve Chamber", kind: "VALVE", zone: "primary", lat: 19.9833, lng: 73.7741, gx: 881, gy: 630 },
  { code: "VLV-06", name: "Gangapur Valve Chamber", kind: "VALVE", zone: "primary", lat: 19.9795, lng: 73.7537, gx: 479, gy: 677 },
  { code: "VLV-07", name: "Nashik Rd Valve Chamber", kind: "VALVE", zone: "primary", lat: 20.0047, lng: 73.7815, gx: 627, gy: 290 },
  { code: "VLV-08", name: "Indira Nagar Valve Chamber", kind: "VALVE", zone: "secondary", lat: 20.0168, lng: 73.8011, gx: 820, gy: 270 },
];

type SegDef = {
  code: string;
  from: string;
  to: string;
  zone: Zone;
  material: "steel" | "PE" | "MDPE";
  dia: number;
  maop: number;
  route?: string;
  status?: NodeStatus;
};

const SEG_DEFS: SegDef[] = [
  // primary steel ring (upper)
  { code: "SEG-P01", from: "CGS-01", to: "VLV-01", zone: "primary", material: "steel", dia: 300, maop: 42, route: "Ambad link main" },
  { code: "SEG-P02", from: "VLV-01", to: "JCT-01", zone: "primary", material: "steel", dia: 300, maop: 42, route: "Ambad–Deolali main" },
  { code: "SEG-P03", from: "JCT-01", to: "VLV-02", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Deolali–Mhasrul main" },
  { code: "SEG-P04", from: "VLV-02", to: "JCT-02", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Mhasrul main" },
  { code: "SEG-P05", from: "JCT-02", to: "VLV-03", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Mhasrul–Satpur main" },
  { code: "SEG-P06", from: "VLV-03", to: "CGS-02", zone: "primary", material: "steel", dia: 300, maop: 42, route: "Satpur approach" },
  // primary steel ring (lower)
  { code: "SEG-P07", from: "CGS-01", to: "VLV-04", zone: "primary", material: "steel", dia: 300, maop: 42, route: "Ambad south main" },
  { code: "SEG-P08", from: "VLV-04", to: "JCT-03", zone: "primary", material: "steel", dia: 300, maop: 42, route: "Cidco ring main" },
  { code: "SEG-P09", from: "JCT-03", to: "VLV-05", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Cidco–Pathardi main" },
  { code: "SEG-P10", from: "VLV-05", to: "JCT-04", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Pathardi main" },
  { code: "SEG-P11", from: "JCT-04", to: "VLV-06", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Pathardi–Gangapur main" },
  { code: "SEG-P12", from: "VLV-06", to: "JCT-05", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Gangapur main" },
  { code: "SEG-P13", from: "JCT-05", to: "CGS-02", zone: "primary", material: "steel", dia: 300, maop: 42, route: "Satpur south approach" },
  // ring cross-links
  { code: "SEG-P14", from: "JCT-01", to: "VLV-07", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Deolali–Nashik Rd" },
  { code: "SEG-P15", from: "VLV-07", to: "JCT-06", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Nashik Rd main" },
  { code: "SEG-P16", from: "JCT-06", to: "JCT-03", zone: "primary", material: "steel", dia: 250, maop: 42, route: "Nashik Rd–Cidco link" },
  { code: "SEG-P17", from: "JCT-02", to: "JCT-06", zone: "primary", material: "steel", dia: 200, maop: 42, route: "North–central link" },
  { code: "SEG-P18", from: "JCT-05", to: "JCT-04", zone: "primary", material: "steel", dia: 200, maop: 42, route: "South-west link" },
  // primary spurs
  { code: "SEG-P19", from: "JCT-01", to: "MRS-01", zone: "primary", material: "steel", dia: 200, maop: 42, route: "Ambad industrial spur" },
  { code: "SEG-P20", from: "JCT-01", to: "ODR-01", zone: "primary", material: "steel", dia: 150, maop: 42, route: "Odoriser feed" },
  { code: "SEG-P21", from: "CGS-01", to: "CNG-01", zone: "primary", material: "steel", dia: 150, maop: 42, route: "Ambad Hwy CNG spur" },
  { code: "SEG-P22", from: "CGS-02", to: "CNG-02", zone: "primary", material: "steel", dia: 150, maop: 42, route: "Satpur CNG spur" },
  { code: "SEG-P23", from: "JCT-02", to: "CNG-03", zone: "primary", material: "steel", dia: 150, maop: 42, route: "Dindori CNG spur" },
  { code: "SEG-P24", from: "JCT-04", to: "CNG-04", zone: "primary", material: "steel", dia: 150, maop: 42, route: "Aashirwad CNG spur" },
  // secondary PE mains
  { code: "SEG-S01", from: "JCT-01", to: "DPRS-01", zone: "secondary", material: "PE", dia: 160, maop: 6, route: "Indira Nagar feeder" },
  { code: "SEG-S02", from: "VLV-08", to: "DPRS-01", zone: "secondary", material: "PE", dia: 110, maop: 6, route: "Indira Nagar branch", status: "maintenance" },
  { code: "SEG-S03", from: "JCT-06", to: "DPRS-04", zone: "secondary", material: "PE", dia: 160, maop: 6, route: "Cidco feeder" },
  { code: "SEG-S04", from: "JCT-06", to: "DPRS-02", zone: "secondary", material: "PE", dia: 160, maop: 6, route: "College Rd feeder" },
  { code: "SEG-S05", from: "DPRS-02", to: "DPRS-03", zone: "secondary", material: "PE", dia: 110, maop: 6, route: "Gangapur branch" },
  { code: "SEG-S06", from: "JCT-02", to: "DPRS-05", zone: "secondary", material: "PE", dia: 110, maop: 6, route: "Satpur East feeder" },
  { code: "SEG-S07", from: "JCT-02", to: "DPRS-06", zone: "secondary", material: "PE", dia: 160, maop: 6, route: "Panchavati feeder" },
  { code: "SEG-S08", from: "JCT-04", to: "DPRS-04", zone: "secondary", material: "PE", dia: 110, maop: 6, route: "Pathardi–Cidco branch" },
  { code: "SEG-S09", from: "JCT-05", to: "DPRS-03", zone: "secondary", material: "PE", dia: 110, maop: 6, route: "Gangapur south feeder" },
  { code: "SEG-S10", from: "DPRS-06", to: "DPRS-02", zone: "secondary", material: "PE", dia: 110, maop: 6, route: "Panchavati–College branch" },
];

/* ───────────────────────── name pools ───────────────────────── */

const DOMESTIC_NAMES = [
  "Sharma Residence", "Patil Niwas", "Joshi Bungalow", "Deshmukh Residence",
  "Kulkarni House", "Gaikwad Residence", "Sathe Apartments", "Bhosale Niwas",
  "Chavan Residence", "Thatte House", "Wagh Residency", "Pawar Apartments",
  "More Residence", "Kale House", "Shinde Niwas", "Nikam Residence",
  "Jadhav House", "Sutar Residence", "Borude Apartments", "Khedekar Niwas",
];
const COMMERCIAL_NAMES = [
  "Hotel Sandhya", "Sai Traders", "Nashik Foods", "Annapurna Caterers",
  "Ganesh Bakery", "Royal Enclave Hotel", "Krishna Sweets", "Apex Hardware",
  "Blue Diamond Restaurant", "Shree Veg Dining", "Metro Garments", "Precision Tools",
  "City Centre Mall Kiosk", "Dominos Gangapur", "Cafe Coffee Day College Rd",
  "Royal Inn", "Suyojit Lodge", "Gold Coin Restaurant", "Quick Bites", "Urban Tadka",
];
const INDUSTRIAL_NAMES = [
  "Godavari Distilleries", "Puneri Gears Pvt Ltd", "Vishwas Precision",
  "Ambad Plastics Ltd", "Shakti Forgings", "Nashik Auto Components",
  "Deccan Aerosystems", "Trimurti Packaging", "Sahyadri Chemicals",
  "Riddhi Siddhi Glass", "Orchid Pharma Unit II", "Bharat Fabricators",
  "Jayshree Textiles", "Ashirwad Motors Plant", "Suvarna Machineries",
];
const INSTITUTIONAL_NAMES = [
  "GMCH Hospital", "KTHM College Hostel", "Nashik Municipal School",
  "Sunrise International School", "Dnyaneshwar Library", "Cidco Water Works",
  "Panchavati Temple Trust", "Fire Station Gangapur", "District Collectorate",
  "Symbiosis Campus Nashik",
];
const CNG_NAMES = [
  "HPCL Daughter Station Ambad", "IOCL Daughter Station Cidco",
  "Reliance BP Mobility Satpur", "Mahanagar Gas Station Panchavati",
  "GAIL CNG Station Pathardi",
];
const LOCALITIES = [
  "Gangapur Road", "College Road", "Indira Nagar", "Cidco", "Panchavati",
  "Satpur", "Ambad", "Nashik Road", "Deolali", "Mhasrul", "Pathardi",
  "Sharanpur Road", "Dindori Road", "Ashok Stambh", "Makhmalabad Road",
];

/* ───────────────────────── main seed ───────────────────────── */

export function seedIfEmpty(db: Db) {
  const existing = db.select({ n: sql<number>`count(*)` }).from(nodes).get();
  if (existing && existing.n > 0) return;
  runSeed(db);
}

function runSeed(db: Db) {
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  db.transaction((tx) => {
    /* users */
    const pw = (s: string) => scryptHash(s);
    const userRows = [
      { username: "admin", fullName: "Anita Deshmukh", role: "admin" as const, passwordHash: pw("admin123") },
      { username: "operator", fullName: "Ravi Kulkarni", role: "operator" as const, passwordHash: pw("ops123") },
      { username: "viewer", fullName: "S. Iyer", role: "viewer" as const, passwordHash: pw("view123") },
      { username: "field", fullName: "Vikram Singh", role: "operator" as const, passwordHash: pw("field123") },
      { username: "supervisor", fullName: "Meera Joshi", role: "operator" as const, passwordHash: pw("super123") },
    ].map((u) => ({ ...u, active: true, createdAt: now }));
    const insertedUsers = tx.insert(users).values(userRows).returning().all();
    const userId = (name: string) => insertedUsers.find((u) => u.username === name)!.id;

    /* nodes */
    const nodeRows = NODE_DEFS.map((d) => ({
      code: d.code,
      name: d.name,
      kind: d.kind,
      zone: d.zone,
      status: (d.status ?? "operational") as NodeStatus,
      lat: d.lat,
      lng: d.lng,
      gx: d.gx,
      gy: d.gy,
      address: d.address ?? null,
      commissionedOn: new Date(rint(2016, 2023), rint(0, 11), rint(1, 28)).getTime(),
      notes: null,
      meta: {
        inlet: d.inletSet,
        outlet: d.outletSet,
        manufacturer: d.manufacturer,
      },
    }));
    const insertedNodes = tx.insert(nodes).values(nodeRows).returning().all();
    const nodeId = (code: string) => insertedNodes.find((n) => n.code === code)!.id;
    const nodeByCode = (code: string) => insertedNodes.find((n) => n.code === code)!;

    /* station details */
    const stationRows = NODE_DEFS.filter((d) =>
      ["CGS", "DPRS", "CNG", "MRS"].includes(d.kind)
    ).map((d) => ({
      nodeId: nodeId(d.code),
      capacityMmscfd: d.capacity ?? null,
      inletSetBar: d.inletSet ?? null,
      outletSetBar: d.outletSet ?? null,
      monitorRegulator: true,
      slamShut: true,
      odorizer: d.kind === "CGS" || d.kind === "MRS",
      scadaRtu: true,
      lastInspectionOn: new Date(now - rint(10, 120) * DAY).getTime(),
    }));
    tx.insert(stationDetail).values(stationRows).run();

    /* segments */
    const segRows = SEG_DEFS.map((s) => {
      const a = nodeByCode(s.from);
      const b = nodeByCode(s.to);
      const km = haversineKm(a, b) * 1.25; // route factor
      const lengthM = Math.round(km * 1000);
      // gentle dog-leg midpoint for map realism
      const midLat = (a.lat + b.lat) / 2 + (b.lng - a.lng) * 0.04;
      const midLng = (a.lng + b.lng) / 2 - (b.lat - a.lat) * 0.04;
      return {
        code: s.code,
        name: s.route ?? s.code,
        fromNode: a.id,
        toNode: b.id,
        zone: s.zone,
        material: s.material,
        diameterMm: s.dia,
        lengthM,
        maopBar: s.maop,
        laidOn: new Date(rint(2016, 2023), rint(0, 11), rint(1, 28)).getTime(),
        status: (s.status ?? "operational") as NodeStatus,
        routeName: s.route ?? s.code,
        shape: {
          map: [
            [a.lat, a.lng],
            [midLat, midLng],
            [b.lat, b.lng],
          ] as [number, number][],
          graph: [
            [a.gx, a.gy],
            [b.gx, b.gy],
          ] as [number, number][],
        },
      };
    });
    const insertedSegs = tx.insert(segments).values(segRows).returning().all();

    /* valves */
    const valveRows = insertedNodes
      .filter((n) => n.kind === "VALVE")
      .map((n, i) => ({
        code: n.code,
        nodeId: n.id,
        segmentId: insertedSegs[i % insertedSegs.length]?.id ?? null,
        type: (i % 4 === 0 ? "slam_shut" : i % 3 === 0 ? "sectionalising" : "isolation") as
          | "slam_shut"
          | "sectionalising"
          | "isolation",
        state: ("open" as const),
        lastExercisedOn: new Date(now - rint(20, 300) * DAY).getTime(),
      }));
    tx.insert(valves).values(valveRows).run();

    /* consumers + readings */
    const categoryPlan: [ConsumerCategory, number][] = [
      ["DOMESTIC", 110],
      ["COMMERCIAL", 40],
      ["INDUSTRIAL", 15],
      ["INSTITUTIONAL", 10],
      ["CNG", 5],
    ];
    const supplyNodes = insertedNodes.filter((n) =>
      ["DPRS", "CNG", "MRS", "CGS"].includes(n.kind)
    );
    const tariff: Record<ConsumerCategory, number> = {
      DOMESTIC: 26.5,
      COMMERCIAL: 46,
      INDUSTRIAL: 42,
      INSTITUTIONAL: 44,
      CNG: 55,
    };
    const load: Record<ConsumerCategory, [number, number]> = {
      DOMESTIC: [4, 14],
      COMMERCIAL: [20, 90],
      INDUSTRIAL: [120, 480],
      INSTITUTIONAL: [25, 120],
      CNG: [300, 900],
    };
    const namePool: Record<ConsumerCategory, string[]> = {
      DOMESTIC: DOMESTIC_NAMES,
      COMMERCIAL: COMMERCIAL_NAMES,
      INDUSTRIAL: INDUSTRIAL_NAMES,
      INSTITUTIONAL: INSTITUTIONAL_NAMES,
      CNG: CNG_NAMES,
    };

    const consumerRows: (typeof consumers.$inferInsert)[] = [];
    let conSeq = 1;
    for (const [cat, count] of categoryPlan) {
      for (let i = 0; i < count; i++) {
        const anchor = supplyNodes[rint(0, supplyNodes.length - 1)];
        const pool = namePool[cat];
        const base = pool[i % pool.length];
        const suffix = i >= pool.length ? ` ${Math.floor(i / pool.length) + 1}` : "";
        const locality = pick(LOCALITIES);
        consumerRows.push({
          code: `CON-${String(conSeq++).padStart(4, "0")}`,
          name: `${base}${suffix}`,
          category: cat,
          status: rnd() < 0.94 ? "active" : rnd() < 0.5 ? "pending" : "disconnected",
          nodeId: anchor.id,
          lat: anchor.lat + between(-0.012, 0.012),
          lng: anchor.lng + between(-0.014, 0.014),
          address: `${rint(1, 220)}, ${locality}, Nashik`,
          connectedOn: new Date(rint(2017, 2025), rint(0, 11), rint(1, 28)).getTime(),
          approvedLoadSm3h: between(load[cat][0], load[cat][1]),
          meterSerial: `NM${rint(100000, 999999)}`,
          tariffGroup: cat.slice(0, 3).toUpperCase(),
        });
      }
    }
    const insertedConsumers = tx.insert(consumers).values(consumerRows).returning().all();

    // 6 months of readings (Apr 2026 → Sep 2026)
    const periods: string[] = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const readingRows: (typeof readings.$inferInsert)[] = [];
    for (const c of insertedConsumers) {
      const baseConsumption: Record<ConsumerCategory, number> = {
        DOMESTIC: between(9, 26),
        COMMERCIAL: between(120, 520),
        INDUSTRIAL: between(1800, 9800),
        INSTITUTIONAL: between(150, 700),
        CNG: between(6000, 18000),
      };
      const seasonal = [0.92, 0.95, 1.0, 1.04, 1.08, 1.12]; // winter ramp
      let idx = between(1200, 98000);
      periods.forEach((p, i) => {
        const consumption = Math.round(baseConsumption[c.category] * seasonal[i] * between(0.9, 1.12));
        const opening = idx;
        idx += consumption;
        const amount = Math.round(consumption * tariff[c.category]);
        const isCurrent = i === periods.length - 1;
        const roll = rnd();
        const status = !isCurrent
          ? roll < 0.965
            ? "paid"
            : "overdue"
          : roll < 0.55
            ? "paid"
            : roll < 0.85
              ? "unpaid"
              : "overdue";
        const dueOn = new Date(
          new Date(p + "-01T00:00:00").getTime() + 15 * DAY
        ).getTime();
        readingRows.push({
          consumerId: c.id,
          period: p,
          openingIdx: Math.round(opening),
          closingIdx: Math.round(idx),
          consumptionSm3: consumption,
          amount,
          status: status as "paid" | "unpaid" | "overdue",
          dueOn,
          paidOn: status === "paid" ? dueOn - rint(0, 12) * DAY : null,
        });
      });
    }
    tx.insert(readings).values(readingRows).run();

    /* telemetry history */
    const stationNodes = insertedNodes.filter((n) =>
      ["CGS", "DPRS", "CNG", "MRS"].includes(n.kind)
    );
    const baseFlow: Record<NodeKind, [number, number]> = {
      CGS: [8200, 11800],
      DPRS: [700, 2400],
      CNG: [900, 1900],
      MRS: [2100, 3600],
      IPRS: [50, 120],
      VALVE: [0, 0],
      JUNCTION: [0, 0],
      ODORISER: [0, 0],
    };
    const basePressure: Record<Zone, [number, number]> = {
      primary: [23.2, 25.4],
      secondary: [3.7, 4.3],
      tertiary: [0.8, 1.2],
    };
    // Downstream demand first; CGS intake = demand × 1.015 (≈1.5% network loss)
    const profile = new Map<number, { flow: number; p0: number }>();
    let demandBase = 0;
    for (const n of stationNodes) {
      if (n.kind === "CGS") continue;
      const flow = between(baseFlow[n.kind][0], baseFlow[n.kind][1]);
      profile.set(n.id, { flow, p0: between(basePressure[n.zone][0], basePressure[n.zone][1]) });
      demandBase += flow;
    }
    const intakeTotal = demandBase * 1.015;
    const cgsNodes = stationNodes.filter((n) => n.kind === "CGS");
    let allocated = 0;
    cgsNodes.forEach((n, i) => {
      const share =
        i === cgsNodes.length - 1
          ? intakeTotal - allocated
          : intakeTotal * (i === 0 ? 0.55 : 0.45);
      allocated += share;
      profile.set(n.id, {
        flow: share,
        p0: between(basePressure.primary[0], basePressure.primary[1]),
      });
    });

    // hourly rollups for 90 days (synthesised), raw for last 7 days (5-min)
    const hourlyRows: (typeof telemetryHourly.$inferInsert)[] = [];
    const startHour = Math.floor((now - 90 * DAY) / HOUR) * HOUR;
    for (const n of stationNodes) {
      const pf = profile.get(n.id)!;
      for (let t = startHour; t <= now; t += HOUR) {
        const h = new Date(t).getHours();
        const mult = diurnal(h);
        const noise = between(0.96, 1.04);
        const p = pf.p0 + between(-0.18, 0.18) + (n.zone === "secondary" ? mult * 0.12 : 0);
        const f = pf.flow * mult * noise;
        hourlyRows.push({
          nodeId: n.id,
          hourTs: t,
          pAvg: round2(p),
          pMax: round2(p + 0.22),
          pMin: round2(p - 0.2),
          fAvg: round2(f),
          fMax: round2(f * 1.12),
          samples: 60,
        });
      }
    }
    chunked(hourlyRows, 2000, (slice) => tx.insert(telemetryHourly).values(slice).run());

    const rawStart = Math.floor((now - 7 * DAY) / MIN5) * MIN5;
    const rawRows: (typeof telemetry.$inferInsert)[] = [];
    for (const n of stationNodes) {
      const pf = profile.get(n.id)!;
      let drift = 0;
      for (let t = rawStart; t <= now; t += MIN5) {
        const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
        drift = drift * 0.94 + between(-0.04, 0.04);
        const mult = diurnal(h);
        const p = pf.p0 + drift + (n.zone === "secondary" ? mult * 0.12 : 0);
        const f = pf.flow * mult * between(0.97, 1.03);
        rawRows.push({
          nodeId: n.id,
          ts: t,
          pressureBar: round2(p),
          flowSm3h: round2(f),
          tempC: round2(between(28, 36)),
        });
      }
    }
    chunked(rawRows, 2000, (slice) => tx.insert(telemetry).values(slice).run());

    /* historical alarms */
    const alarmSpecs: AlarmType[] = [
      "OVER_PRESSURE", "UNDER_PRESSURE", "HIGH_FLOW", "LOW_FLOW",
      "COMM_LOSS", "VALVE_ANOMALY", "LEAK_SUSPECTED",
    ];
    const alarmRows: (typeof alarms.$inferInsert)[] = [];
    const alarmText: Record<AlarmType, (code: string, v: string, th: string) => string> = {
      OVER_PRESSURE: (c, v, th) => `${c}: outlet pressure ${v} bar above limit ${th} bar`,
      UNDER_PRESSURE: (c, v, th) => `${c}: outlet pressure ${v} bar below limit ${th} bar`,
      HIGH_FLOW: (c, v, th) => `${c}: flow ${v} sm³/h above expected band (max ${th})`,
      LOW_FLOW: (c, v, th) => `${c}: flow ${v} sm³/h below expected band (min ${th})`,
      COMM_LOSS: (c) => `${c}: RTU communication lost — no telemetry for > 10 min`,
      VALVE_ANOMALY: (c) => `${c}: valve position mismatch reported by field`,
      LEAK_SUSPECTED: (c) => `${c}: pressure decay signature suggests possible leak`,
    };
    for (let i = 0; i < 150; i++) {
      const n = stationNodes[rint(0, stationNodes.length - 1)];
      const type = pick(alarmSpecs);
      const severity: Severity =
        type === "LEAK_SUSPECTED" ? "critical" : rnd() < 0.3 ? "critical" : rnd() < 0.6 ? "warning" : "info";
      const ts = now - Math.floor(rnd() ** 2 * 60 * DAY) - rint(0, HOUR);
      const limit = n.zone === "primary" ? 30 : 5.5;
      const v = round2(limit + between(0.3, 3));
      const age = now - ts;
      let status: "open" | "acknowledged" | "resolved";
      if (age < 3 * DAY) {
        status = i % 10 < 5 ? "open" : i % 10 < 7 ? "acknowledged" : "resolved";
      } else if (age < 10 * DAY && i % 9 === 0) {
        status = "open";
      } else if (age < 21 * DAY && i % 8 === 0) {
        status = "acknowledged";
      } else {
        status = "resolved";
      }
      alarmRows.push({
        nodeId: n.id,
        ts,
        type,
        severity,
        message: alarmText[type](n.code, `${v}`, `${limit}`),
        value: v,
        threshold: limit,
        status,
        ackBy: status !== "open" ? userId(rnd() < 0.5 ? "operator" : "field") : null,
        ackAt: status !== "open" ? Math.min(ts + rint(5, 90) * 60_000, now) : null,
        resolvedAt:
          status === "resolved" ? Math.min(ts + rint(2, 48) * HOUR, now) : null,
        note: status === "resolved" ? "Verified normal after field round" : null,
      });
    }
    tx.insert(alarms).values(alarmRows).run();

    /* work orders */
    const woTitles: [string, string][] = [
      ["preventive", "Quarterly regulator inspection"],
      ["corrective", "Replace pressure gauge"],
      ["inspection", "Route patrol — third-party excavation check"],
      ["leak_repair", "Repair minor leak at joint"],
      ["corrective", "Reset slam-shut valve"],
      ["preventive", "Odoriser chemical top-up"],
      ["inspection", "Cathodic protection survey"],
      ["corrective", "Fix RTU battery backup"],
      ["construction", "New service connection lay"],
      ["preventive", "Valve exercising round"],
      ["corrective", "Regulator diaphragm replacement"],
      ["inspection", "Leak survey with gas detector"],
    ];
    const woStatuses: ("open" | "assigned" | "in_progress" | "blocked" | "done" | "cancelled")[] =
      ["open", "assigned", "in_progress", "blocked", "done", "done", "done", "cancelled"];
    const woRows: (typeof workOrders.$inferInsert)[] = [];
    for (let i = 0; i < 42; i++) {
      const [type, title] = pick(woTitles);
      const n = pick(insertedNodes);
      const created = now - rint(1, 75) * DAY;
      const status = pick(woStatuses);
      const yr = new Date(created).getFullYear();
      woRows.push({
        code: `WO-${yr}-${String(1001 + i).padStart(4, "0")}`,
        title,
        description: `${title} at ${n.code} — ${n.name}. As per OISD/PNGRB maintenance schedule.`,
        type: type as (typeof WO_TYPES)[number],        priority: pick(["low", "medium", "high", "urgent"] as const),
        status,
        nodeId: n.id,
        segmentId: rnd() < 0.35 ? pick(insertedSegs).id : null,
        assignedTo: rnd() < 0.85 ? userId(pick(["field", "supervisor", "operator"])) : null,
        dueOn: created + rint(3, 21) * DAY,
        createdBy: userId("operator"),
        createdAt: created,
        closedAt: status === "done" || status === "cancelled" ? created + rint(2, 18) * DAY : null,
      });
    }
    tx.insert(workOrders).values(woRows).run();

    /* settings + audit + sessions hygiene */
    tx.insert(settings)
      .values([
        { key: "company_name", value: "Aurum Gas Grid Pvt. Ltd." },
        { key: "license_area", value: "Nashik, Maharashtra (Gujarat–Mumbai DNG spur)" },
        { key: "simulator_enabled", value: true },
        { key: "simulator_interval_ms", value: 4000 },
        {
          key: "alarm_thresholds",
          value: {
            primary: { over: 30, under: 15 },
            secondary: { over: 5.5, under: 2.5 },
            tertiary: { over: 1.5, under: 0.4 },
            high_flow_cgs: 13500,
          },
        },
        { key: "retention_raw_days", value: 90 },
      ])
      .run();

    tx.insert(auditLog)
      .values({
        ts: now,
        userId: userId("admin"),
        action: "seed",
        entity: "database",
        entityId: null,
        details: { nodes: nodeRows.length, segments: segRows.length, consumers: consumerRows.length },
      })
      .run();
  });
}

function chunked<T>(rows: T[], size: number, run: (slice: T[]) => unknown) {
  for (let i = 0; i < rows.length; i += size) run(rows.slice(i, i + size));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
