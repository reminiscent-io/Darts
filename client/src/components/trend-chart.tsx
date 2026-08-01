// Line chart for how a metric moves over a player's games. Hand-rolled SVG
// rather than recharts: the stats screens are code-split, and a couple of
// polylines don't justify pulling the chart library into their chunk.

import { movingAverage } from "@/lib/player-stats";

export interface TrendSeries {
  label: string;
  points: number[];
  /** Any CSS color; the stats screens pass the shared chart palette. */
  color: string;
}

interface TrendChartProps {
  series: TrendSeries[];
  /** Rendered height in viewBox units; the chart always fills its width. */
  height?: number;
  /** Overlay a 3-game moving average so a noisy line still shows direction. */
  showAverage?: boolean;
  /** Fill under the line. Only sensible for a single series. */
  showArea?: boolean;
  formatValue?: (value: number) => string;
  label: string;
}

const WIDTH = 320;
const PAD_LEFT = 30;
const PAD_RIGHT = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;
const SMOOTHING_WINDOW = 3;

export default function TrendChart({
  series,
  height = 110,
  showAverage = false,
  showArea = false,
  formatValue = v => String(Math.round(v * 10) / 10),
  label,
}: TrendChartProps) {
  const withPoints = series.filter(s => s.points.length > 0);
  if (withPoints.length === 0) return null;

  const all = withPoints.flatMap(s => s.points);
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  // A flat line still needs a band to sit in.
  const span = rawMax - rawMin || Math.max(rawMax * 0.2, 1);
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;

  const xAt = (index: number, count: number) =>
    PAD_LEFT + (count === 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const yAt = (value: number) =>
    PAD_TOP + plotHeight - ((value - min) / (max - min)) * plotHeight;

  const pointsFor = (values: number[]) =>
    values.map((v, i) => `${xAt(i, values.length).toFixed(2)},${yAt(v).toFixed(2)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="w-full h-auto overflow-visible"
      role="img"
      aria-label={label}
    >
      {/* Baseline and ceiling rules with their values */}
      {[rawMax, rawMin].map((value, i) => (
        <g key={i}>
          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={yAt(value)}
            y2={yAt(value)}
            stroke="hsl(var(--border))"
            strokeWidth="1"
            strokeDasharray={i === 0 ? "3 3" : undefined}
          />
          <text
            x={PAD_LEFT - 6}
            y={yAt(value) + 3}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            fontSize="9"
          >
            {formatValue(value)}
          </text>
        </g>
      ))}

      {withPoints.map(s => {
        const single = s.points.length === 1;
        return (
          <g key={s.label}>
            {showArea && !single && (
              <polygon
                points={`${xAt(0, s.points.length)},${PAD_TOP + plotHeight} ${pointsFor(s.points)} ${xAt(s.points.length - 1, s.points.length)},${PAD_TOP + plotHeight}`}
                fill={s.color}
                opacity={0.12}
              />
            )}
            {showAverage && s.points.length > 2 && (
              <polyline
                points={pointsFor(movingAverage(s.points, SMOOTHING_WINDOW))}
                fill="none"
                stroke={s.color}
                strokeWidth="1.25"
                strokeDasharray="4 3"
                opacity={0.5}
              />
            )}
            {!single && (
              <polyline
                points={pointsFor(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {/* Dots stay legible while the series is short; a long career would
                turn into a solid bar, so they drop out past a dozen games. */}
            {(single || s.points.length <= 12) &&
              s.points.map((v, i) => (
                <circle
                  key={i}
                  cx={xAt(i, s.points.length)}
                  cy={yAt(v)}
                  r={single ? 3 : 2.25}
                  fill={s.color}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
