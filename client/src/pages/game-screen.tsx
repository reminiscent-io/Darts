import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, ChevronRight, X } from "lucide-react";
import {
  Game, CricketNumber, Multiplier, CRICKET_NUMBERS, DartEntry
} from "@/lib/types";
import {
  getCurrentPlayer, getNextPlayer, recordDart, advanceTurn, undoLastDart,
  removeDartAtIndex, formatDart, isNumberDead, isNumberClosedByTeam,
  saveGame, confirmWin, getNumberValue
} from "@/lib/game-logic";

interface GameScreenProps {
  game: Game;
  onGameUpdate: (game: Game) => void;
  onGameEnd: (game: Game) => void;
}

export default function GameScreen({ game, onGameUpdate, onGameEnd }: GameScreenProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const [pendingWin, setPendingWin] = useState<{ teamId: string; teamName: string } | null>(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoPrevPlayerName, setUndoPrevPlayerName] = useState("");
  const lastDartTime = useRef(0);

  const { player: currentPlayer, team: currentTeam, teamIndex: currentTeamIndex } = getCurrentPlayer(game);
  const nextPlayerInfo = getNextPlayer(game);
  const dartsThrown = game.currentTurnDarts.length;

  const handleDartEntry = useCallback((target: CricketNumber | 'miss', mult: Multiplier) => {
    const now = Date.now();
    if (now - lastDartTime.current < 250) return;
    if (dartsThrown >= 3) return;
    if (game.status === 'completed') return;
    lastDartTime.current = now;

    const result = recordDart(game, target, mult);
    setMultiplier(1);

    if (result.isWin) {
      setPendingWin({ teamId: currentTeam.id, teamName: currentTeam.name });
      onGameUpdate(result.game);
      saveGame(result.game);
    } else {
      onGameUpdate(result.game);
      saveGame(result.game);
    }
  }, [game, dartsThrown, currentTeam, onGameUpdate]);

  const handleNumberTap = (num: CricketNumber) => {
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

    const result = undoLastDart(game);
    setPendingWin(null);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleConfirmUndo = () => {
    const result = undoLastDart(game);
    setPendingWin(null);
    setShowUndoConfirm(false);
    onGameUpdate(result.game);
    saveGame(result.game);
  };

  const handleRemoveDart = (index: number) => {
    const updated = removeDartAtIndex(game, index);
    setPendingWin(null);
    onGameUpdate(updated);
    saveGame(updated);
  };

  const handleNextPlayer = () => {
    const updated = advanceTurn(game);
    onGameUpdate(updated);
    saveGame(updated);
    setMultiplier(1);
  };

  const handleConfirmWin = () => {
    if (!pendingWin) return;
    const finalGame = confirmWin(game, pendingWin.teamId);
    onGameUpdate(finalGame);
    saveGame(finalGame);
    onGameEnd(finalGame);
  };

  const handleCancelWin = () => {
    setPendingWin(null);
  };

  const renderMarks = (count: number) => {
    if (count === 0) return <span className="text-muted-foreground/20 text-lg font-mono">&mdash;</span>;
    if (count === 1) return <span className="text-foreground text-lg font-mono">/</span>;
    if (count === 2) return <span className="text-foreground text-lg font-mono">X</span>;
    return <span className="text-primary text-lg font-bold font-mono">{'\u2297'}</span>;
  };

  const isInputDisabled = game.status === 'completed' || pendingWin !== null;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ touchAction: 'manipulation' }}>
      <div className="grid grid-cols-2 border-b border-border">
        {game.teams.map((team, idx) => (
          <div
            key={team.id}
            className={`px-3 py-2 text-center ${
              idx === 0 ? 'border-r border-border' : ''
            } ${currentTeamIndex === idx ? 'bg-muted/30' : ''}`}
          >
            <div className={`text-xs font-medium tracking-wider uppercase truncate ${
              idx === 0 ? 'text-primary' : 'text-chart-2'
            }`}
            data-testid={`text-team${idx + 1}-name`}
            >
              {team.name}
            </div>
            <div className="font-mono text-2xl font-bold tabular-nums" data-testid={`text-team${idx + 1}-points`}>
              {team.points}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            currentTeamIndex === 0 ? 'bg-primary' : 'bg-chart-2'
          }`} />
          <span className="text-sm font-medium truncate" data-testid="text-current-player">
            {currentPlayer.name}
          </span>
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

      <div className="flex-shrink-0">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          {CRICKET_NUMBERS.map((num) => {
            const key = String(num);
            const t1Marks = game.teams[0].marks[key] || 0;
            const t2Marks = game.teams[1].marks[key] || 0;
            const dead = isNumberDead(game, num);
            const t1Closed = isNumberClosedByTeam(game.teams[0], num);
            const t2Closed = isNumberClosedByTeam(game.teams[1], num);
            const liveForT1 = t1Closed && !t2Closed;
            const liveForT2 = t2Closed && !t1Closed;

            return (
              <div
                key={key}
                className={`grid grid-cols-[1fr_auto_1fr] items-center border-b border-border/50 ${
                  dead ? 'opacity-25' : ''
                }`}
                data-testid={`row-number-${key}`}
              >
                <div className={`text-center py-1 ${liveForT1 ? 'bg-primary/8' : ''}`}>
                  {renderMarks(Math.min(t1Marks, 3))}
                </div>
                <div className={`w-12 text-center py-1 border-x border-border/30 ${
                  dead ? 'line-through' : ''
                }`}>
                  <span className={`font-mono text-sm font-semibold ${
                    dead ? 'text-muted-foreground/40' : 'text-foreground'
                  }`}>
                    {num === 'B' ? 'BULL' : num}
                  </span>
                </div>
                <div className={`text-center py-1 ${liveForT2 ? 'bg-chart-2/8' : ''}`}>
                  {renderMarks(Math.min(t2Marks, 3))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[36px] flex items-center gap-1.5 px-3 py-1 border-b border-border bg-muted/10 overflow-x-auto" data-testid="dart-tray">
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
              className="flex items-center gap-1 bg-secondary rounded-md px-2 py-1 text-xs font-mono font-medium text-secondary-foreground shrink-0 hover-elevate active-elevate-2"
              data-testid={`button-dart-chip-${idx}`}
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

      <div className="flex-1 flex flex-col justify-end px-2 pb-2 gap-1.5 pt-1.5" data-testid="input-area">
        <div className="flex gap-1.5">
          <Button
            data-testid="button-miss"
            variant="secondary"
            size="sm"
            className="flex-1 text-muted-foreground text-xs"
            disabled={isInputDisabled || dartsThrown >= 3}
            onClick={handleMiss}
          >
            Miss
          </Button>
          <Button
            data-testid="button-single-bull"
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            disabled={isInputDisabled || dartsThrown >= 3}
            onClick={() => handleBull(false)}
          >
            SB
          </Button>
          <Button
            data-testid="button-double-bull"
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            disabled={isInputDisabled || dartsThrown >= 3}
            onClick={() => handleBull(true)}
          >
            DB
          </Button>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {([20, 19, 18, 17, 16, 15] as CricketNumber[]).map((num) => (
            <Button
              key={num}
              data-testid={`button-number-${num}`}
              variant="secondary"
              className="font-mono text-base font-bold py-3"
              disabled={isInputDisabled || dartsThrown >= 3}
              onClick={() => handleNumberTap(num)}
            >
              {num}
            </Button>
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
              className={`text-xs font-semibold tracking-wide ${
                multiplier === m ? '' : 'text-muted-foreground'
              }`}
            >
              {m === 1 ? 'SINGLE' : m === 2 ? 'DOUBLE' : 'TRIPLE'}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            data-testid="button-undo"
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
            data-testid="button-next-player"
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
                <Button
                  data-testid="button-cancel-win"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleCancelWin}
                >
                  Undo
                </Button>
                <Button
                  data-testid="button-confirm-win"
                  className="flex-1"
                  onClick={handleConfirmWin}
                >
                  Confirm Win
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <Button
                  data-testid="button-cancel-undo-confirm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowUndoConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  data-testid="button-confirm-undo"
                  className="flex-1"
                  onClick={handleConfirmUndo}
                >
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
