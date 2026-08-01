// The Players area: leaderboards across everyone, one player's career, and a
// side-by-side comparison. All three read the same in-session cache, so moving
// between them doesn't refetch.

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BarChart3, RefreshCw, Users, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeaderboardCard from "@/components/leaderboard-card";
import PlayerDashboard from "@/pages/player-dashboard";
import ComparePlayers from "@/pages/compare-players";
import { TEAM_TEXT_COLORS, teamColorAt } from "@/lib/team-colors";
import { loadAllPlayerStats, clearStatsCache, type StatsBundle } from "@/lib/stats-data";
import {
  computeLeaderboards,
  computeComparison,
  MIN_GAMES_TO_QUALIFY,
  type PlayerDashboard as PlayerDashboardData,
} from "@/lib/player-stats";

interface PlayersScreenProps {
  onBack: () => void;
}

type StatsView = "boards" | "compare";

const MAX_COMPARE = 4;
const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Podium({
  rows,
  onSelectPlayer,
}: {
  rows: Array<{ player: string; display: string; detail?: string }>;
  onSelectPlayer: (name: string) => void;
}) {
  if (rows.length === 0) return null;

  // Second place left, leader centre, third right — the leader reads first.
  const order = rows.length >= 3 ? [rows[1], rows[0], rows[2]] : rows.length === 2 ? [rows[1], rows[0]] : [rows[0]];
  const heights = rows.length >= 3 ? ["h-12", "h-16", "h-9"] : rows.length === 2 ? ["h-12", "h-16"] : ["h-16"];

  return (
    // Fixed column height with a spacer above each block: names and values line
    // up across the three, and the blocks still stand on a shared floor.
    <div className="flex justify-center gap-2 px-2 h-[7.5rem] border-b border-border/60">
      {order.map((row, i) => {
        const isLeader = row.player === rows[0].player;
        return (
          <button
            key={row.player}
            type="button"
            onClick={() => onSelectPlayer(row.player)}
            data-testid={`button-podium-${row.player}`}
            className="flex-1 max-w-[7.5rem] flex flex-col items-center group"
          >
            <span
              className={`font-mono font-bold tabular-nums leading-none ${
                isLeader ? "text-primary text-2xl" : "text-foreground text-lg"
              }`}
            >
              {row.display}
            </span>
            <span className="mt-1 text-xs text-muted-foreground truncate max-w-full group-hover:text-foreground transition-colors">
              {row.player}
            </span>
            <span className="flex-1" />
            <div
              className={`w-full rounded-t-md border-t border-x transition-colors ${heights[i]} ${
                isLeader
                  ? "bg-primary/15 border-primary/30 group-hover:bg-primary/25"
                  : "bg-muted/25 border-border group-hover:bg-muted/40"
              }`}
            >
              {row.detail && (
                <span className="block pt-1.5 text-center text-[10px] font-mono text-muted-foreground/70">
                  {row.detail}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function PlayersScreen({ onBack }: PlayersScreenProps) {
  const [bundle, setBundle] = useState<StatsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<StatsView>("boards");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setBundle(await loadAllPlayerStats());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    clearStatsCache();
    load();
  }, [load]);

  const dashboards = bundle?.dashboards ?? [];
  const withGames = useMemo(() => dashboards.filter(d => d.games > 0), [dashboards]);

  const leaderboards = useMemo(() => computeLeaderboards(withGames), [withGames]);

  const comparison = useMemo(() => {
    if (compareWith.length < 2) return null;
    const picked = compareWith
      .map(name => withGames.find(d => d.name === name))
      .filter((d): d is PlayerDashboardData => Boolean(d));
    if (picked.length < 2) return null;
    return computeComparison(picked, bundle?.summaries ?? []);
  }, [compareWith, withGames, bundle]);

  const selected = selectedPlayer
    ? dashboards.find(d => d.name === selectedPlayer) ?? null
    : null;

  const togglePlayer = (name: string) => {
    setCompareWith(current => {
      if (current.includes(name)) return current.filter(n => n !== name);
      if (current.length >= MAX_COMPARE) return current;
      return [...current, name];
    });
  };

  const handleBack = () => {
    if (selectedPlayer) setSelectedPlayer(null);
    else onBack();
  };

  const winRateBoard = leaderboards.boards.find(b => b.key === "winRate");

  return (
    <main className="h-full flex flex-col">
      <header className="flex items-center gap-2 p-3 border-b border-border">
        <Button
          data-testid="button-players-back"
          variant="ghost"
          size="icon"
          aria-label={selectedPlayer ? "Back to leaderboards" : "Back to home"}
          onClick={handleBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold truncate flex-1">
          {selectedPlayer ?? "Player Stats"}
        </h2>
        <Button
          data-testid="button-players-refresh"
          variant="ghost"
          size="icon"
          aria-label="Reload stats"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {!selectedPlayer && !loading && !failed && withGames.length > 0 && (
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-muted/30">
            {(["boards", "compare"] as StatsView[]).map(mode => (
              <button
                key={mode}
                type="button"
                data-testid={`button-view-${mode}`}
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={`min-h-9 rounded-sm text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  view === mode
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "boards" ? (
                  <>
                    <Trophy className="w-3.5 h-3.5" />
                    Leaderboards
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5" />
                    Compare
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-4 py-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-muted/20 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && failed && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
            <p className="text-sm text-muted-foreground">Couldn't load player stats</p>
            <Button variant="secondary" size="sm" onClick={refresh}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !failed && withGames.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full px-6 text-center"
          >
            <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No games played yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Finish a game and player stats will start building here.
            </p>
          </motion.div>
        )}

        {!loading && !failed && withGames.length > 0 && (
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={`player-${selected.name}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: EASE_OUT_QUINT }}
              >
                <PlayerDashboard data={selected} />
              </motion.div>
            ) : view === "boards" ? (
              <motion.div
                key="boards"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="px-4 py-3 space-y-5"
              >
                <section className="space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 text-center">
                    Win rate
                  </p>
                  <Podium
                    rows={(winRateBoard?.rows ?? []).slice(0, 3)}
                    onSelectPlayer={setSelectedPlayer}
                  />
                </section>

                <div className="flex justify-center gap-4 text-center border-b border-border/60 pb-2.5">
                  {[
                    { label: "Players", value: leaderboards.totals.players },
                    { label: "Games", value: leaderboards.totals.games },
                    { label: "Darts", value: leaderboards.totals.darts },
                  ].map(stat => (
                    <div key={stat.label}>
                      <div className="font-mono text-sm font-semibold text-foreground tabular-nums">
                        {stat.value}
                      </div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {leaderboards.boards.map(board => (
                  <LeaderboardCard
                    key={board.key}
                    board={board}
                    onSelectPlayer={setSelectedPlayer}
                  />
                ))}

                <p className="text-[10px] text-muted-foreground/50 text-center pb-2">
                  Skill boards need {MIN_GAMES_TO_QUALIFY} games of that type to qualify.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="compare"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="px-4 py-3 space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      Pick 2–{MAX_COMPARE} players
                    </p>
                    {compareWith.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCompareWith([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {withGames.map(d => {
                      const index = compareWith.indexOf(d.name);
                      const picked = index >= 0;
                      const atLimit = !picked && compareWith.length >= MAX_COMPARE;
                      return (
                        <button
                          key={d.name}
                          type="button"
                          data-testid={`button-compare-${d.name}`}
                          onClick={() => togglePlayer(d.name)}
                          disabled={atLimit}
                          aria-pressed={picked}
                          className={`min-h-9 px-3 rounded-full border text-xs transition-colors ${
                            picked
                              ? `border-current bg-muted/40 font-medium ${teamColorAt(TEAM_TEXT_COLORS, index)}`
                              : atLimit
                                ? "border-border/40 text-muted-foreground/40"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {comparison ? (
                  <ComparePlayers comparison={comparison} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Choose at least two players to compare
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      You'll see their stats side by side per game type.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </main>
  );
}
