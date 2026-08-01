import { useState, useCallback, useEffect, useRef, Component, Suspense, lazy, type ReactNode, type ErrorInfo } from "react";
import { Router, Route, useParams, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AnimatePresence, motion } from "framer-motion";
import { AppScreen, Game, CricketGame, X01Game } from "@/lib/types";
import {
  createCricketGame, createSoloCricketGame, loadGame, loadGameFromDb, saveGame, clearSavedGame,
  saveGameToHistory, savePlayerNames, migrateStorage, loadGameById,
  leaveGameLocally, endGameForEveryone
} from "@/lib/game-logic";
import { toast } from "@/hooks/use-toast";
import { createX01Game } from "@/lib/x01-game-logic";
import { useGameSync } from "@/hooks/use-game-sync";
import HomeScreen from "@/pages/home-screen";
import type { GameSetupConfig } from "@/pages/setup-screen";
import AccessScreen, { isAccessGranted } from "@/pages/access-screen";

// Code-split everything past the home screen; recharts only ships with the game chunks.
const SetupScreen = lazy(() => import("@/pages/setup-screen"));
const CricketGameScreen = lazy(() => import("@/pages/cricket-game-screen"));
const CricketPostGameScreen = lazy(() => import("@/pages/cricket-post-game-screen"));
const X01GameScreen = lazy(() => import("@/pages/x01-game-screen"));
const X01PostGameScreen = lazy(() => import("@/pages/x01-post-game-screen"));
const HistoryScreen = lazy(() => import("@/pages/history-screen"));

const screenFallback = (
  <div className="h-full flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function MainApp() {
  const [authenticated, setAuthenticated] = useState(() => isAccessGranted());
  const [screen, setScreen] = useState<AppScreen>('home');
  const [game, setGame] = useState<Game | null>(null);

  // Mirrors `game` for callbacks that fire outside React's render flow.
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  // Real-time sync: active whenever there's a game in progress
  const gameId = game?.status === 'in_progress' ? game.id : null;
  const { isConnected, playerCount, sendUpdate } = useGameSync(
    gameId,
    (remoteGame) => {
      setGame(remoteGame);
      // Keep localStorage fresh with remote updates
      saveGame(remoteGame);
    },
    (endedGameId) => {
      // Someone else hit "End game for everyone".
      leaveGameLocally(endedGameId);
      if (gameRef.current?.id !== endedGameId) return;
      setGame(null);
      setScreen('home');
      toast({
        title: "Game ended",
        description: "Another player ended this game for everyone.",
      });
    },
  );

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
    // Whatever was saved before is not this game: release it so it can't be
    // pulled back in from the server the next time the home screen loads.
    leaveGameLocally();

    let newGame: Game;

    if (config.gameType === 'cricket') {
      if (config.cricketMode === 'solo') {
        newGame = createSoloCricketGame(config.soloPlayer);
      } else {
        newGame = createCricketGame(
          config.team1Name,
          config.team1Players,
          config.team2Name,
          config.team2Players,
          config.firstTeamIndex
        );
      }
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
    sendUpdate(updatedGame);
  }, [sendUpdate]);

  const handleGameEnd = useCallback((finalGame: Game) => {
    setGame(finalGame);
    saveGameToHistory(finalGame);
    sendUpdate(finalGame);
    const allNames = finalGame.teams.flatMap(t => t.players.map(p => p.name));
    savePlayerNames(allNames);
    setScreen('post-game');
  }, [sendUpdate]);

  const handleRematch = useCallback(() => {
    if (!game) return;

    leaveGameLocally();

    let newGame: Game;
    if (game.gameType === 'cricket') {
      const cg = game as CricketGame;
      if (cg.mode === 'solo') {
        newGame = createSoloCricketGame(cg.teams[0].players[0]?.name || cg.teams[0].name);
      } else {
        newGame = createCricketGame(
          cg.teams[0].name,
          cg.teams[0].players.map(p => p.name),
          cg.teams[1].name,
          cg.teams[1].players.map(p => p.name),
          0
        );
      }
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

  // Leave: step out on this device only. The game stays on the server for the
  // other players (and its share link), but it stops following this browser
  // around — no resume prompt, no reload from /api/games/active.
  const handleLeaveGame = useCallback(() => {
    if (game) leaveGameLocally(game.id);
    setGame(null);
    setScreen('home');
  }, [game]);

  // End game: kill it for everyone. The server deletes it and tells every other
  // device in the room to drop it too.
  const handleEndGameForEveryone = useCallback(() => {
    if (game) endGameForEveryone(game.id);
    setGame(null);
    setScreen('home');
  }, [game]);

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
          onLeave={handleLeaveGame}
          onEndGame={handleEndGameForEveryone}
          playerCount={playerCount}
          isConnected={isConnected}
        />
      );
    }
    return (
      <X01GameScreen
        game={game as X01Game}
        onGameUpdate={handleGameUpdate as (g: X01Game) => void}
        onGameEnd={handleGameEnd as (g: X01Game) => void}
        onLeave={handleLeaveGame}
        onEndGame={handleEndGameForEveryone}
        playerCount={playerCount}
        isConnected={isConnected}
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
            <Suspense fallback={screenFallback}>
              <SetupScreen onBack={handleBackToHome} onStartGame={handleStartGame} />
            </Suspense>
          </motion.div>
        )}

        {screen === 'game' && game && (
          <motion.div
            key={`game-${game.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <Suspense fallback={screenFallback}>{renderGameScreen()}</Suspense>
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
            <Suspense fallback={screenFallback}>{renderPostGameScreen()}</Suspense>
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
            <Suspense fallback={screenFallback}>
              <HistoryScreen onBack={handleBackToHome} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </div>
  );
}

function SharedGameView() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;
  const [, setLocation] = useLocation();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState(false);

  const gameLoaded = useRef(false);

  const { isConnected, playerCount, sendUpdate } = useGameSync(
    gameId ?? null,
    (remoteGame) => {
      gameLoaded.current = true;
      setGame(remoteGame);
      setLoading(false);
      setError(null);
    },
    (endedGameId) => {
      leaveGameLocally(endedGameId);
      setGame(null);
      setLoading(false);
      setGameEnded(true);
      setError("This game was ended by another player.");
    },
  );

  // Load game initially via HTTP with retries.
  // The host's saveGameToDb is fire-and-forget, so when a recipient opens
  // the link seconds after it's shared, the DB write may still be in flight
  // and both the HTTP GET and the WebSocket join will briefly 404. Retry
  // with backoff for a few seconds before declaring the link invalid. The
  // WebSocket path can still win the race via gameLoaded.current.
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // 5 attempts spread over ~5s: 0, 500, 1000, 1500, 2000 ms between tries.
    const MAX_ATTEMPTS = 5;

    const attemptLoad = async (attempt: number) => {
      if (cancelled || gameLoaded.current) return;
      const loaded = await loadGameById(gameId);
      if (cancelled || gameLoaded.current) return;
      if (loaded) {
        gameLoaded.current = true;
        setGame(loaded);
        setLoading(false);
        return;
      }
      if (attempt < MAX_ATTEMPTS) {
        timeoutId = setTimeout(() => attemptLoad(attempt + 1), attempt * 500);
      } else if (!gameLoaded.current) {
        setError("Game not found");
        setLoading(false);
      }
    };

    attemptLoad(1);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [gameId]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleGameUpdate = useCallback((updatedGame: Game) => {
    setGame(updatedGame);
    saveGame(updatedGame);
    sendUpdate(updatedGame);
  }, [sendUpdate]);

  const handleGameEnd = useCallback((finalGame: Game) => {
    setGame(finalGame);
    saveGame(finalGame);
    saveGameToHistory(finalGame);
    sendUpdate(finalGame);
  }, [sendUpdate]);

  // Following a shared link caches the game locally (saveGame above), so
  // leaving has to release it or this device would offer to resume someone
  // else's game from its home screen.
  const handleLeave = useCallback(() => {
    if (gameId) leaveGameLocally(gameId);
    setLocation("/");
  }, [gameId, setLocation]);

  const handleEndGameForEveryone = useCallback(() => {
    if (gameId) endGameForEveryone(gameId);
    setLocation("/");
  }, [gameId, setLocation]);

  if (loading) {
    return (
      <div className="h-full w-full max-w-lg mx-auto relative bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="h-full w-full max-w-lg mx-auto relative bg-background flex items-center justify-center">
        <div className="text-center space-y-3 px-6">
          <p className="text-lg font-semibold text-foreground">
            {gameEnded ? "Game ended" : "Game not found"}
          </p>
          <p className="text-sm text-muted-foreground">
            {gameEnded
              ? "Another player ended this game for everyone."
              : "This game may have ended or the link may be invalid."}
          </p>
          <button
            onClick={() => setLocation("/")}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          >
            Go Home
          </button>
        </div>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="h-full w-full max-w-lg mx-auto relative bg-background">
      <Suspense fallback={screenFallback}>
        {game.gameType === 'cricket' ? (
          <CricketGameScreen
            game={game as CricketGame}
            onGameUpdate={handleGameUpdate as (g: CricketGame) => void}
            onGameEnd={handleGameEnd as (g: CricketGame) => void}
            onLeave={handleLeave}
            onEndGame={handleEndGameForEveryone}
            playerCount={playerCount}
            isConnected={isConnected}
          />
        ) : (
          <X01GameScreen
            game={game as X01Game}
            onGameUpdate={handleGameUpdate as (g: X01Game) => void}
            onGameEnd={handleGameEnd as (g: X01Game) => void}
            onLeave={handleLeave}
            onEndGame={handleEndGameForEveryone}
            playerCount={playerCount}
            isConnected={isConnected}
          />
        )}
      </Suspense>
      <Toaster />
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full max-w-lg mx-auto flex items-center justify-center bg-background">
          <div className="text-center space-y-4 px-6">
            <p className="text-lg font-semibold text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground">An unexpected error occurred.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Route path="/" component={MainApp} />
        <Route path="/game/:gameId" component={SharedGameView} />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
