import { useState, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, ChevronRight, X, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig
} from "@/components/ui/chart";
import { X01Game, Multiplier } from "@/lib/types";
import {
  getCurrentPlayer, advanceTurn, saveGame, confirmWin, formatDart
} from "@/lib/game-logic";
import {
  recordX01Dart, undoLastX01Dart, removeX01DartAtIndex,
  getX01PlayerStats, getCurrentTurnTotal
} from "@/lib/x01-game-logic";

interface X01GameScreenProps {
  game: X01Game;
  onGameUpdate: (game: X01Game) => void;
  onGameEnd: (game: X01Game) => void;
}

export default function X01GameScreen({ game, onGameUpdate, onGameEnd }: X01GameScreenProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [pendingWin, setPendingWin] = useState<{ teamId: string; teamName: string } | null>(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoPrevPlayerName, setUndoPrevPlayerName] = useState("");
  const [bustFlash, setBustFlash] = useState(false);
  const lastDartTime = useRef(0);

  const { player: currentPlayer, teamIndex: currentTeamIndex } = getCurrentPlayer(game);
  const currentTeam = game.teams[currentTeamIndex];
  const dartsThrown = game.currentTurnDarts.length;
  const roundTotal = getCurrentTurnTotal(game);

  const upcomingPlayers = useMemo(() => {
    const orderLen = game.turnOrder.length;
    const result = [];
    for (let i = 1; i < orderLen; i++) {
      const ref = game.turnOrder[(game.currentTurnIndex + i) % orderLen];
      const team = game.teams[ref.teamIndex];
      const player = team.players.find(p => p.id === ref.playerId)!;
      const stats = getX01PlayerStats(game, player.id);
      result.push({
        player,
        teamIndex: ref.teamIndex,
        remaining: team.remainingScore,
        ppd: stats.ppd,
      });
    }
    return result;
  }, [game]);

  const handleDartEntry = useCallback((target: number | 'B' | 'miss', mult: Multiplier) => {
    const now = Date.now();
    if (now - lastDartTime.current < 250) return;
    if (dartsThrown >= 3) return;
    if (game.status === 'completed') return;
    lastDartTime.current = now;

    const result = recordX01Dart(game, target, mult);
    setMultiplier(1);

    if (result.isBust) {
      setBustFlash(true);
      setTimeout(() => setBustFlash(false), 1200);
      onGameUpdate(result.game);
      saveGame(result.game);
      return;
    }

    if (result.isWin) {
      setPendingWin({ teamId: currentTeam.id, teamName: currentTeam.name });
    }
    onGameUpdate(result.game);
    saveGame(result.game);
  }, [game, dartsThrown, currentTeam, onGameUpdate]);

  const handleNumberTap = (num: number) => {
    handleDartEntry(num, multiplier);
  };

  const handleBull = (double: boolean) => {
    handleDartEntry('B', double ? 2 : 1);
  };

  const handleMiss = () => {
    handleDartEntry('miss', 1);
  };

  const handleUndo = () => {
    if (game.currentTurnDarts.length === 0 && game.dartHistory.length > 0) {
      const prevIdx = (game.currentTurnIndex - 1 + game.turnOrder.length) % game.turnOrder.length;
      const prevRef = game.turnOrder[prevIdx];
      const prevTeam = game.teams[prevRef.teamIndex];
      const prevPlayer = prevTeam.players.find(p => p.id === prevRef.playerId);
      setUndoPrevPlayerName(prevPlayer?.name || "previous player");
      setShowUndoConfirm(true);
      return;
    }

    const result = undoLastX01Dart(game);
    setPendingWin(null);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleConfirmUndo = () => {
    const result = undoLastX01Dart(game);
    setPendingWin(null);
    setShowUndoConfirm(false);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleRemoveDart = (index: number) => {
    const updated = removeX01DartAtIndex(game, index);
    setPendingWin(null);
    onGameUpdate(updated);
    saveGame(updated);
  };

  const handleNextPlayer = () => {
    const updated = advanceTurn(game) as X01Game;
    onGameUpdate(updated);
    saveGame(updated);
    setMultiplier(1);
  };

  const handleConfirmWin = () => {
    if (!pendingWin) return;
    const finalGame = confirmWin(game, pendingWin.teamId) as X01Game;
    onGameUpdate(finalGame);
    saveGame(finalGame);
    onGameEnd(finalGame);
  };

  const handleCancelWin = () => {
    setPendingWin(null);
  };

  const isInputDisabled = game.status === 'completed' || pendingWin !== null;
  const isIndividual = game.mode === 'individual';

  // Team colors for multi-team/player support
  const teamColors = ['text-primary', 'text-chart-2', 'text-emerald-400', 'text-purple-400', 'text-orange-400', 'text-pink-400', 'text-cyan-400', 'text-yellow-400'];
  const teamBgColors = ['bg-primary', 'bg-chart-2', 'bg-emerald-400', 'bg-purple-400', 'bg-orange-400', 'bg-pink-400', 'bg-cyan-400', 'bg-yellow-400'];

  // Chart data
  const { chartData, chartConfig, hasActivity, chartDomain } = useMemo(() => {
    const allDarts = game.dartHistory;
    const teamIds = game.teams.map(t => t.id);
    const remaining: Record<string, number> = {};
    teamIds.forEach(id => { remaining[id] = game.startingScore; });

    const data: Array<Record<string, number>> = [
      { dart: 0, ...Object.fromEntries(teamIds.map(id => [id, game.startingScore])) }
    ];

    let hasAny = false;
    for (let i = 0; i < allDarts.length; i++) {
      const dart = allDarts[i];
      if (!dart.isBust && dart.pointsScored > 0) {
        remaining[dart.teamId] = Math.max(0, (remaining[dart.teamId] || game.startingScore) - dart.pointsScored);
        hasAny = true;
      }
      data.push({
        dart: i + 1,
        ...Object.fromEntries(teamIds.map(id => [id, remaining[id]]))
      });
    }

    // Dynamic Y-axis domain: zoom into the actual score range
    const minRemaining = Math.min(...teamIds.map(id => remaining[id]));
    const scoreRange = game.startingScore - minRemaining;
    // Add 20% padding below the lowest score, with a minimum of 10% of starting score
    const padding = Math.max(scoreRange * 0.2, game.startingScore * 0.1);
    const domainMin = Math.max(0, minRemaining - padding);
    // Use full [0, startingScore] once scores have dropped past halfway
    const domain: [number, number] = minRemaining <= game.startingScore * 0.5
      ? [0, game.startingScore]
      : [domainMin, game.startingScore];

    const config: ChartConfig = {};
    const hues = [38, 195, 150, 280, 25, 330, 185, 55];
    game.teams.forEach((t, idx) => {
      config[t.id] = {
        label: isIndividual ? t.players[0]?.name || t.name : t.name,
        color: `hsl(${hues[idx % hues.length]} 85% 55%)`,
      };
    });

    return { chartData: data, chartConfig: config, hasActivity: hasAny, chartDomain: domain };
  }, [game.dartHistory, game.currentTurnDarts, game.teams, game.startingScore, isIndividual]);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ touchAction: 'manipulation' }}>
      {/* Score Header */}
      {isIndividual ? (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border overflow-x-auto flex-shrink-0">
          {game.teams.map((team, idx) => (
            <div
              key={team.id}
              className={`flex flex-col items-center px-3 py-1 rounded-md min-w-[64px] shrink-0 ${
                currentTeamIndex === idx ? 'bg-muted/40' : ''
              }`}
            >
              <div className={`text-[10px] font-medium tracking-wider uppercase truncate ${teamColors[idx % teamColors.length]}`}>
                {team.players[0]?.name || team.name}
              </div>
              <div className="font-mono text-2xl font-bold tabular-nums">
                {team.remainingScore}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex border-b border-border flex-shrink-0">
          <div className={`flex-1 flex flex-col items-center justify-center py-2 ${
            currentTeamIndex === 0 ? 'bg-muted/30' : ''
          }`}>
            <div className="text-xs font-medium tracking-wider uppercase truncate text-primary">
              {game.teams[0].name}
            </div>
            <div className="font-mono text-3xl font-bold tabular-nums">
              {game.teams[0].remainingScore}
            </div>
          </div>
          <div className="w-px bg-border" />
          <div className={`flex-1 flex flex-col items-center justify-center py-2 ${
            currentTeamIndex === 1 ? 'bg-muted/30' : ''
          }`}>
            <div className="text-xs font-medium tracking-wider uppercase truncate text-chart-2">
              {game.teams[1].name}
            </div>
            <div className="font-mono text-3xl font-bold tabular-nums">
              {game.teams[1].remainingScore}
            </div>
          </div>
        </div>
      )}

      {/* Current player + dart counter */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${teamBgColors[currentTeamIndex % teamBgColors.length]}`} />
          <span className="text-sm font-medium truncate" data-testid="text-current-player">
            {currentPlayer.name}
          </span>
          {roundTotal > 0 && (
            <span className="text-xs font-mono text-muted-foreground ml-1">({roundTotal})</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" data-testid="dart-counter">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                i < dartsThrown ? 'bg-primary' : 'bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Upcoming player rotation */}
      <div className="flex items-center gap-3 px-3 py-1 border-b border-border overflow-x-auto">
        {upcomingPlayers.map((up, i) => (
          <div key={`${up.player.id}-${i}`} className="flex items-center gap-1.5 shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${teamBgColors[up.teamIndex % teamBgColors.length]}`} />
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
              {up.player.name}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums">
              {up.remaining}
            </span>
          </div>
        ))}
      </div>

      {/* Dart tray */}
      <div className="min-h-[36px] flex items-center gap-1.5 px-3 py-1 border-b border-border bg-muted/10 overflow-x-auto">
        <span className="text-xs text-muted-foreground/60 shrink-0 mr-1">Darts:</span>
        <AnimatePresence mode="popLayout">
          {game.currentTurnDarts.map((dart, idx) => (
            <motion.button
              key={dart.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleRemoveDart(idx)}
              className="flex items-center gap-1 bg-secondary rounded-md px-2 py-1 text-xs font-mono font-medium text-secondary-foreground shrink-0"
            >
              {formatDart(dart)}
              <X className="w-3 h-3 text-muted-foreground" />
            </motion.button>
          ))}
        </AnimatePresence>
        {dartsThrown === 0 && (
          <span className="text-xs text-muted-foreground/30 italic">no darts thrown</span>
        )}
      </div>

      {/* Score Progression Chart */}
      <div className="flex-1 min-h-0 flex py-1">
        <div className="flex-1 min-w-0 pl-2">
          {hasActivity ? (
            <ChartContainer config={chartConfig} className="h-full w-full !aspect-auto">
              <LineChart data={chartData}>
                <XAxis dataKey="dart" hide />
                <YAxis hide domain={chartDomain} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {game.teams.map((team) => (
                  <Line
                    key={team.id}
                    dataKey={team.id}
                    type="monotone"
                    stroke={`var(--color-${team.id})`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-xs text-muted-foreground/30 italic">score chart appears here</span>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between shrink-0 w-10 py-2 pr-2">
          {game.teams.slice(0, 2).map((team, idx) => (
            <span key={team.id} className={`font-mono text-xs font-bold tabular-nums ${teamColors[idx % teamColors.length]}`}>
              {team.remainingScore}
            </span>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 flex flex-col px-2 pb-2 gap-1.5 pt-1.5">
        {/* Row 1: Miss, SB, DB */}
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-muted-foreground text-xs"
            disabled={isInputDisabled || dartsThrown >= 3}
            onClick={handleMiss}
          >
            Miss
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            disabled={isInputDisabled || dartsThrown >= 3}
            onClick={() => handleBull(false)}
          >
            SB
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            disabled={isInputDisabled || dartsThrown >= 3}
            onClick={() => handleBull(true)}
          >
            DB
          </Button>
        </div>

        {/* Number pad: 4x5 grid */}
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
            <Button
              key={num}
              variant="secondary"
              size="sm"
              className="font-mono text-sm font-bold py-2.5"
              disabled={isInputDisabled || dartsThrown >= 3}
              onClick={() => handleNumberTap(num)}
            >
              {num}
            </Button>
          ))}
        </div>

        {/* Multiplier buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          {([1, 2, 3] as Multiplier[]).map((m) => (
            <Button
              key={m}
              disabled={isInputDisabled || dartsThrown >= 3}
              onClick={() => setMultiplier(m)}
              variant={multiplier === m ? 'default' : 'secondary'}
              size="sm"
              className={`text-xs font-semibold tracking-wide ${
                multiplier === m ? '' : 'text-muted-foreground'
              }`}
            >
              {m === 1 ? 'SINGLE' : m === 2 ? 'DOUBLE' : 'TRIPLE'}
            </Button>
          ))}
        </div>

        {/* Undo + Next */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 gap-1 text-xs"
            disabled={game.dartHistory.length === 0 || isInputDisabled}
            onClick={handleUndo}
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </Button>
          <Button
            size="sm"
            className="flex-[2] gap-1 text-xs"
            disabled={dartsThrown === 0 || isInputDisabled}
            onClick={handleNextPlayer}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Bust Flash */}
      <AnimatePresence>
        {bustFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-0 flex items-center justify-center py-3 bg-destructive/90 z-40"
          >
            <AlertTriangle className="w-4 h-4 text-destructive-foreground mr-2" />
            <span className="text-sm font-bold text-destructive-foreground tracking-wider">BUST!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win Modal */}
      <AnimatePresence>
        {pendingWin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card rounded-md p-6 w-full max-w-xs text-center space-y-4 border border-card-border"
            >
              <div className="text-3xl font-bold font-mono text-primary">
                {pendingWin.teamName} Wins!
              </div>
              <p className="text-sm text-muted-foreground">
                Confirm this result?
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={handleCancelWin}>
                  Undo
                </Button>
                <Button className="flex-1" onClick={handleConfirmWin}>
                  Confirm Win
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Confirm Modal */}
      <AnimatePresence>
        {showUndoConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-card rounded-md p-5 w-full max-w-xs text-center space-y-4 border border-card-border"
            >
              <p className="text-sm text-foreground">
                Undo <span className="font-semibold">{undoPrevPlayerName}</span>'s last dart?
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setShowUndoConfirm(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleConfirmUndo}>
                  Undo
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
