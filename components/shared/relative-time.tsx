"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/**
 * Relative timestamps depend on the client clock (`Date.now()`), so rendering
 * them during SSR makes the server text disagree with the first client render
 * (React hydration #418). Render the fallback on the server and first client
 * pass, then swap in the live value after mount.
 *
 * The state update happens inside a timer callback rather than the effect body
 * so it never triggers a synchronous cascading render.
 */
export function RelativeTime({
  ts,
  fallback = "—",
  className,
}: {
  ts: number | null | undefined;
  fallback?: string;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setText(timeAgo(ts));
    // Kick off in a macrotask so the first paint stays stable, then refresh so
    // "just now" becomes "2 min ago" without needing a re-render from above.
    const kick = setTimeout(update, 0);
    const id = setInterval(update, 30_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [ts]);

  return <span className={className}>{text ?? fallback}</span>;
}
