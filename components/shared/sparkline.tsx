import { cn } from "cn";

/** Minimal SVG sparkline — no chart library overhead. */
export function Sparkline({
  data,
  height = 44,
  color = "var(--chart-1)",
  fill = true,
  className,
  valueSuffix,
}: {
  data: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  className?: string;
  valueSuffix?: string;
}) {
  if (data.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        awaiting samples
      </div>
    );
  }

  const w = 100; // viewBox units; scales to container width
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const line = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M ${x(0)},${height} L ${line.split(" ").join(" L ")} L ${x(data.length - 1)},${height} Z`;

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        {fill ? (
          <path d={area} fill={color} fillOpacity={0.12} />
        ) : null}
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <span className="pointer-events-none absolute top-0 right-0 font-mono text-[10px] text-muted-foreground tnum">
        {max.toFixed(max >= 100 ? 0 : 1)}
        {valueSuffix}
      </span>
      <span className="pointer-events-none absolute bottom-0 right-0 font-mono text-[10px] text-muted-foreground/60 tnum">
        {min.toFixed(min >= 100 ? 0 : 1)}
        {valueSuffix}
      </span>
    </div>
  );
}
