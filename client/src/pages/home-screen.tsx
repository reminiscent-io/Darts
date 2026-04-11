import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { loadGame, loadGameFromDb, loadGameHistory, loadGameHistoryFromDb } from "@/lib/game-logic";
import { motion } from "framer-motion";
import { Target, Play, RotateCcw, History } from "lucide-react";

interface HomeScreenProps {
  onNewGame: () => void;
  onResumeGame: () => void;
  onViewHistory: () => void;
}

export default function HomeScreen({ onNewGame, onResumeGame, onViewHistory }: HomeScreenProps) {
  const [savedGame, setSavedGame] = useState(() => {
    const saved = loadGame();
    return saved && saved.status === 'in_progress' ? saved : null;
  });
  const canResume = !!savedGame;
  const [hasHistory, setHasHistory] = useState(() => loadGameHistory().length > 0);

  useEffect(() => {
    loadGameFromDb().then((g) => {
      if (g && g.status === 'in_progress') setSavedGame(g);
    });
    loadGameHistoryFromDb().then((h) => {
      if (h.length > 0) setHasHistory(true);
    });
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-2 mb-12"
      >
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-2">
          <Target className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight font-mono text-foreground">
          DARTS
        </h1>
        <p className="text-muted-foreground text-sm tracking-widest uppercase">
          Scorekeeper
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <Button
          data-testid="button-new-game"
          size="lg"
          className="w-full text-base gap-2"
          onClick={onNewGame}
        >
          <Play className="w-4 h-4" />
          New Game
        </Button>

        {canResume && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Button
              data-testid="button-resume-game"
              variant="secondary"
              size="lg"
              className="w-full text-base gap-2"
              onClick={onResumeGame}
            >
              <RotateCcw className="w-4 h-4" />
              Resume {savedGame?.gameType === 'x01'
                ? `${(savedGame as { startingScore: number }).startingScore}`
                : 'Cricket'} Game
            </Button>
          </motion.div>
        )}

        {hasHistory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Button
              data-testid="button-game-history"
              variant="ghost"
              size="lg"
              className="w-full text-base gap-2 text-muted-foreground"
              onClick={onViewHistory}
            >
              <History className="w-4 h-4" />
              Game History
            </Button>
          </motion.div>
        )}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-12 text-xs text-muted-foreground/60 tracking-wide"
      >
        Cricket & X01 darts scoring
      </motion.p>
    </div>
  );
}
