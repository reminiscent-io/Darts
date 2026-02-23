import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trophy, RotateCcw, Home } from "lucide-react";
import { CricketGame, CRICKET_NUMBERS } from "@/lib/types";
import { getCricketPlayerStats, isNumberClosedByTeam } from "@/lib/game-logic";

interface CricketPostGameScreenProps {
  game: CricketGame;
  onRematch: () => void;
  onNewGame: () => void;
  onHome: () => void;
}

export default function CricketPostGameScreen({ game, onRematch, onNewGame, onHome }: CricketPostGameScreenProps) {
  const winnerTeam = game.teams.find(t => t.id === game.winnerId);

  const allPlayers = game.teams.flatMap(t =>
    t.players.map(p => ({
      ...p,
      teamName: t.name,
      teamId: t.id,
      stats: getCricketPlayerStats(game, p.id),
    }))
  );

  const mvp = allPlayers.reduce((best, p) =>
    p.stats.mpr > (best?.stats.mpr || 0) ? p : best
  , allPlayers[0]);

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-6 px-4 border-b border-border"
      >
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
          <Trophy className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-mono text-primary" data-testid="text-winner-name">
          {winnerTeam?.name || "Winner"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">wins the match</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-4 py-3 border-b border-border"
      >
        <div className="grid grid-cols-2 gap-4 text-center">
          {game.teams.map((team, idx) => (
            <div key={team.id}>
              <div className={`text-xs font-medium tracking-wider uppercase ${
                idx === 0 ? 'text-primary' : 'text-chart-2'
              }`}>
                {team.name}
              </div>
              <div className="font-mono text-xl font-bold mt-1" data-testid={`text-final-score-team${idx + 1}`}>
                {team.points}
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {CRICKET_NUMBERS.map((num) => (
                  <div
                    key={String(num)}
                    className={`w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-mono ${
                      isNumberClosedByTeam(team, num)
                        ? 'bg-primary/30 text-primary'
                        : 'bg-muted/50 text-muted-foreground/40'
                    }`}
                  >
                    {num === 'B' ? 'B' : num}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="px-4 py-3 flex-1"
      >
        <h3 className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-3">
          Player Stats
        </h3>
        <div className="space-y-2">
          {allPlayers.map((p) => {
            const isMvp = p.id === mvp?.id;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between py-2 px-3 rounded-md ${
                  isMvp ? 'bg-primary/8 border border-primary/20' : 'bg-muted/20'
                }`}
                data-testid={`stat-player-${p.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {isMvp && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded-sm tracking-wider">
                        MVP
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{p.teamName}</span>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <div className="text-xs text-muted-foreground">MPR</div>
                    <div className="font-mono text-sm font-semibold">{p.stats.mpr.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pts</div>
                    <div className="font-mono text-sm font-semibold">{p.stats.pointsContributed}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Marks</div>
                    <div className="font-mono text-sm font-semibold">{p.stats.totalMarks}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="p-4 border-t border-border space-y-2">
        <Button
          data-testid="button-rematch"
          size="lg"
          className="w-full gap-2"
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
      </div>
    </div>
  );
}
