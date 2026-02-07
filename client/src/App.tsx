import { useState, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { AnimatePresence, motion } from "framer-motion";
import { AppScreen, Game, CricketGame, X01Game } from "@/lib/types";
import {
  createCricketGame, loadGame, loadGameFromDb, saveGame, clearSavedGame,
  saveGameToHistory, savePlayerNames, migrateStorage
} from "@/lib/game-logic";
import { createX01Game } from "@/lib/x01-game-logic";
import HomeScreen from "@/pages/home-screen";
import SetupScreen, { type GameSetupConfig } from "@/pages/setup-screen";
import CricketGameScreen from "@/pages/cricket-game-screen";
import CricketPostGameScreen from "@/pages/cricket-post-game-screen";
import X01GameScreen from "@/pages/x01-game-screen";
import X01PostGameScreen from "@/pages/x01-post-game-screen";
import HistoryScreen from "@/pages/history-screen";
import AccessScreen, { isAccessGranted } from "@/pages/access-screen";

function App() {
  const [authenticated, setAuthenticated] = useState(() => isAccessGranted());
  const [screen, setScreen] = useState<AppScreen>('home');
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    migrateStorage();
  }, []);

  const handleNewGame = useCallback(() => {
    setScreen('setup');
  }, []);

  const handleResumeGame = useCallback(async () => {
    let saved = loadGame();
    if (!saved || saved.status !== 'in_progress') {
      saved = await loadGameFromDb();
    }
    if (saved && saved.status === 'in_progress') {
      setGame(saved);
      setScreen('game');
    }
  }, []);

  const handleStartGame = useCallback((config: GameSetupConfig) => {
    let newGame: Game;

    if (config.gameType === 'cricket') {
      newGame = createCricketGame(
        config.team1Name,
        config.team1Players,
        config.team2Name,
        config.team2Players,
        config.firstTeamIndex
      );
    } else {
      if (config.x01Mode === 'individual') {
        newGame = createX01Game({
          startingScore: config.startingScore,
          doubleOut: config.doubleOut,
          mode: 'individual',
          playerNames: config.individualPlayers,
        });
      } else {
        newGame = createX01Game({
          startingScore: config.startingScore,
          doubleOut: config.doubleOut,
          mode: 'team',
          team1Name: config.team1Name,
          team1Players: config.team1Players,
          team2Name: config.team2Name,
          team2Players: config.team2Players,
          firstTeamIndex: config.firstTeamIndex,
        });
      }
    }

    setGame(newGame);
    saveGame(newGame);
    setScreen('game');
  }, []);

  const handleGameUpdate = useCallback((updatedGame: Game) => {
    setGame(updatedGame);
  }, []);

  const handleGameEnd = useCallback((finalGame: Game) => {
    setGame(finalGame);
    saveGameToHistory(finalGame);
    const allNames = finalGame.teams.flatMap(t => t.players.map(p => p.name));
    savePlayerNames(allNames);
    setScreen('post-game');
  }, []);

  const handleRematch = useCallback(() => {
    if (!game) return;

    let newGame: Game;
    if (game.gameType === 'cricket') {
      const cg = game as CricketGame;
      newGame = createCricketGame(
        cg.teams[0].name,
        cg.teams[0].players.map(p => p.name),
        cg.teams[1].name,
        cg.teams[1].players.map(p => p.name),
        0
      );
    } else {
      const xg = game as X01Game;
      if (xg.mode === 'individual') {
        newGame = createX01Game({
          startingScore: xg.startingScore,
          doubleOut: xg.doubleOut,
          mode: 'individual',
          playerNames: xg.teams.map(t => t.players[0]?.name || t.name),
        });
      } else {
        newGame = createX01Game({
          startingScore: xg.startingScore,
          doubleOut: xg.doubleOut,
          mode: 'team',
          team1Name: xg.teams[0].name,
          team1Players: xg.teams[0].players.map(p => p.name),
          team2Name: xg.teams[1].name,
          team2Players: xg.teams[1].players.map(p => p.name),
          firstTeamIndex: 0,
        });
      }
    }

    setGame(newGame);
    saveGame(newGame);
    setScreen('game');
  }, [game]);

  const handleHome = useCallback(() => {
    clearSavedGame();
    setGame(null);
    setScreen('home');
  }, []);

  const handleViewHistory = useCallback(() => {
    setScreen('history');
  }, []);

  const handleBackToHome = useCallback(() => {
    setScreen('home');
  }, []);

  if (!authenticated) {
    return (
      <div className="h-full w-full max-w-lg mx-auto relative bg-background">
        <AccessScreen onAccessGranted={() => setAuthenticated(true)} />
        <Toaster />
      </div>
    );
  }

  const renderGameScreen = () => {
    if (!game) return null;
    if (game.gameType === 'cricket') {
      return (
        <CricketGameScreen
          game={game as CricketGame}
          onGameUpdate={handleGameUpdate as (g: CricketGame) => void}
          onGameEnd={handleGameEnd as (g: CricketGame) => void}
        />
      );
    }
    return (
      <X01GameScreen
        game={game as X01Game}
        onGameUpdate={handleGameUpdate as (g: X01Game) => void}
        onGameEnd={handleGameEnd as (g: X01Game) => void}
      />
    );
  };

  const renderPostGameScreen = () => {
    if (!game) return null;
    if (game.gameType === 'cricket') {
      return (
        <CricketPostGameScreen
          game={game as CricketGame}
          onRematch={handleRematch}
          onNewGame={handleNewGame}
          onHome={handleHome}
        />
      );
    }
    return (
      <X01PostGameScreen
        game={game as X01Game}
        onRematch={handleRematch}
        onNewGame={handleNewGame}
        onHome={handleHome}
      />
    );
  };

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
            <HomeScreen onNewGame={handleNewGame} onResumeGame={handleResumeGame} onViewHistory={handleViewHistory} />
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
            {renderGameScreen()}
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
            {renderPostGameScreen()}
          </motion.div>
        )}

        {screen === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <HistoryScreen onBack={handleBackToHome} />
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </div>
  );
}

export default App;
