// One player's career: how they're throwing now versus how they were, split by
// game type, with the board they actually hit.

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import TrendChart from "@/components/trend-chart";
import DartboardHeatmap from "@/components/dartboard-heatmap";
import { TEAM_CHART_COLORS } from "@/lib/team-colors";
import {
  formatPct,
  RECENT_FORM_WINDOW,
  type GameTypeStats,
  type PlayerDashboard as PlayerDashboardData,
} from "@/lib/player-stats";

const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const GAME_TYPE_LABEL: Record<string, string> = { cricket: "Cricket", x01: "X01" };

function headlineLabel(gameType: string): string {
  return gameType === "cricket" ? "MPR" : "3-dart average";
}

function formatHeadline(stats: GameTypeStats): string {
  return stats.gameType === "cricket" ? stats.headline.toFixed(2) : stats.headline.toFixed(1);
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-md bg-muted/20 px-3 py-2.5 text-center">
      <div className="font-mono text-xl font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mt-0.5">
        {label}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</div>}
    </div>
  );
}

function FormBadge({ stats }: { stats: GameTypeStats }) {
  if (stats.delta === null) {
    return (
      <span className="text-[11px] text-muted-foreground/60">
        {stats.games} game{stats.games === 1 ? "" : "s"} so far
      </span>
    );
  }

  const decimals = stats.gameType === "cricket" ? 2 : 1;
  const rising = stats.delta > 0;
  const flat = Math.abs(stats.delta) < (stats.gameType === "cricket" ? 0.05 : 0.5);
  const Icon = flat ? Minus : rising ? TrendingUp : TrendingDown;
  const tone = flat ? "text-muted-foreground" : rising ? "text-chart-4" : "text-chart-5";

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-mono ${tone}`}>
      <Icon className="w-3 h-3" />
      {flat ? "steady" : `${rising ? "+" : ""}${stats.delta.toFixed(decimals)}`}
      <span className="text-muted-foreground/60">
        last {Math.min(RECENT_FORM_WINDOW, stats.games)} vs earlier
      </span>
    </span>
  );
}

function GameTypeCard({ stats, index }: { stats: GameTypeStats; index: number }) {
  const color = TEAM_CHART_COLORS[index % TEAM_CHART_COLORS.length];

  const secondary =
    stats.gameType === "cricket"
      ? [
          { label: "Best game", value: stats.best.toFixed(2) },
          { label: "Total marks", value: String(stats.totalMarks) },
          { label: "Accuracy", value: formatPct(stats.hitPct) },
        ]
      : [
          { label: "Best game", value: stats.best.toFixed(1) },
          { label: "Highest round", value: String(stats.highestRound) },
          { label: "Bust rate", value: formatPct(stats.bustRate) },
        ];

  return (
    <section className="rounded-md border border-border/60 bg-card/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {GAME_TYPE_LABEL[stats.gameType]}
          </h3>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mt-0.5">
            {stats.games} game{stats.games === 1 ? "" : "s"}
            {stats.winPct !== null && ` · ${stats.wins}-${stats.losses}`}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-primary tabular-nums leading-none">
            {formatHeadline(stats)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mt-1">
            {headlineLabel(stats.gameType)}
          </div>
        </div>
      </div>

      {stats.trend.length > 1 && (
        <div>
          <TrendChart
            series={[{ label: GAME_TYPE_LABEL[stats.gameType], points: stats.trend, color }]}
            height={90}
            showArea
            showAverage
            formatValue={v => (stats.gameType === "cricket" ? v.toFixed(1) : String(Math.round(v)))}
            label={`${headlineLabel(stats.gameType)} across ${stats.games} ${GAME_TYPE_LABEL[stats.gameType]} games, oldest to newest`}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground/50">oldest → newest</span>
            <FormBadge stats={stats} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {secondary.map(item => (
          <div key={item.label} className="rounded-md bg-muted/20 px-2 py-1.5 text-center">
            <div className="font-mono text-sm font-semibold text-foreground tabular-nums">
              {item.value}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mt-0.5">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PlayerDashboard({ data }: { data: PlayerDashboardData }) {
  const played = [data.cricket, data.x01].filter(Boolean) as GameTypeStats[];
  const missing = (["cricket", "x01"] as const).filter(t => !data[t]);

  if (data.games === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">No games recorded for {data.name} yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Stats appear once they finish a game.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT_QUINT }}
        className="flex gap-2"
      >
        <Kpi
          label="Win rate"
          value={data.winPct === null ? "—" : formatPct(data.winPct)}
          sub={data.winPct === null ? "no decided games" : `${data.wins}-${data.losses}`}
        />
        <Kpi label="Games" value={String(data.games)} sub={`${data.darts} darts`} />
        <Kpi label="Accuracy" value={data.darts > 0 ? formatPct(data.hitPct) : "—"} sub="on target" />
      </motion.div>

      {played.map((stats, i) => (
        <motion.div
          key={stats.gameType}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 * (i + 1), ease: EASE_OUT_QUINT }}
        >
          <GameTypeCard stats={stats} index={i} />
        </motion.div>
      ))}

      {missing.map(gameType => (
        <p key={gameType} className="text-xs text-muted-foreground/60 px-1">
          No {GAME_TYPE_LABEL[gameType]} games yet.
        </p>
      ))}

      {data.heatmap.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: EASE_OUT_QUINT }}
          className="rounded-md border border-border/60 bg-card/40 p-3 space-y-3"
        >
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-foreground">Where the darts land</h3>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              All games
            </span>
          </div>
          <DartboardHeatmap cells={data.heatmap} className="w-full max-w-[260px] mx-auto" />
          <div className="flex flex-wrap gap-1.5 justify-center">
            {data.topTargets.map(target => (
              <span
                key={`${target.target}-${target.multiplier}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-1"
              >
                <span className="font-mono text-xs font-semibold text-primary">{target.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">×{target.count}</span>
              </span>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
