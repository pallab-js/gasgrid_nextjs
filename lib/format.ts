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

const dtFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dtTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return dtFmt.format(new Date(ts));
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return timeFmt.format(new Date(ts));
}

export function fmtDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return dtTimeFmt.format(new Date(ts));
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
