import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trophy, RotateCcw, Home } from "lucide-react";
import { X01Game } from "@/lib/types";
import { getX01PlayerStats } from "@/lib/x01-game-logic";

interface X01PostGameScreenProps {
  game: X01Game;
  onRematch: () => void;
  onNewGame: () => void;
  onHome: () => void;
}

export default function X01PostGameScreen({ game, onRematch, onNewGame, onHome }: X01PostGameScreenProps) {
  const winnerTeam = game.teams.find(t => t.id === game.winnerId);
  const isIndividual = game.mode === 'individual';

  const allPlayers = game.teams.flatMap(t =>
    t.players.map(p => ({
      ...p,
      teamName: isIndividual ? '' : t.name,
      teamId: t.id,
      remainingScore: t.remainingScore,
      stats: getX01PlayerStats(game, p.id),
    }))
  );

  const mvp = allPlayers.reduce((best, p) =>
    p.stats.ppd > (best?.stats.ppd || 0) ? p : best
  , allPlayers[0]);

  const teamColors = ['text-primary', 'text-chart-2', 'text-emerald-400', 'text-purple-400', 'text-orange-400', 'text-pink-400'];

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
        <h1 className="text-2xl font-bold font-mono text-primary">
          {isIndividual
            ? winnerTeam?.players[0]?.name || "Winner"
            : winnerTeam?.name || "Winner"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          wins the {game.startingScore} game!
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="px-4 py-3 border-b border-border"
      >
        <div className={`grid gap-4 text-center ${game.teams.length <= 4 ? `grid-cols-${game.teams.length}` : 'grid-cols-3'}`}
          style={{ gridTemplateColumns: `repeat(${Math.min(game.teams.length, 4)}, minmax(0, 1fr))` }}
        >
          {game.teams.map((team, idx) => {
            const isWinner = team.id === game.winnerId;
            return (
              <div key={team.id}>
                <div className={`text-xs font-medium tracking-wider uppercase ${teamColors[idx % teamColors.length]}`}>
                  {isIndividual ? team.players[0]?.name : team.name}
                </div>
                <div className="font-mono text-xl font-bold mt-1">
                  {team.remainingScore === 0 ? (
                    <span className="text-primary">OUT</span>
                  ) : (
                    team.remainingScore
                  )}
                </div>
                {isWinner && (
                  <Trophy className="w-3.5 h-3.5 text-primary mx-auto mt-1" />
                )}
              </div>
            );
          })}
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
                  {!isIndividual && (
                    <span className="text-xs text-muted-foreground">{p.teamName}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-right shrink-0">
                  <div>
                    <div className="text-xs text-muted-foreground">PPD</div>
                    <div className="font-mono text-sm font-semibold">{p.stats.ppd.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">3-Dart</div>
                    <div className="font-mono text-sm font-semibold">{p.stats.threeDartAvg.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Best</div>
                    <div className="font-mono text-sm font-semibold">{p.stats.highestRound}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Darts</div>
                    <div className="font-mono text-sm font-semibold">{p.stats.totalDarts}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="p-4 border-t border-border space-y-2">
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={onRematch}
        >
          <RotateCcw className="w-4 h-4" />
          Rematch
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onNewGame}>
            New Game
          </Button>
          <Button variant="secondary" onClick={onHome}>
            <Home className="w-4 h-4 mr-1" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
