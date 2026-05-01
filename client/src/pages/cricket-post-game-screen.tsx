import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { RotateCcw, Home } from "lucide-react";
import { CricketGame, CRICKET_NUMBERS } from "@/lib/types";
import { getCricketPlayerStats, isNumberClosedByTeam } from "@/lib/game-logic";

interface CricketPostGameScreenProps {
  game: CricketGame;
  onRematch: () => void;
  onNewGame: () => void;
  onHome: () => void;
}

const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

function BullseyeBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
      width="420"
      height="420"
      viewBox="-160 -160 320 320"
      aria-hidden="true"
    >
      <motion.g
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT_QUINT }}
      >
        <circle r="150" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
        <circle r="110" fill="none" stroke="hsl(var(--primary) / 0.12)" strokeWidth="1" />
        <circle r="70" fill="none" stroke="hsl(var(--primary) / 0.22)" strokeWidth="1.5" />
        <circle r="32" fill="none" stroke="hsl(var(--primary) / 0.45)" strokeWidth="1.5" />
        <circle r="6" fill="hsl(var(--primary) / 0.6)" />
      </motion.g>
    </svg>
  );
}

export default function CricketPostGameScreen({ game, onRematch, onNewGame, onHome }: CricketPostGameScreenProps) {
  const winnerTeam = game.teams.find(t => t.id === game.winnerId);
  const isSolo = game.mode === 'solo';

  const allPlayers = game.teams.flatMap(t =>
    t.players.map(p => ({
      ...p,
      teamName: t.name,
      teamId: t.id,
      isWinner: t.id === game.winnerId,
      stats: getCricketPlayerStats(game, p.id),
    }))
  );

  const mvp = allPlayers.reduce((best, p) =>
    p.stats.mpr > (best?.stats.mpr || 0) ? p : best
  , allPlayers[0]);

  const rankedPlayers = [...allPlayers].sort((a, b) => b.stats.mpr - a.stats.mpr);

  const teamColors = ['text-primary', 'text-chart-2', 'text-chart-4', 'text-chart-3', 'text-chart-5'];
  const teamColorFor = (teamId: string) => {
    const idx = game.teams.findIndex(t => t.id === teamId);
    return teamColors[idx % teamColors.length];
  };

  const winnerName = winnerTeam?.name || "Winner";
  const winnerInitial = (mvp?.name || winnerName).slice(0, 1).toUpperCase();

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Hero — Game Shot */}
      <section className="relative overflow-hidden px-4 pt-10 pb-8 border-b border-border">
        <BullseyeBackdrop />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE_OUT_QUINT }}
          className="relative text-center"
        >
          <div className="text-[11px] font-semibold tracking-[0.32em] text-primary/70 uppercase">
            Game Shot
          </div>
          <h1
            className="font-mono font-extrabold text-primary leading-[0.95] tracking-tight mt-2 text-[clamp(2.75rem,12vw,5rem)] break-words"
            data-testid="text-winner-name"
          >
            {winnerName}
          </h1>
          <p className="text-xs text-muted-foreground mt-3 tracking-wide">
            {isSolo ? 'closed every number' : 'wins the match'}
          </p>
        </motion.div>
      </section>

      {/* Score slab */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25, ease: EASE_OUT_QUINT }}
        className="border-b border-border"
      >
        <ul className="divide-y divide-border">
          {game.teams.map((team) => {
            const isWinner = team.id === game.winnerId;
            return (
              <li
                key={team.id}
                className={`px-4 py-4 ${isWinner ? 'bg-primary/[0.06]' : ''}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className={`text-[10px] font-semibold tracking-[0.28em] uppercase ${
                      isWinner ? teamColorFor(team.id) : 'text-muted-foreground/70'
                    }`}>
                      {team.name}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {CRICKET_NUMBERS.map((num) => {
                        const closed = isNumberClosedByTeam(team, num);
                        return (
                          <div
                            key={String(num)}
                            className={`w-7 h-7 rounded-sm flex items-center justify-center font-mono text-[11px] font-semibold ${
                              closed
                                ? isWinner
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground/70'
                                : 'bg-transparent border border-border text-muted-foreground/40'
                            }`}
                          >
                            {num === 'B' ? 'B' : num}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    className={`font-mono text-5xl font-bold tabular-nums tracking-tight shrink-0 ${
                      isWinner ? 'text-foreground' : 'text-muted-foreground/45'
                    }`}
                    data-testid={`text-final-score-${team.id}`}
                  >
                    {team.points}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </motion.section>

      {/* MVP band */}
      {mvp && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4, ease: EASE_OUT_QUINT }}
          className="px-4 py-5 border-b border-border"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="font-mono text-xl font-bold text-primary">{winnerInitial}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold tracking-[0.28em] text-primary/70 uppercase">
                Top of the oche
              </div>
              <div className="text-base font-semibold truncate mt-0.5">{mvp.name}</div>
              {!isSolo && (
                <div className="text-xs text-muted-foreground truncate">{mvp.teamName}</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-3xl font-bold tabular-nums text-primary">
                {mvp.stats.mpr.toFixed(2)}
              </div>
              <div className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase mt-0.5">
                Marks / round
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Stats table */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.55, ease: EASE_OUT_QUINT }}
        className="flex-1 px-4 py-4"
      >
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline pb-2 border-b border-border">
          <span className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Player
          </span>
          <span className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase text-right">
            MPR
          </span>
          <span className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase text-right">
            Pts
          </span>
          <span className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase text-right">
            Marks
          </span>
        </div>
        <ul>
          {rankedPlayers.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.6 + i * 0.04, ease: EASE_OUT_QUINT }}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline py-2.5 border-b border-border/50 ${
                p.isWinner ? 'bg-primary/[0.04] -mx-4 px-4' : ''
              }`}
              data-testid={`stat-player-${p.id}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] tabular-nums w-4 ${
                    p.isWinner ? 'text-primary' : 'text-muted-foreground/60'
                  }`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-medium truncate">{p.name}</span>
                </div>
                {!isSolo && (
                  <span className="text-[11px] text-muted-foreground/70 truncate ml-6 block">
                    {p.teamName}
                  </span>
                )}
              </div>
              <span className={`font-mono text-sm font-semibold tabular-nums text-right ${
                p.isWinner ? 'text-foreground' : 'text-foreground/85'
              }`}>
                {p.stats.mpr.toFixed(2)}
              </span>
              <span className="font-mono text-sm tabular-nums text-right text-foreground/85">
                {p.stats.pointsContributed}
              </span>
              <span className="font-mono text-sm tabular-nums text-right text-foreground/85">
                {p.stats.totalMarks}
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.7, ease: EASE_OUT_QUINT }}
        className="p-4 border-t border-border space-y-2"
      >
        <Button
          data-testid="button-rematch"
          size="lg"
          className="w-full gap-2 h-14 text-sm font-bold tracking-[0.18em] uppercase"
          onClick={onRematch}
        >
          <RotateCcw className="w-4 h-4" />
          Rematch
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            data-testid="button-new-game-post"
            variant="secondary"
            onClick={onNewGame}
          >
            New Game
          </Button>
          <Button
            data-testid="button-home-post"
            variant="secondary"
            onClick={onHome}
          >
            <Home className="w-4 h-4 mr-1" />
            Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
