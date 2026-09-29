"use client";

import { useEffect, useState } from "react";

function format(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // kick off immediately via a macrotask so the first paint is stable
    const kick = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  const date = now
    ? now.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <div
      className="hidden h-8 items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 font-mono text-xs text-muted-foreground md:flex"
      title={date}
    >
      <span className="tnum text-foreground/80">{now ? format(now) : "--:--:--"}</span>
      <span className="hidden xl:inline">{date}</span>
    </div>
  );
}
