import { useState, useCallback, useRef, Fragment, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Undo2, ChevronRight, X, Home, Settings } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis } from "recharts";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig
} from "@/components/ui/chart";
import {
  CricketGame, CricketNumber, Multiplier, CRICKET_NUMBERS
} from "@/lib/types";
import {
  getCurrentPlayer, recordCricketDart, advanceTurn, undoLastCricketDart,
  removeCricketDartAtIndex, formatDart, isNumberDead, isNumberClosedByTeam,
  saveGame, confirmWin, getCricketPlayerStats,
  checkCricketWinCondition
} from "@/lib/game-logic";
import ShareButton from "@/components/share-button";
import LongPressScoreButton from "@/components/long-press-score-button";
import GameSettingsSheet from "@/components/game-settings-sheet";
import ConfirmDialog from "@/components/confirm-dialog";
import CurrentPlayerBar from "@/components/current-player-bar";
import { useDartFlight, DartFlightLayer } from "@/hooks/use-dart-flight";
import { confettiPop } from "@/lib/confetti";
import { EASE_OUT_EXPO } from "@/lib/motion";
import { TEAM_COLOR_VARS, TEAM_HIGHLIGHT_CLASSES, TEAM_TEXT_COLORS, teamColorAt } from "@/lib/team-colors";

interface CricketGameScreenProps {
  game: CricketGame;
  onGameUpdate: (game: CricketGame) => void;
  onGameEnd: (game: CricketGame) => void;
  onLeave: () => void;
  playerCount?: number;
  isConnected?: boolean;
}

export default function CricketGameScreen({ game, onGameUpdate, onGameEnd, onLeave, playerCount = 0, isConnected = false }: CricketGameScreenProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoPrevPlayerName, setUndoPrevPlayerName] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const lastDartTime = useRef(0);
  const [tappedNumber, setTappedNumber] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const { trayRef, flights, launchDart, removeFlight } = useDartFlight();

  const { player: currentPlayer, teamIndex: currentTeamIndex } = getCurrentPlayer(game);
  const dartsThrown = game.currentTurnDarts.length;
  const isSolo = game.mode === 'solo';

  const pendingWin = useMemo(() => {
    if (game.status !== 'in_progress') return null;
    for (let i = 0; i < game.teams.length; i++) {
      if (checkCricketWinCondition(game, i)) {
        return { teamId: game.teams[i].id, teamName: game.teams[i].name };
      }
    }
    return null;
  }, [game]);

  const upcomingPlayers = useMemo(() => {
    const orderLen = game.turnOrder.length;
    const result = [];
    for (let i = 1; i < orderLen; i++) {
      const ref = game.turnOrder[(game.currentTurnIndex + i) % orderLen];
      const team = game.teams[ref.teamIndex];
      const player = team.players.find(p => p.id === ref.playerId)!;
      const stats = getCricketPlayerStats(game, player.id);
      result.push({
        player,
        teamIndex: ref.teamIndex,
        points: stats.pointsContributed,
      });
    }
    return result;
  }, [game]);

  const handleDartEntry = useCallback((target: CricketNumber | 'miss', mult: Multiplier, origin?: { x: number; y: number }) => {
    const now = Date.now();
    if (now - lastDartTime.current < 250) return;
    if (dartsThrown >= 3) return;
    if (game.status === 'completed') return;
    lastDartTime.current = now;

    const result = recordCricketDart(game, target, mult);
    setMultiplier(1);

    // Triples and bulls get a pop, but only when the dart counted —
    // a triple on a dead number gets the pub groan, not the cheer.
    // The winning dart stays quiet: the post-game screen owns that celebration.
    const counted = (result.dart.marksApplied ?? 0) > 0 || result.dart.pointsScored > 0;
    if (!result.isWin && counted && (mult === 3 || target === 'B')) {
      confettiPop({
        origin,
        teamColorVar: teamColorAt(TEAM_COLOR_VARS, currentTeamIndex),
        big: target === 'B' && mult === 2,
      });
    }
    launchDart(formatDart(result.dart), dartsThrown, teamColorAt(TEAM_COLOR_VARS, currentTeamIndex), origin);
    onGameUpdate(result.game);
    saveGame(result.game);
  }, [game, dartsThrown, currentTeamIndex, onGameUpdate, launchDart]);

  const handleNumberTap = (num: CricketNumber, origin?: { x: number; y: number }) => {
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

    const result = undoLastCricketDart(game);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleConfirmUndo = () => {
    const result = undoLastCricketDart(game);
    setShowUndoConfirm(false);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleRemoveDart = (index: number) => {
    const updated = removeCricketDartAtIndex(game, index);
    onGameUpdate(updated);
    saveGame(updated);
  };

  const handleNextPlayer = () => {
    const updated = advanceTurn(game) as CricketGame;
    onGameUpdate(updated);
    saveGame(updated);
    setMultiplier(1);
  };

  const handleConfirmWin = () => {
    if (!pendingWin) return;
    const finalGame = confirmWin(game, pendingWin.teamId) as CricketGame;
    onGameUpdate(finalGame);
    saveGame(finalGame);
    onGameEnd(finalGame);
  };

  const handleCancelWin = () => {
    const result = undoLastCricketDart(game);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  // The save stays in place (saveGame runs after every dart), so the home
  // screen can offer Resume. Never clear it here.
  const handleLeave = () => {
    onLeave();
  };

  const renderMarks = (count: number) => {
    if (count === 0) return <span className="text-muted-foreground/20 text-lg font-mono">&mdash;</span>;
    if (count === 1) return <span className="text-foreground text-lg font-mono">/</span>;
    if (count === 2) return <span className="text-foreground text-lg font-mono">X</span>;
    return <span className="text-primary text-lg font-bold font-mono">{'\u2297'}</span>;
  };

  const isInputDisabled = game.status === 'completed' || pendingWin !== null;

  const { chartData, chartConfig, allPlayers, hasPoints, chartYMax } = useMemo(() => {
    const allDarts = [...game.dartHistory, ...game.currentTurnDarts];
    const players = game.teams.flatMap((team, teamIdx) =>
      team.players.map((p, playerIdx) => ({
        id: p.id,
        name: p.name,
        teamIdx,
        playerIdx,
        isTopOfStack: playerIdx === team.players.length - 1,
      }))
    );

    const cumulative: Record<string, number> = {};
    players.forEach(p => { cumulative[p.id] = 0; });

    const data: Array<Record<string, number>> = [
      { dart: 0, ...Object.fromEntries(players.map(p => [p.id, 0])) }
    ];

    let scored = false;
    for (let i = 0; i < allDarts.length; i++) {
      const dart = allDarts[i];
      if (dart.pointsScored > 0) {
        cumulative[dart.playerId] = (cumulative[dart.playerId] || 0) + dart.pointsScored;
        scored = true;
      }
      data.push({
        dart: i + 1,
        ...Object.fromEntries(players.map(p => [p.id, cumulative[p.id]]))
      });
    }

    // Ensure a reasonable minimum Y-axis range so early small scores don't spike to fill the chart
    const maxScore = Math.max(...Object.values(cumulative));
    const yMax = Math.max(maxScore, 50);

    const config: ChartConfig = {};
    players.forEach(p => {
      const lightness = p.teamIdx === 0 ? 55 + p.playerIdx * 12 : 50 + p.playerIdx * 12;
      const color = p.teamIdx === 0
        ? `hsl(38 95% ${lightness}%)`
        : `hsl(195 85% ${lightness}%)`;
      config[p.id] = { label: p.name, color };
    });

    return { chartData: data, chartConfig: config, allPlayers: players, hasPoints: scored, chartYMax: yMax };
  }, [game.dartHistory, game.currentTurnDarts, game.teams]);

  // Anchor each end-label to where its team's area actually tops out,
  // nudging overlapping labels apart so close scores stay readable.
  const endLabels = useMemo(() => {
    const teamsToShow = isSolo ? [game.teams[0]] : game.teams.slice(0, 2);
    const labels = teamsToShow
      .map((team, idx) => ({
        id: team.id,
        idx,
        value: team.points,
        pct: (1 - team.points / chartYMax) * 100,
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
  }, [game.teams, isSolo, chartYMax]);

  return (
    <main className="h-full flex flex-col overflow-hidden" style={{ touchAction: 'manipulation' }}>
      <header className="flex items-center justify-between px-2 py-1 border-b border-border flex-shrink-0 bg-muted/10">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Leave game"
          onClick={() => setShowLeaveConfirm(true)}
        >
          <Home className="w-4 h-4" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground/50 tracking-wider uppercase">Cricket</span>
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

      <div className="flex border-b border-border flex-shrink-0">
        {/* Team 1 Points - Left */}
        <div className="relative flex flex-col items-center justify-center w-[72px] shrink-0">
          {currentTeamIndex === 0 && (
            <motion.div
              layoutId="cricket-active-side"
              className={`absolute inset-0 ${teamColorAt(TEAM_HIGHLIGHT_CLASSES, 0)}`}
              transition={reducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: EASE_OUT_EXPO }}
              aria-hidden
            />
          )}
          <div className="relative text-xs font-medium tracking-wider uppercase truncate text-primary"
            data-testid="text-team1-name"
          >
            {game.teams[0].name}
          </div>
          <div className="relative font-mono text-3xl font-bold tabular-nums" data-testid="text-team1-points">
            <span
              key={game.teams[0].points}
              className="score-tick"
              style={{ "--tick-color": `var(${teamColorAt(TEAM_COLOR_VARS, 0)})` } as React.CSSProperties}
            >
              {game.teams[0].points}
            </span>
          </div>
        </div>

        <div className="flex-1 border-x border-border">
          <div className={isSolo ? "grid grid-cols-[1fr_auto]" : "grid grid-cols-[1fr_auto_1fr]"}>
            {CRICKET_NUMBERS.map((num) => {
              const key = String(num);
              const t1Marks = game.teams[0].marks[key] || 0;
              const t2Marks = !isSolo ? (game.teams[1].marks[key] || 0) : 0;
              const dead = isNumberDead(game, num);
              const t1Closed = isNumberClosedByTeam(game.teams[0], num);
              const t2Closed = !isSolo && isNumberClosedByTeam(game.teams[1], num);
              const liveForT1 = isSolo ? t1Closed : t1Closed && !t2Closed;
              const liveForT2 = !isSolo && t2Closed && !t1Closed;
              const opacityClass = dead ? 'opacity-25' : '';

              return (
                <Fragment key={key}>
                  <div className={`text-center py-1.5 border-b border-border/50 ${opacityClass} ${liveForT1 ? 'bg-primary/8' : ''}`}>
                    {renderMarks(Math.min(t1Marks, 3))}
                  </div>
                  <div
                    className={`w-12 text-center py-1.5 border-b border-border/50 border-x border-border/30 ${opacityClass} ${dead ? 'line-through' : ''}`}
                    data-testid={`row-number-${key}`}
                  >
                    <span className={`font-mono text-sm font-semibold ${
                      dead ? 'text-muted-foreground/40' : 'text-foreground'
                    }`}>
                      {num === 'B' ? 'BULL' : num}
                    </span>
                  </div>
                  {!isSolo && (
                    <div className={`text-center py-1.5 border-b border-border/50 ${opacityClass} ${liveForT2 ? 'bg-chart-2/8' : ''}`}>
                      {renderMarks(Math.min(t2Marks, 3))}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* Team 2 Points - Right */}
        {!isSolo && (
          <div className="relative flex flex-col items-center justify-center w-[72px] shrink-0">
            {currentTeamIndex === 1 && (
              <motion.div
                layoutId="cricket-active-side"
                className={`absolute inset-0 ${teamColorAt(TEAM_HIGHLIGHT_CLASSES, 1)}`}
                transition={reducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: EASE_OUT_EXPO }}
                aria-hidden
              />
            )}
            <div className="relative text-xs font-medium tracking-wider uppercase truncate text-chart-2"
              data-testid="text-team2-name"
            >
              {game.teams[1].name}
            </div>
            <div className="relative font-mono text-3xl font-bold tabular-nums" data-testid="text-team2-points">
              <span
                key={game.teams[1].points}
                className="score-tick"
                style={{ "--tick-color": `var(${teamColorAt(TEAM_COLOR_VARS, 1)})` } as React.CSSProperties}
              >
                {game.teams[1].points}
              </span>
            </div>
          </div>
        )}
      </div>

      <CurrentPlayerBar
        turnKey={String(game.currentTurnIndex)}
        playerName={currentPlayer.name}
        teamIndex={currentTeamIndex}
        dartsThrown={dartsThrown}
      />

      <div aria-live="polite" className="sr-only">
        {dartsThrown > 0
          ? `${formatDart(game.currentTurnDarts[dartsThrown - 1])}, dart ${dartsThrown} of 3`
          : `${currentPlayer.name} to throw`}
      </div>

      <div className="flex items-center gap-3 px-3 py-1 border-b border-border overflow-x-auto" data-testid="player-queue">
        {upcomingPlayers.map((up, i) => (
          <div key={`${up.player.id}-${i}`} className="flex items-center gap-1.5 shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${
              up.teamIndex === 0 ? 'bg-primary' : 'bg-chart-2'
            }`} />
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
              {up.player.name}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums">
              {up.points}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex py-1">
        <div className="flex-1 min-w-0 pl-2">
          {hasPoints ? (
            <ChartContainer config={chartConfig} className="h-full w-full !aspect-auto">
              <AreaChart data={chartData}>
                <XAxis dataKey="dart" hide />
                <YAxis hide domain={[0, chartYMax]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {allPlayers.map((player) => (
                  <Area
                    key={player.id}
                    dataKey={player.id}
                    type="monotone"
                    stackId={`team${player.teamIdx}`}
                    fill={`var(--color-${player.id})`}
                    stroke={`var(--color-${player.id})`}
                    fillOpacity={0.5}
                    strokeWidth={player.isTopOfStack ? 2 : 0}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-xs text-muted-foreground/30 italic">score chart appears here</span>
            </div>
          )}
        </div>
        <div className="relative shrink-0 w-8">
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

      <div ref={trayRef} className="min-h-[44px] flex items-center gap-2 px-3 py-1.5 border-t border-border bg-muted/10 overflow-x-auto" data-testid="dart-tray">
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
              data-testid={`button-dart-chip-${idx}`}
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

      <footer className="shrink-0 flex flex-col px-2 pb-2 gap-1.5 pt-1.5" data-testid="input-area">
        <div className="flex gap-1.5">
          <Button
            data-testid="button-miss"
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

        {/* While 2x/3x is armed, the pad tints and labels show what will
            actually be recorded (D20/T20). */}
        <div className={`grid grid-cols-6 gap-1.5 rounded-md transition-all duration-150 ${
          multiplier > 1 ? 'ring-1 ring-primary/40 bg-primary/10' : ''
        }`}>
          {([20, 19, 18, 17, 16, 15] as CricketNumber[]).map((num) => (
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
              className="font-mono text-base font-bold py-3"
              testId={`button-number-${num}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {([1, 2, 3] as Multiplier[]).map((m) => (
            <Button
              key={m}
              data-testid={`button-multiplier-${m === 1 ? 'single' : m === 2 ? 'double' : 'triple'}`}
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

        <div className="flex gap-2">
          <Button
            data-testid="button-undo"
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
            data-testid="button-next-player"
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

      <ConfirmDialog
        open={showLeaveConfirm}
        title="Leave this game?"
        description="Your game is saved. Resume it from the home screen."
        cancelLabel="Stay"
        confirmLabel="Leave"
        onCancel={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeave}
      />

      <GameSettingsSheet
        game={game}
        onGameUpdate={(g) => onGameUpdate(g as CricketGame)}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </main>
  );
}
