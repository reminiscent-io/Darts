// Two to four players side by side, per game type, plus their head-to-head
// record and overlaid form lines.

import { motion } from "framer-motion";
import { Swords } from "lucide-react";
import TrendChart from "@/components/trend-chart";
import { TEAM_CHART_COLORS, TEAM_TEXT_COLORS, teamColorAt } from "@/lib/team-colors";
import type { Comparison, ComparisonSection } from "@/lib/player-stats";

const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Section({
  section,
  players,
  index,
}: {
  section: ComparisonSection;
  players: string[];
  index: number;
}) {
  const seriesWithData = section.series.filter(s => s.points.length > 1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index, ease: EASE_OUT_QUINT }}
      className="rounded-md border border-border/60 bg-card/40 p-3 space-y-3"
    >
      <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>

      <table className="w-full text-sm">
        <caption className="sr-only">{section.title} comparison</caption>
        <thead>
          <tr>
            <th className="w-[34%]" />
            {players.map((player, i) => (
              <th
                key={player}
                scope="col"
                className={`pb-1.5 text-right text-[11px] font-medium truncate ${teamColorAt(TEAM_TEXT_COLORS, i)}`}
              >
                {player}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.metrics.map(metric => (
            <tr key={metric.key} className="border-t border-border/40">
              <th
                scope="row"
                className="py-1.5 pr-2 text-left text-xs font-normal text-muted-foreground"
              >
                {metric.label}
              </th>
              {metric.displays.map((display, i) => (
                <td
                  key={players[i]}
                  className={`py-1.5 text-right font-mono text-sm tabular-nums ${
                    metric.bestIndex === i ? "text-primary font-semibold" : "text-foreground"
                  }`}
                >
                  {display}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {seriesWithData.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">
            {section.seriesLabel}
          </p>
          <TrendChart
            height={110}
            series={seriesWithData.map(s => ({
              label: s.player,
              points: s.points,
              color: teamColorAt(TEAM_CHART_COLORS, players.indexOf(s.player)),
            }))}
            formatValue={v => (section.key === "cricket" ? v.toFixed(1) : String(Math.round(v)))}
            label={`${section.seriesLabel} for ${seriesWithData.map(s => s.player).join(", ")}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/50">
              each player's own games, oldest → newest
            </span>
            <div className="flex flex-wrap gap-2">
              {seriesWithData.map(s => (
                <span key={s.player} className="inline-flex items-center gap-1 text-[10px]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: teamColorAt(TEAM_CHART_COLORS, players.indexOf(s.player)),
                    }}
                  />
                  <span className="text-muted-foreground">
                    {s.player} ({s.points.length})
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.section>
  );
}

export default function ComparePlayers({ comparison }: { comparison: Comparison }) {
  const { players, sections, headToHead } = comparison;

  return (
    <div className="space-y-4">
      {headToHead.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT_QUINT }}
          className="rounded-md border border-primary/20 bg-primary/[0.06] p-3 space-y-2"
        >
          <div className="flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Head to head</h3>
          </div>
          {headToHead.map(h2h => {
            const total = h2h.aWins + h2h.bWins;
            const aShare = total > 0 ? (h2h.aWins / total) * 100 : 50;
            return (
              <div key={`${h2h.a}-${h2h.b}`} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={teamColorAt(TEAM_TEXT_COLORS, players.indexOf(h2h.a))}>
                    {h2h.a}
                  </span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {h2h.aWins} – {h2h.bWins}
                  </span>
                  <span className={teamColorAt(TEAM_TEXT_COLORS, players.indexOf(h2h.b))}>
                    {h2h.b}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden flex">
                  <div
                    className="h-full"
                    style={{
                      width: `${aShare}%`,
                      background: teamColorAt(TEAM_CHART_COLORS, players.indexOf(h2h.a)),
                    }}
                  />
                  <div
                    className="h-full flex-1"
                    style={{ background: teamColorAt(TEAM_CHART_COLORS, players.indexOf(h2h.b)) }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/60 text-center">
                  {h2h.games} game{h2h.games === 1 ? "" : "s"} on opposite sides
                </p>
              </div>
            );
          })}
        </motion.section>
      )}

      {sections.map((section, i) => (
        <Section key={section.key} section={section} players={players} index={i + 1} />
      ))}
    </div>
  );
}
