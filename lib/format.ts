const inNumber = new Intl.NumberFormat("en-IN");
const inNumber2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return inNumber.format(Math.round(n));
}

export function fmtDec(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Indian short scale: ₹1.2 Cr / ₹45.5 L / ₹9,400 */
export function inr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `₹${inNumber2.format(amount / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${inNumber2.format(amount / 1e5)} L`;
  return `₹${inNumber.format(Math.round(amount))}`;
}

export function inrFull(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `₹${inNumber.format(Math.round(amount))}`;
}

// Pin display formatting to the operating region. Without an explicit
// timeZone, Node (server) and the browser can resolve different zones, which
// makes SSR text disagree with the first client render (React hydration #418).
const DISPLAY_TZ = "Asia/Kolkata";

const dtFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: DISPLAY_TZ,
});
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: DISPLAY_TZ,
});
const dtTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: DISPLAY_TZ,
});

const DISPLAY_TZ_OFFSET = 5.5 * 60 * 60 * 1000; // Asia/Kolkata

function kolkata(d: Date) {
  return new Date(d.getTime() + DISPLAY_TZ_OFFSET);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = kolkata(new Date(ts));
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = kolkata(new Date(ts));
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = kolkata(new Date(ts));
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  const m = Math.floor(abs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ${suffix}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${suffix}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ${suffix}`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ${suffix}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(y, (m || 1) - 1, 1));
}
