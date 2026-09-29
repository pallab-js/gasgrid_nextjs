import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { alarms, nodes, settings, telemetry } from "./schema";
import type { AlarmType, NodeRow, Severity } from "./schema";

/* Local telemetry simulator — mirrors the seed profile (diurnal demand,
   zone pressure bands, ~1.5% network loss at CGS intake) and raises
   threshold alarms. Runs in-process, started lazily from the app layout. */

const MIN5 = 5 * 60_000;
const HOUR = 60 * 60_000;
const ALARM_COOLDOWN_MS = 60 * 60_000;

type Thresholds = {
  primary: { over: number; under: number };
  secondary: { over: number; under: number };
  tertiary: { over: number; under: number };
  high_flow_cgs: number;
};

type SimState = {
  node: NodeRow;
  p: number;
  f: number;
  drift: number;
  baseFlow: number;
  baseP: number;
  cgsShare: number;
  spikeUntil: number;
  spikeKind: "over" | "under" | null;
};

type SimGlobal = {
  states: SimState[];
  inited: boolean;
  timer: ReturnType<typeof setInterval> | null;
  intervalMs: number;
  ticks: number;
  lastErrorAt: number;
};

const g = globalThis as typeof globalThis & { __gasnextSim?: SimGlobal };

function sim(): SimGlobal {
  g.__gasnextSim ??= {
    states: [],
    inited: false,
    timer: null,
    intervalMs: 4000,
    ticks: 0,
    lastErrorAt: 0,
  };
  return g.__gasnextSim;
}

/* ── helpers (same profile maths as lib/seed.ts) ── */

function rnd() {
  return Math.random();
}
function between(a: number, b: number) {
  return a + rnd() * (b - a);
}
function rint(a: number, b: number) {
  return Math.floor(between(a, b + 1));
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
/** approx standard normal in [-1.5, 1.5] */
function randn() {
  return (rnd() + rnd() + rnd() - 1.5) * 1.15;
}

function diurnal(hour: number) {
  return (
    0.55 +
    0.5 * Math.exp(-((hour - 7.5) ** 2) / 4.5) +
    0.65 * Math.exp(-((hour - 19.5) ** 2) / 5.5) +
    0.12 * Math.exp(-((hour - 12.5) ** 2) / 8)
  );
}

function getSetting<T>(key: string, fallback: T): T {
  const row = getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return (row?.value as T | undefined) ?? fallback;
}

/* ── lifecycle ── */

/** Idempotent; call on every authenticated request (layout) to keep it alive. */
export function ensureSimulator() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const s = sim();
  if (s.timer) return;

  const intervalMs = getSetting<number>("simulator_interval_ms", 4000);
  s.intervalMs = intervalMs;
  s.timer = setInterval(() => {
    try {
      tick();
    } catch (err) {
      const now = Date.now();
      if (now - s.lastErrorAt > 60_000) {
        s.lastErrorAt = now;
        console.error("[simulator] tick failed:", err);
      }
      s.inited = false; // reinit on next successful run (e.g. after db:reset)
    }
  }, intervalMs);
  // don't keep the process alive just for the simulator
  s.timer.unref?.();
}

export function stopSimulator() {
  const s = sim();
  if (s.timer) clearInterval(s.timer);
  s.timer = null;
  s.inited = false;
}

/* ── state ── */

function monitoredNodes(): NodeRow[] {
  return getDb()
    .select()
    .from(nodes)
    .where(sql`${nodes.kind} IN ('CGS','DPRS','CNG','MRS')`)
    .all();
}

function initStates() {
  const db = getDb();
  const stationNodes = monitoredNodes();
  const states: SimState[] = stationNodes.map((node) => {
    const last = db
      .select({ p: telemetry.pressureBar, f: telemetry.flowSm3h })
      .from(telemetry)
      .where(eq(telemetry.nodeId, node.id))
      .orderBy(sql`${telemetry.ts} DESC`)
      .limit(1)
      .get();

    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const mult = diurnal(h);
    const band =
      node.zone === "primary"
        ? [23.2, 25.4]
        : node.zone === "secondary"
          ? [3.7, 4.3]
          : [0.8, 1.2];

    // fall back to the seed's kind ranges when history is missing
    const kindRange: Record<string, [number, number]> = {
      CGS: [8200, 11800],
      DPRS: [700, 2400],
      CNG: [900, 1900],
      MRS: [2100, 3600],
    };
    const range = kindRange[node.kind] ?? [0, 0];

    const f = last ? last.f : between(range[0], range[1]) * mult;
    const p = last
      ? last.p
      : between(band[0], band[1]) + (node.zone === "secondary" ? mult * 0.12 : 0);

    return {
      node,
      p,
      f,
      drift: between(-0.05, 0.05),
      baseFlow: Math.max(f / Math.max(mult, 0.2), range[0] * 0.9),
      baseP:
        p -
        (node.zone === "secondary" ? mult * 0.12 : 0),
      cgsShare: 0.5,
      spikeUntil: 0,
      spikeKind: null,
    };
  });

  // keep CGS intake balanced against downstream demand (≈1.5% network loss)
  balanceCgs(states);

  // backfill a gap left by downtime (cap: 7 days at 5-min steps is too many —
  // cap at 400 rows ≈ 33 h of gap; older gaps stay as a realistic comm loss)
  backfillGap(states);

  const s = sim();
  s.states = states;
  s.inited = true;
}

function balanceCgs(states: SimState[]) {
  const cgs = states.filter((st) => st.node.kind === "CGS");
  if (!cgs.length) return;
  const downstream = states
    .filter((st) => st.node.kind !== "CGS")
    .reduce((sum, st) => sum + st.baseFlow, 0);
  const intake = downstream * 1.015;
  let allocated = 0;
  cgs.forEach((st, i) => {
    const share = i === cgs.length - 1 ? 1 - allocated : i === 0 ? 0.55 : 0.45;
    allocated += share;
    st.cgsShare = share;
    st.baseFlow = intake * share;
  });
}

function backfillGap(states: SimState[]) {
  const db = getDb();
  if (!states.length) return;
  const sampleId = states[0].node.id;
  const last = db
    .select({ ts: telemetry.ts })
    .from(telemetry)
    .where(eq(telemetry.nodeId, sampleId))
    .orderBy(sql`${telemetry.ts} DESC`)
    .limit(1)
    .get();
  if (!last) return;
  const now = Date.now();
  const gap = now - last.ts;
  if (gap < 15 * MIN5) return;

  const rows: (typeof telemetry.$inferInsert)[] = [];
  const end = now;
  let t = last.ts + MIN5;
  let guard = 0;
  while (t < end && guard++ < 400) {
    const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    const mult = diurnal(h);
    for (const st of states) {
      rows.push({
        nodeId: st.node.id,
        ts: t,
        pressureBar: round2(
          st.baseP +
            (st.node.zone === "secondary" ? mult * 0.12 : 0) +
            st.drift +
            randn() * 0.04
        ),
        flowSm3h: round2(st.baseFlow * mult * (1 + randn() * 0.02)),
        tempC: round2(30 + Math.sin((h / 24) * Math.PI * 2) * 3 + randn()),
      });
    }
    t += MIN5;
  }
  db.insert(telemetry).values(rows).run();
}

/* ── tick ── */

function tick() {
  const db = getDb();
  const s = sim();

  const enabled = getSetting<boolean>("simulator_enabled", true);
  if (!enabled) return;

  const interval = getSetting<number>("simulator_interval_ms", 4000);
  if (interval !== s.intervalMs && s.timer) {
    clearInterval(s.timer);
    s.intervalMs = interval;
    s.timer = setInterval(() => {
      try {
        tick();
      } catch (err) {
        console.error("[simulator] tick failed:", err);
        s.inited = false;
      }
    }, interval);
    s.timer.unref?.();
    return; // apply on next cycle
  }

  if (!s.inited || !s.states.length) initStates();
  const states = sim().states;
  if (!states.length) return;

  const thresholds = getSetting<Thresholds>("alarm_thresholds", {
    primary: { over: 30, under: 15 },
    secondary: { over: 5.5, under: 2.5 },
    tertiary: { over: 1.5, under: 0.4 },
    high_flow_cgs: 13500,
  });

  const now = Date.now();
  const h = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const mult = diurnal(h);

  /* advance state */
  const rows: (typeof telemetry.$inferInsert)[] = [];
  for (const st of states) {
    st.drift = st.drift * 0.94 + randn() * 0.012;

    // rare simulated excursions so the alarm console stays alive
    if (now > st.spikeUntil && st.spikeKind === null && rnd() < 0.002) {
      st.spikeKind = rnd() < 0.7 ? "over" : "under";
      st.spikeUntil = now + rint(90, 420) * 1000;
    }
    if (st.spikeKind !== null && now > st.spikeUntil) {
      st.spikeKind = null;
    }

    const band = thresholds[st.node.zone] ?? thresholds.primary;
    let targetP: number;
    if (st.spikeKind === "over") targetP = band.over + between(0.6, 2.2);
    else if (st.spikeKind === "under") targetP = band.under - between(0.3, 1.1);
    else
      targetP =
        st.baseP +
        (st.node.zone === "secondary" ? mult * 0.12 : 0) +
        st.drift;

    st.p = st.p * 0.55 + targetP * 0.45 + randn() * 0.03;

    const targetF =
      st.node.kind === "CGS"
        ? st.f // intake recomputed below once downstream demand is known
        : st.baseFlow *
          mult *
          (st.spikeKind === "over" ? 1.45 : 1) *
          (1 + randn() * 0.02);
    st.f = st.f * 0.5 + targetF * 0.5;

    rows.push({
      nodeId: st.node.id,
      ts: now,
      pressureBar: round2(st.p),
      flowSm3h: round2(st.f),
      tempC: round2(30 + Math.sin((h / 24) * Math.PI * 2) * 3 + randn()),
    });
  }

  // CGS intake = downstream × 1.015, split by share
  const demandNow = states
    .filter((st) => st.node.kind !== "CGS")
    .reduce((sum, st) => sum + st.f, 0);
  for (const st of states) {
    if (st.node.kind !== "CGS") continue;
    st.f = demandNow * 1.015 * st.cgsShare * (1 + randn() * 0.008);
    const row = rows.find((r) => r.nodeId === st.node.id)!;
    row.flowSm3h = round2(st.f);
  }

  db.insert(telemetry).values(rows).run();

  /* roll the current hour into telemetry_hourly */
  const hourTs = Math.floor(now / HOUR) * HOUR;
  db.run(
    sql`
      INSERT INTO telemetry_hourly (node_id, hour_ts, p_avg, p_max, p_min, f_avg, f_max, samples)
      SELECT node_id, ${hourTs},
        AVG(pressure_bar), MAX(pressure_bar), MIN(pressure_bar),
        AVG(flow_sm3h), MAX(flow_sm3h), COUNT(*)
      FROM telemetry
      WHERE ts >= ${hourTs} AND ts < ${hourTs + HOUR}
      GROUP BY node_id
      ON CONFLICT(node_id, hour_ts) DO UPDATE SET
        p_avg = excluded.p_avg, p_max = excluded.p_max, p_min = excluded.p_min,
        f_avg = excluded.f_avg, f_max = excluded.f_max, samples = excluded.samples
    `
  );

  /* threshold + rare-condition alarms */
  for (const st of states) {
    evaluateThresholds(st, thresholds, now);
    if (rnd() < 0.0008) raiseAlarm(st, "LEAK_SUSPECTED", "critical", st.p, thresholds[st.node.zone].under, now);
    if (rnd() < 0.0006) raiseAlarm(st, "VALVE_ANOMALY", "warning", null, null, now);
  }

  /* retention: prune raw telemetry beyond the configured window */
  s.ticks++;
  if (s.ticks % 900 === 0) {
    const days = getSetting<number>("retention_raw_days", 90);
    db.delete(telemetry).where(lt(telemetry.ts, now - days * 86_400_000)).run();
  }
}

function evaluateThresholds(
  st: SimState,
  th: Thresholds,
  now: number
) {
  const band = th[st.node.zone] ?? th.primary;
  if (st.p > band.over) {
    const dev = st.p - band.over;
    raiseAlarm(
      st,
      "OVER_PRESSURE",
      dev > 1.5 ? "critical" : "warning",
      st.p,
      band.over,
      now
    );
  } else if (st.p < band.under) {
    const dev = band.under - st.p;
    raiseAlarm(
      st,
      "UNDER_PRESSURE",
      dev > 1 ? "critical" : "warning",
      st.p,
      band.under,
      now
    );
  }

  const h = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const expected = st.baseFlow * diurnal(h);
  if (st.node.kind !== "CGS" && expected > 50) {
    if (st.f > expected * 1.35) {
      raiseAlarm(st, "HIGH_FLOW", "warning", st.f, expected * 1.3, now);
    } else if (st.f < expected * 0.55) {
      raiseAlarm(st, "LOW_FLOW", "info", st.f, expected * 0.6, now);
    }
  }
}

function raiseAlarm(
  st: SimState,
  type: AlarmType,
  severity: Severity,
  value: number | null,
  threshold: number | null,
  now: number
) {
  const db = getDb();
  const recent = db
    .select({ id: alarms.id })
    .from(alarms)
    .where(
      and(
        eq(alarms.nodeId, st.node.id),
        eq(alarms.type, type),
        gte(alarms.ts, now - ALARM_COOLDOWN_MS)
      )
    )
    .limit(1)
    .get();
  if (recent) return;

  const v = value != null ? round2(value) : null;
  const limit = threshold != null ? round2(threshold) : null;
  const message = alarmMessage(type, st.node.code, v, limit);
  db.insert(alarms)
    .values({
      nodeId: st.node.id,
      ts: now,
      type,
      severity,
      message,
      value: v,
      threshold: limit,
      status: "open",
    })
    .run();
}

function alarmMessage(
  type: AlarmType,
  code: string,
  v: number | null,
  th: number | null
): string {
  const vs = v != null ? `${v}` : "—";
  const ts = th != null ? `${th}` : "—";
  switch (type) {
    case "OVER_PRESSURE":
      return `${code}: outlet pressure ${vs} bar above limit ${ts} bar`;
    case "UNDER_PRESSURE":
      return `${code}: outlet pressure ${vs} bar below limit ${ts} bar`;
    case "HIGH_FLOW":
      return `${code}: flow ${vs} sm³/h above expected band (max ${ts})`;
    case "LOW_FLOW":
      return `${code}: flow ${vs} sm³/h below expected band (min ${ts})`;
    case "COMM_LOSS":
      return `${code}: RTU communication lost — no telemetry for > 10 min`;
    case "VALVE_ANOMALY":
      return `${code}: valve position mismatch reported by field`;
    case "LEAK_SUSPECTED":
      return `${code}: pressure decay signature suggests possible leak`;
  }
}
