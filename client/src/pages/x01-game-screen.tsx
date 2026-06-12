import { useState, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, ChevronRight, X, AlertTriangle, Settings } from "lucide-react";
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
import ShareButton from "@/components/share-button";
import LongPressScoreButton from "@/components/long-press-score-button";
import GameSettingsSheet from "@/components/game-settings-sheet";
import ConfirmDialog from "@/components/confirm-dialog";
import {
  TEAM_TEXT_COLORS, TEAM_BG_COLORS, TEAM_HIGHLIGHT_CLASSES,
  TEAM_ACTIVE_TURN_CLASSES, TEAM_CHART_COLORS, teamColorAt
} from "@/lib/team-colors";

interface X01GameScreenProps {
  game: X01Game;
  onGameUpdate: (game: X01Game) => void;
  onGameEnd: (game: X01Game) => void;
  playerCount?: number;
  isConnected?: boolean;
}

export default function X01GameScreen({ game, onGameUpdate, onGameEnd, playerCount = 0, isConnected = false }: X01GameScreenProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [pendingWin, setPendingWin] = useState<{ teamId: string; teamName: string } | null>(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoPrevPlayerName, setUndoPrevPlayerName] = useState("");
  const [bustFlash, setBustFlash] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const lastDartTime = useRef(0);
  const [tappedNumber, setTappedNumber] = useState<string | null>(null);

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
    setTappedNumber(String(num));
    setTimeout(() => setTappedNumber(null), 200);
    handleDartEntry(num, multiplier);
  };

  const handleBull = (double: boolean) => {
    setTappedNumber(double ? 'DB' : 'SB');
    setTimeout(() => setTappedNumber(null), 200);
    handleDartEntry('B', double ? 2 : 1);
  };

  const handleMiss = () => {
    setTappedNumber('miss');
    setTimeout(() => setTappedNumber(null), 200);
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
    game.teams.forEach((t, idx) => {
      config[t.id] = {
        label: isIndividual ? t.players[0]?.name || t.name : t.name,
        color: teamColorAt(TEAM_CHART_COLORS, idx),
      };
    });

    return { chartData: data, chartConfig: config, hasActivity: hasAny, chartDomain: domain };
  }, [game.dartHistory, game.teams, game.startingScore, isIndividual]);

  return (
    <main className="h-full flex flex-col overflow-hidden" style={{ touchAction: 'manipulation' }}>
      {/* Nav Header */}
      <header className="flex items-center justify-between px-2 py-1 border-b border-border flex-shrink-0 bg-muted/10">
        <div className="w-9" />
        <span className="text-xs font-mono text-muted-foreground/50 tracking-wider uppercase">X01</span>
        <div className="flex items-center gap-1">
          {game.status !== 'completed' && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label="Game settings"
              onClick={() => setShowSettings(true)}
              data-testid="button-game-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
          <ShareButton gameId={game.id} playerCount={playerCount} isConnected={isConnected} />
        </div>
      </header>
      {/* Score Header */}
      {isIndividual ? (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border overflow-x-auto flex-shrink-0">
          {game.teams.map((team, idx) => (
            <div
              key={team.id}
              className={`flex flex-col items-center px-3 py-1 rounded-md min-w-[64px] shrink-0 transition-all duration-300 ${
                currentTeamIndex === idx ? teamColorAt(TEAM_HIGHLIGHT_CLASSES, idx) : ''
              }`}
            >
              <div className={`text-[10px] font-medium tracking-wider uppercase truncate ${teamColorAt(TEAM_TEXT_COLORS, idx)}`}>
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
          <div className={`flex-1 flex flex-col items-center justify-center py-2 transition-all duration-300 ${
            currentTeamIndex === 0 ? 'bg-primary/15 ring-2 ring-inset ring-primary/50' : ''
          }`}>
            <div className="text-xs font-medium tracking-wider uppercase truncate text-primary">
              {game.teams[0].name}
            </div>
            <div className="font-mono text-3xl font-bold tabular-nums">
              {game.teams[0].remainingScore}
            </div>
          </div>
          <div className="w-px bg-border" />
          <div className={`flex-1 flex flex-col items-center justify-center py-2 transition-all duration-300 ${
            currentTeamIndex === 1 ? 'bg-chart-2/15 ring-2 ring-inset ring-chart-2/50' : ''
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
      <div className={`flex items-center justify-between px-3 py-2 border-b border-border/50 transition-colors duration-300 ${
        teamColorAt(TEAM_ACTIVE_TURN_CLASSES, currentTeamIndex)
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${teamColorAt(TEAM_BG_COLORS, currentTeamIndex)}`} />
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

      <div aria-live="polite" className="sr-only">
        {dartsThrown > 0
          ? `${formatDart(game.currentTurnDarts[dartsThrown - 1])}, ${currentTeam.remainingScore} remaining`
          : `${currentPlayer.name} to throw`}
      </div>

      {/* Upcoming player rotation */}
      <div className="flex items-center gap-3 px-3 py-1 border-b border-border overflow-x-auto">
        {upcomingPlayers.map((up, i) => (
          <div key={`${up.player.id}-${i}`} className="flex items-center gap-1.5 shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${teamColorAt(TEAM_BG_COLORS, up.teamIndex)}`} />
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
      <div className="min-h-[44px] flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/10 overflow-x-auto">
        <span className="text-sm text-muted-foreground/60 shrink-0 mr-1">Darts:</span>
        <AnimatePresence mode="popLayout">
          {game.currentTurnDarts.map((dart, idx) => (
            <motion.button
              key={dart.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleRemoveDart(idx)}
              aria-label={`Remove dart ${formatDart(dart)}`}
              className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 min-h-10 text-sm font-mono font-semibold text-secondary-foreground shrink-0 hover-elevate active-elevate-2"
            >
              {formatDart(dart)}
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>
          ))}
        </AnimatePresence>
        {dartsThrown === 0 && (
          <span className="text-sm text-muted-foreground/30 italic">no darts thrown</span>
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
            <span key={team.id} className={`font-mono text-xs font-bold tabular-nums ${teamColorAt(TEAM_TEXT_COLORS, idx)}`}>
              {team.remainingScore}
            </span>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <footer className="shrink-0 flex flex-col px-2 pb-2 gap-1.5 pt-1.5">
        {/* Row 1: Miss, SB, DB */}
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className={`flex-1 min-h-10 text-muted-foreground text-xs transition-all duration-150 ${
              tappedNumber === 'miss' ? 'ring-2 ring-primary scale-105 bg-primary/20' : ''
            }`}
            disabled={isInputDisabled || dartsThrown >= 3}
            onClick={handleMiss}
          >
            Miss
          </Button>
          <div className="flex-1">
            <LongPressScoreButton
              label="SB"
              multipliers={[1, 2]}
              highlighted={tappedNumber === 'SB'}
              disabled={isInputDisabled || dartsThrown >= 3}
              onTap={() => handleBull(false)}
              onLongSelect={(m) => handleBull(m === 2)}
              className="min-h-10 text-xs"
              testId="button-single-bull"
            />
          </div>
          <div className="flex-1">
            <LongPressScoreButton
              label="DB"
              multipliers={[1, 2]}
              highlighted={tappedNumber === 'DB'}
              disabled={isInputDisabled || dartsThrown >= 3}
              onTap={() => handleBull(true)}
              onLongSelect={(m) => handleBull(m === 2)}
              className="min-h-10 text-xs"
              testId="button-double-bull"
            />
          </div>
        </div>

        {/* Number pad: 4x5 grid */}
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
            <LongPressScoreButton
              key={num}
              label={num}
              highlighted={tappedNumber === String(num)}
              disabled={isInputDisabled || dartsThrown >= 3}
              onTap={() => handleNumberTap(num)}
              onLongSelect={(m) => {
                setTappedNumber(String(num));
                setTimeout(() => setTappedNumber(null), 200);
                handleDartEntry(num, m);
              }}
              className="font-mono text-sm font-bold py-3"
              testId={`button-number-${num}`}
            />
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
              className={`min-h-10 text-xs font-semibold tracking-wide ${
                multiplier === m ? '' : 'text-muted-foreground'
              }`}
            >
              {m}x
            </Button>
          ))}
        </div>

        {/* Undo + Next */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 min-h-10 gap-1 text-xs"
            disabled={game.dartHistory.length === 0 || isInputDisabled}
            onClick={handleUndo}
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </Button>
          <Button
            size="sm"
            className="flex-[2] min-h-10 gap-1 text-xs"
            disabled={dartsThrown === 0 || isInputDisabled}
            onClick={handleNextPlayer}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </footer>

      {/* Bust Flash */}
      <AnimatePresence>
        {bustFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className="absolute inset-x-0 top-0 flex items-center justify-center py-3 bg-destructive/90 z-40"
          >
            <AlertTriangle className="w-4 h-4 text-destructive-foreground mr-2" />
            <span className="text-sm font-bold text-destructive-foreground tracking-wider">BUST!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={pendingWin !== null}
        title={
          <span className="block text-3xl font-bold font-mono text-primary">
            {pendingWin?.teamName} Wins!
          </span>
        }
        description="Confirm this result?"
        cancelLabel="Undo"
        confirmLabel="Confirm Win"
        onCancel={handleCancelWin}
        onConfirm={handleConfirmWin}
        cancelTestId="button-cancel-win"
        confirmTestId="button-confirm-win"
      />

      <ConfirmDialog
        open={showUndoConfirm}
        title="Undo last dart?"
        description={
          <>
            Removes <span className="font-semibold text-foreground">{undoPrevPlayerName}</span>'s last dart from the previous turn.
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Undo"
        onCancel={() => setShowUndoConfirm(false)}
        onConfirm={handleConfirmUndo}
        cancelTestId="button-cancel-undo-confirm"
        confirmTestId="button-confirm-undo"
      />

      <GameSettingsSheet
        game={game}
        onGameUpdate={(g) => onGameUpdate(g as X01Game)}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </main>
  );
}
