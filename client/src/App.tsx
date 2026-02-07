import { useState, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { AnimatePresence, motion } from "framer-motion";
import { AppScreen, Game } from "@/lib/types";
import { createGame, loadGame, saveGame, clearSavedGame } from "@/lib/game-logic";
import HomeScreen from "@/pages/home-screen";
import SetupScreen from "@/pages/setup-screen";
import GameScreen from "@/pages/game-screen";
import PostGameScreen from "@/pages/post-game-screen";

function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleNewGame = useCallback(() => {
    setScreen('setup');
  }, []);

  const handleResumeGame = useCallback(() => {
    const saved = loadGame();
    if (saved && saved.status === 'in_progress') {
      setGame(saved);
      setScreen('game');
    }
  }, []);

  const handleStartGame = useCallback((
    team1Name: string,
    team1Players: string[],
    team2Name: string,
    team2Players: string[],
    firstTeamIndex: number
  ) => {
    const newGame = createGame(team1Name, team1Players, team2Name, team2Players, firstTeamIndex);
    setGame(newGame);
    saveGame(newGame);
    setScreen('game');
  }, []);

  const handleGameUpdate = useCallback((updatedGame: Game) => {
    setGame(updatedGame);
  }, []);

  const handleGameEnd = useCallback((finalGame: Game) => {
    setGame(finalGame);
    setScreen('post-game');
  }, []);

  const handleRematch = useCallback(() => {
    if (!game) return;
    const newGame = createGame(
      game.teams[0].name,
      game.teams[0].players.map(p => p.name),
      game.teams[1].name,
      game.teams[1].players.map(p => p.name),
      0
    );
    setGame(newGame);
    saveGame(newGame);
    setScreen('game');
  }, [game]);

  const handleHome = useCallback(() => {
    clearSavedGame();
    setGame(null);
    setScreen('home');
  }, []);

  const handleBackToHome = useCallback(() => {
    setScreen('home');
  }, []);

  return (
    <div className="h-full w-full max-w-lg mx-auto relative bg-background">
      <AnimatePresence mode="wait">
        {screen === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <HomeScreen onNewGame={handleNewGame} onResumeGame={handleResumeGame} />
          </motion.div>
        )}

        {screen === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <SetupScreen onBack={handleBackToHome} onStartGame={handleStartGame} />
          </motion.div>
        )}

        {screen === 'game' && game && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <GameScreen game={game} onGameUpdate={handleGameUpdate} onGameEnd={handleGameEnd} />
          </motion.div>
        )}

        {screen === 'post-game' && game && (
          <motion.div
            key="postgame"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <PostGameScreen
              game={game}
              onRematch={handleRematch}
              onNewGame={handleNewGame}
              onHome={handleHome}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </div>
  );
}

export default App;
