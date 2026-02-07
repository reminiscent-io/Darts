import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { GameSummary } from "@/lib/types";
import { loadGameHistory, clearGameHistory } from "@/lib/game-logic";

interface HistoryScreenProps {
  onBack: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryScreen({ onBack }: HistoryScreenProps) {
  const [history, setHistory] = useState<GameSummary[]>(() => loadGameHistory());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearGameHistory();
    setHistory([]);
    setConfirmClear(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Button
          data-testid="button-history-back"
          variant="ghost"
          size="icon"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Game History</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full px-6 text-center"
          >
            <Trophy className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No games played yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Completed games will appear here
            </p>
          </motion.div>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {history.map((game, i) => {
              const isExpanded = expandedId === game.id;
              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button
                    type="button"
                    className="w-full text-left bg-muted/20 hover:bg-muted/40 rounded-md px-3 py-3 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : game.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className={game.winnerTeamIndex === 0 ? "text-primary" : "text-foreground"}>
                              {game.team1Name}
                            </span>
                            <span className="text-muted-foreground font-mono text-xs">
                              {game.team1Score} - {game.team2Score}
                            </span>
                            <span className={game.winnerTeamIndex === 1 ? "text-primary" : "text-foreground"}>
                              {game.team2Name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground/60">
                              {formatDate(game.completedAt)} at {formatTime(game.completedAt)}
                            </span>
                            <span className="text-xs text-muted-foreground/40">
                              {game.totalDarts} darts
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Trophy className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-primary">{game.winnerName}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-muted/10 rounded-b-md border-t border-border/50 space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-medium text-primary mb-1">{game.team1Name}</div>
                              {game.team1Players.map((p, idx) => (
                                <div key={idx} className="text-xs text-muted-foreground">{p}</div>
                              ))}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-chart-2 mb-1">{game.team2Name}</div>
                              {game.team2Players.map((p, idx) => (
                                <div key={idx} className="text-xs text-muted-foreground">{p}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="p-4 border-t border-border">
          <Button
            data-testid="button-clear-history"
            variant="secondary"
            size="sm"
            className="w-full gap-2 text-muted-foreground"
            onClick={handleClear}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmClear ? "Tap again to confirm" : "Clear History"}
          </Button>
        </div>
      )}
    </div>
  );
}
