import { cn } from "cn";

/** Semicircular SVG gauge with a healthy band. Toned-down, data-dense. */
export function Gauge({
  value,
  min,
  max,
  band,
  unit = "bar",
  label,
  size = 168,
  className,
}: {
  value: number | null;
  min: number;
  max: number;
  band?: { under: number; over: number };
  unit?: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  const clamped = value == null ? min : Math.min(Math.max(value, min), max);
  const pctPos = (clamped - min) / (max - min);

  const stroke = 12;
  const r = (size - stroke) / 2 - 6;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const start = Math.PI; // 180°
  const end = 2 * Math.PI; // 0°

  const arcPath = (from: number, to: number) => {
    const x1 = cx + r * Math.cos(from);
    const y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(to);
    const y2 = cy + r * Math.sin(to);
    const large = to - from > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const inBand =
    !band || (value != null && value >= band.under && value <= band.over);
  const color =
    value == null
      ? "text-muted-foreground"
      : inBand
        ? "text-success"
        : "text-destructive";

  const valueAngle = start + (end - start) * pctPos;

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="img"
      aria-label={`${label ?? "gauge"}: ${value ?? "—"} ${unit}`}
    >
      <svg width={size} height={size / 2 + 26} viewBox={`0 0 ${size} ${size / 2 + 26}`}>
        {/* track */}
        <path
          d={arcPath(start, end)}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* band indicator */}
        {band ? (
          <path
            d={arcPath(
              start + (end - start) * ((band.under - min) / (max - min)),
              start + (end - start) * ((band.over - min) / (max - min))
            )}
            fill="none"
            stroke="var(--success)"
            strokeOpacity={0.25}
            strokeWidth={stroke}
          />
        ) : null}
        {/* value arc */}
        {value != null ? (
          <path
            d={arcPath(start, valueAngle)}
            fill="none"
            stroke="currentColor"
            className={cn("transition-all duration-500", color)}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        ) : null}
        {/* needle */}
        {value != null ? (
          <circle
            cx={cx + (r - 2) * Math.cos(valueAngle)}
            cy={cy + (r - 2) * Math.sin(valueAngle)}
            r={5}
            className={cn("fill-current", color)}
            stroke="var(--card)"
            strokeWidth={2}
          />
        ) : null}
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          className={cn(
            "fill-current font-mono text-2xl font-semibold tnum",
            color
          )}
        >
          {value != null ? value.toFixed(1) : "—"}
        </text>
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-muted-foreground text-xs"
        >
          {unit}
        </text>
        <text x={cx - r} y={cy + 16} textAnchor="middle" className="fill-muted-foreground/70 text-[10px] font-mono">
          {min}
        </text>
        <text x={cx + r} y={cy + 16} textAnchor="middle" className="fill-muted-foreground/70 text-[10px] font-mono">
          {max}
        </text>
      </svg>
      {label ? (
        <p className="-mt-1 text-xs text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
