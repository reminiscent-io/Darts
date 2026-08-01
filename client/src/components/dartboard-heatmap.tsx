// Where a player's darts actually land, drawn on real board geometry: 20
// wedges, triple and double rings, bull. Shots record a target and a
// multiplier but not whether a single was inner or outer, so both single
// bands of a number share that number's single count.

import { formatTargetLabel, type HeatCell } from "@/lib/player-stats";

/** Clockwise from the top of the board. */
const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const WEDGE = 360 / BOARD_ORDER.length;

// Ring radii, outer board = 100. Bull is drawn a touch larger than scale so it
// stays visible at phone size.
const R_OUTER = 100;
const R_DOUBLE_IN = 91;
const R_TRIPLE_OUT = 62;
const R_TRIPLE_IN = 53;
const R_BULL_OUT = 17;
const R_BULL_IN = 8;

interface DartboardHeatmapProps {
  cells: HeatCell[];
  className?: string;
}

function polar(radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [radius * Math.cos(radians), radius * Math.sin(radians)];
}

function sectorPath(rInner: number, rOuter: number, from: number, to: number): string {
  const [x1, y1] = polar(rOuter, from);
  const [x2, y2] = polar(rOuter, to);
  const [x3, y3] = polar(rInner, to);
  const [x4, y4] = polar(rInner, from);
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Amber that deepens with hit count; untouched areas stay near-background. */
function heatFill(count: number, max: number): string {
  if (count <= 0) return "hsl(var(--muted) / 0.5)";
  // Square-root keeps a single hit visible next to a favourite target.
  const intensity = Math.sqrt(count / max);
  return `hsl(var(--primary) / ${(0.12 + intensity * 0.78).toFixed(3)})`;
}

export default function DartboardHeatmap({ cells, className }: DartboardHeatmapProps) {
  const counts = new Map<string, number>();
  for (const cell of cells) {
    counts.set(`${cell.target}|${cell.multiplier}`, cell.count);
  }
  const countFor = (target: string, multiplier: number) => counts.get(`${target}|${multiplier}`) ?? 0;

  const max = cells.reduce((m, c) => Math.max(m, c.count), 0);
  const busiest = [...cells].sort((a, b) => b.count - a.count)[0];

  const label = busiest
    ? `Dartboard heatmap. Most-hit target ${formatTargetLabel(busiest.target, busiest.multiplier)}, ${busiest.count} hits.`
    : "Dartboard heatmap. No darts recorded yet.";

  return (
    <svg
      viewBox="-116 -116 232 232"
      className={className}
      role="img"
      aria-label={label}
    >
      <circle r={R_OUTER} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />

      {BOARD_ORDER.map((number, i) => {
        const from = i * WEDGE - WEDGE / 2;
        const to = from + WEDGE;
        const target = String(number);
        const single = countFor(target, 1);
        const bands: Array<[number, number, number, string]> = [
          [R_DOUBLE_IN, R_OUTER, countFor(target, 2), "double"],
          [R_TRIPLE_OUT, R_DOUBLE_IN, single, "outer single"],
          [R_TRIPLE_IN, R_TRIPLE_OUT, countFor(target, 3), "triple"],
          [R_BULL_OUT, R_TRIPLE_IN, single, "inner single"],
        ];

        return (
          <g key={number}>
            {bands.map(([rIn, rOut, count, band]) => (
              <path
                key={band}
                d={sectorPath(rIn, rOut, from, to)}
                fill={heatFill(count, max)}
                stroke="hsl(var(--background) / 0.55)"
                strokeWidth="0.5"
              />
            ))}
          </g>
        );
      })}

      {/* Bull: outer ring is a single bull, centre is the double. */}
      <circle
        r={R_BULL_OUT}
        fill={heatFill(countFor("B", 1), max)}
        stroke="hsl(var(--background) / 0.55)"
        strokeWidth="0.5"
      />
      <circle
        r={R_BULL_IN}
        fill={heatFill(countFor("B", 2) + countFor("B", 3), max)}
        stroke="hsl(var(--background) / 0.55)"
        strokeWidth="0.5"
      />

      {BOARD_ORDER.map((number, i) => {
        const [x, y] = polar(109, i * WEDGE);
        return (
          <text
            key={number}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground font-mono"
            fontSize="10"
          >
            {number}
          </text>
        );
      })}
    </svg>
  );
}
