import { useState, useCallback, useRef, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Undo2, ChevronRight, X, AlertTriangle, Home, Settings } from "lucide-react";
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
import ExitGameDialog from "@/components/exit-game-dialog";
import CurrentPlayerBar from "@/components/current-player-bar";
import { useDartFlight, DartFlightLayer } from "@/hooks/use-dart-flight";
import { getCheckoutRoute } from "@/lib/checkout";
import { confettiPop } from "@/lib/confetti";
import { EASE_OUT_EXPO } from "@/lib/motion";
import {
  TEAM_TEXT_COLORS, TEAM_BG_COLORS, TEAM_HIGHLIGHT_CLASSES,
  TEAM_CHART_COLORS, TEAM_COLOR_VARS, teamColorAt
} from "@/lib/team-colors";

interface X01GameScreenProps {
  game: X01Game;
  onGameUpdate: (game: X01Game) => void;
  onGameEnd: (game: X01Game) => void;
  onLeave: () => void;
  onEndGame: () => void;
  playerCount?: number;
  isConnected?: boolean;
}

export default function X01GameScreen({ game, onGameUpdate, onGameEnd, onLeave, onEndGame, playerCount = 0, isConnected = false }: X01GameScreenProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoPrevPlayerName, setUndoPrevPlayerName] = useState("");
  const [bustFlash, setBustFlash] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const lastDartTime = useRef(0);
  const [tappedNumber, setTappedNumber] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const { trayRef, flights, launchDart, removeFlight } = useDartFlight();

  const { player: currentPlayer, teamIndex: currentTeamIndex } = getCurrentPlayer(game);
  const dartsThrown = game.currentTurnDarts.length;
  const roundTotal = getCurrentTurnTotal(game);

  // Checkout hint for the thrower: silent unless a finish is on with the
  // darts left in this turn.
  const checkoutRoute = useMemo(() => {
    if (game.status !== 'in_progress') return null;
    return getCheckoutRoute(
      game.teams[currentTeamIndex].remainingScore,
      3 - dartsThrown,
      game.doubleOut
    );
  }, [game, currentTeamIndex, dartsThrown]);

  const pendingWin = useMemo(() => {
    if (game.status !== 'in_progress') return null;
    const team = game.teams.find(t => t.remainingScore === 0);
    return team ? { teamId: team.id, teamName: team.name } : null;
  }, [game]);

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

  const handleDartEntry = useCallback((target: number | 'B' | 'miss', mult: Multiplier, origin?: { x: number; y: number }) => {
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

    launchDart(formatDart(result.dart), dartsThrown, teamColorAt(TEAM_COLOR_VARS, currentTeamIndex), origin);

    if (!result.isWin && (mult === 3 || target === 'B')) {
      // Triples and bulls get a pop; the winning dart stays quiet here
      // because the post-game screen owns the big celebration.
      confettiPop({
        origin,
        teamColorVar: teamColorAt(TEAM_COLOR_VARS, currentTeamIndex),
        big: target === 'B' && mult === 2,
      });
    }
    onGameUpdate(result.game);
    saveGame(result.game);
  }, [game, dartsThrown, currentTeamIndex, onGameUpdate, launchDart]);

  const handleNumberTap = (num: number, origin?: { x: number; y: number }) => {
    setTappedNumber(String(num));
    setTimeout(() => setTappedNumber(null), 200);
    handleDartEntry(num, multiplier, origin);
  };

  const handleBull = (double: boolean, origin?: { x: number; y: number }) => {
    setTappedNumber(double ? 'DB' : 'SB');
    setTimeout(() => setTappedNumber(null), 200);
    handleDartEntry('B', double ? 2 : 1, origin);
  };

  const handleMiss = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTappedNumber('miss');
    setTimeout(() => setTappedNumber(null), 200);
    handleDartEntry('miss', 1, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
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
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleConfirmUndo = () => {
    const result = undoLastX01Dart(game);
    setShowUndoConfirm(false);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleRemoveDart = (index: number) => {
    const updated = removeX01DartAtIndex(game, index);
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
    const result = undoLastX01Dart(game);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleLeave = () => {
    setShowExitDialog(false);
    onLeave();
  };

  const handleEndGame = () => {
    setShowExitDialog(false);
    onEndGame();
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

  // Anchor each end-label to where its line actually ends, nudging
  // overlapping labels apart so close scores stay readable.
  const endLabels = useMemo(() => {
    const [dMin, dMax] = chartDomain;
    const range = dMax - dMin || 1;
    const labels = game.teams
      .map((team, idx) => ({
        id: team.id,
        idx,
        value: team.remainingScore,
        pct: (1 - (team.remainingScore - dMin) / range) * 100,
      }))
      .sort((a, b) => a.pct - b.pct);
    const GAP = 10;
    for (let i = 0; i < labels.length; i++) {
      labels[i].pct = Math.max(4, Math.min(96, labels[i].pct));
      if (i > 0 && labels[i].pct - labels[i - 1].pct < GAP) {
        labels[i].pct = labels[i - 1].pct + GAP;
      }
    }
    const overflow = labels.length ? labels[labels.length - 1].pct - 96 : 0;
    if (overflow > 0) labels.forEach(l => { l.pct = Math.max(2, l.pct - overflow); });
    return labels;
  }, [game.teams, chartDomain]);

  return (
    <main className="h-full flex flex-col overflow-hidden" style={{ touchAction: 'manipulation' }}>
      {/* Nav Header */}
      <header className="flex items-center justify-between px-2 py-1 border-b border-border flex-shrink-0 bg-muted/10">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Leave game"
          onClick={() => setShowExitDialog(true)}
        >
          <Home className="w-4 h-4" />
        </Button>
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
              className="relative flex flex-col items-center px-3 py-1 rounded-md min-w-[64px] shrink-0"
            >
              {currentTeamIndex === idx && (
                <motion.div
                  layoutId="x01-active-chip"
                  className={`absolute inset-0 rounded-md ${teamColorAt(TEAM_HIGHLIGHT_CLASSES, idx)}`}
                  transition={reducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: EASE_OUT_EXPO }}
                  aria-hidden
                />
              )}
              <div className={`relative text-[10px] font-medium tracking-wider uppercase truncate ${teamColorAt(TEAM_TEXT_COLORS, idx)}`}>
                {team.players[0]?.name || team.name}
              </div>
              <div className="relative font-mono text-2xl font-bold tabular-nums">
                <span
                  key={team.remainingScore}
                  className="score-tick"
                  style={{ "--tick-color": `var(${teamColorAt(TEAM_COLOR_VARS, idx)})` } as React.CSSProperties}
                >
                  {team.remainingScore}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex border-b border-border flex-shrink-0">
          {game.teams.slice(0, 2).map((team, idx) => (
            <Fragment key={team.id}>
              {idx === 1 && <div className="w-px bg-border" />}
              <div className="relative flex-1 flex flex-col items-center justify-center py-2">
                {currentTeamIndex === idx && (
                  <motion.div
                    layoutId="x01-active-side"
                    className={`absolute inset-0 ${teamColorAt(TEAM_HIGHLIGHT_CLASSES, idx)}`}
                    transition={reducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: EASE_OUT_EXPO }}
                    aria-hidden
                  />
                )}
                <div className={`relative text-xs font-medium tracking-wider uppercase truncate ${teamColorAt(TEAM_TEXT_COLORS, idx)}`}>
                  {team.name}
                </div>
                <div className="relative font-mono text-3xl font-bold tabular-nums">
                  <span
                    key={team.remainingScore}
                    className="score-tick"
                    style={{ "--tick-color": `var(${teamColorAt(TEAM_COLOR_VARS, idx)})` } as React.CSSProperties}
                  >
                    {team.remainingScore}
                  </span>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {/* Current player + dart counter */}
      <CurrentPlayerBar
        turnKey={String(game.currentTurnIndex)}
        playerName={currentPlayer.name}
        teamIndex={currentTeamIndex}
        dartsThrown={dartsThrown}
        roundTotal={roundTotal}
        checkout={checkoutRoute}
      />

      <div aria-live="polite" className="sr-only">
        {(dartsThrown > 0
          ? `${formatDart(game.currentTurnDarts[dartsThrown - 1])}, ${game.teams[currentTeamIndex].remainingScore} remaining`
          : `${currentPlayer.name} to throw`)
          + (checkoutRoute ? `, out ${checkoutRoute.join(' ')}` : '')}
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
        <div className="relative shrink-0 w-10">
          {endLabels.map((label) => (
            <span
              key={label.id}
              className={`absolute right-2 -translate-y-1/2 font-mono text-xs font-bold tabular-nums ${teamColorAt(TEAM_TEXT_COLORS, label.idx)}`}
              style={{ top: `${label.pct}%` }}
            >
              {label.value}
            </span>
          ))}
        </div>
      </div>

      {/* Dart tray */}
      <div ref={trayRef} className="min-h-[44px] flex items-center gap-2 px-3 py-1.5 border-t border-border bg-muted/10 overflow-x-auto">
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
              className="chip-flash flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 min-h-10 text-sm font-mono font-semibold text-secondary-foreground shrink-0 hover-elevate active-elevate-2"
              style={{ "--flash-color": `var(${teamColorAt(TEAM_COLOR_VARS, currentTeamIndex)})` } as React.CSSProperties}
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

      {/* Input Area */}
      <footer className="shrink-0 flex flex-col px-2 pb-2 gap-1.5 pt-1.5">
        {/* Row 1: Miss, SB, DB */}
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className={`flex-1 min-h-11 text-muted-foreground text-xs transition-all duration-150 ${
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
              onTap={(origin) => handleBull(false, origin)}
              onLongSelect={(m, origin) => handleBull(m === 2, origin)}
              className="min-h-11 text-xs"
              testId="button-single-bull"
            />
          </div>
          <div className="flex-1">
            <LongPressScoreButton
              label="DB"
              multipliers={[1, 2]}
              highlighted={tappedNumber === 'DB'}
              disabled={isInputDisabled || dartsThrown >= 3}
              onTap={(origin) => handleBull(true, origin)}
              onLongSelect={(m, origin) => handleBull(m === 2, origin)}
              className="min-h-11 text-xs"
              testId="button-double-bull"
            />
          </div>
        </div>

        {/* Number pad: 4x5 grid. While 2x/3x is armed, the pad tints and
            labels show the value that will actually be recorded (D5/T5). */}
        <div className={`grid grid-cols-5 gap-1 rounded-md transition-all duration-150 ${
          multiplier > 1 ? 'ring-1 ring-primary/40 bg-primary/10' : ''
        }`}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
            <LongPressScoreButton
              key={num}
              label={multiplier === 1 ? num : `${multiplier === 2 ? 'D' : 'T'}${num}`}
              highlighted={tappedNumber === String(num)}
              disabled={isInputDisabled || dartsThrown >= 3}
              onTap={(origin) => handleNumberTap(num, origin)}
              onLongSelect={(m, origin) => {
                setTappedNumber(String(num));
                setTimeout(() => setTappedNumber(null), 200);
                handleDartEntry(num, m, origin);
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
              className={`min-h-11 text-xs font-semibold tracking-wide ${
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
            className="flex-1 min-h-11 gap-1 text-xs"
            disabled={game.dartHistory.length === 0 || isInputDisabled}
            onClick={handleUndo}
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </Button>
          <Button
            size="sm"
            className="flex-[2] min-h-11 gap-1 text-xs"
            disabled={dartsThrown === 0 || isInputDisabled}
            onClick={handleNextPlayer}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </footer>

      <DartFlightLayer flights={flights} onDone={removeFlight} />

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

      <ExitGameDialog
        open={showExitDialog}
        othersConnected={Math.max(0, playerCount - 1)}
        onCancel={() => setShowExitDialog(false)}
        onLeave={handleLeave}
        onEndGame={handleEndGame}
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
