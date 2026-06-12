// Single source of truth for team/player color assignment.
// Order matches the post-game screens: amber, cyan, emerald, violet, coral.
// Teams beyond five cycle back through the palette.

export const TEAM_TEXT_COLORS = [
  "text-primary",
  "text-chart-2",
  "text-chart-4",
  "text-chart-3",
  "text-chart-5",
];

export const TEAM_BG_COLORS = [
  "bg-primary",
  "bg-chart-2",
  "bg-chart-4",
  "bg-chart-3",
  "bg-chart-5",
];

export const TEAM_HIGHLIGHT_CLASSES = [
  "bg-primary/15 ring-2 ring-inset ring-primary/50",
  "bg-chart-2/15 ring-2 ring-inset ring-chart-2/50",
  "bg-chart-4/15 ring-2 ring-inset ring-chart-4/50",
  "bg-chart-3/15 ring-2 ring-inset ring-chart-3/50",
  "bg-chart-5/15 ring-2 ring-inset ring-chart-5/50",
];

export const TEAM_ACTIVE_TURN_CLASSES = [
  "bg-primary/10",
  "bg-chart-2/10",
  "bg-chart-4/10",
  "bg-chart-3/10",
  "bg-chart-5/10",
];

// CSS variable references for chart strokes, kept in lockstep with the classes above.
export const TEAM_CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-5))",
];

export function teamColorAt<T>(palette: T[], index: number): T {
  return palette[index % palette.length];
}
