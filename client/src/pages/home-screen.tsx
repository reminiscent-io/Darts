import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { loadGame, loadGameFromDb, loadGameHistory, loadGameHistoryFromDb } from "@/lib/game-logic";
import { motion } from "framer-motion";
import { Target, Play, RotateCcw, History, Gamepad2, Users, Share2, BarChart3 } from "lucide-react";

interface HomeScreenProps {
  onNewGame: () => void;
  onResumeGame: () => void;
  onViewHistory: () => void;
  onViewPlayers: () => void;
}

export default function HomeScreen({ onNewGame, onResumeGame, onViewHistory, onViewPlayers }: HomeScreenProps) {
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
    <main className="h-full flex flex-col items-center justify-center px-6">
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

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Button
            data-testid="button-player-stats"
            variant="ghost"
            size="lg"
            className="w-full text-base gap-2 text-muted-foreground"
            onClick={onViewPlayers}
          >
            <BarChart3 className="w-4 h-4" />
            Player Stats
          </Button>
        </motion.div>

        {hasHistory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.45 }}
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-12 w-full max-w-xs flex flex-col gap-3"
      >
        <p className="text-[10px] text-muted-foreground/60 tracking-widest uppercase text-center">
          How it works
        </p>
        <ol className="flex flex-col gap-2.5">
          {[
            { icon: Gamepad2, text: "Pick Cricket or X01" },
            { icon: Users, text: "Add your players" },
            { icon: Share2, text: "Share the link & play live" },
          ].map(({ icon: Icon, text }, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold font-mono text-primary">
                {i + 1}
              </span>
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{text}</span>
            </li>
          ))}
        </ol>
      </motion.div>
    </main>
  );
}
