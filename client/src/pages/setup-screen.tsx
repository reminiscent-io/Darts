import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, X, Shuffle, Play } from "lucide-react";
import { loadPlayerNames, loadPlayerNamesFromDb } from "@/lib/game-logic";
import { GameType } from "@/lib/types";
import PlayerNameInput from "@/components/player-name-input";

export interface GameSetupConfig {
  gameType: GameType;
  // Team mode (Cricket always, X01 optionally)
  team1Name: string;
  team1Players: string[];
  team2Name: string;
  team2Players: string[];
  firstTeamIndex: number;
  // X01 specific
  startingScore: number;
  doubleOut: boolean;
  x01Mode: 'team' | 'individual';
  // Individual mode players
  individualPlayers: string[];
  // Cricket-specific: solo toggle (single player vs no opponent)
  cricketMode: 'team' | 'solo';
  soloPlayer: string;
}

interface SetupScreenProps {
  onBack: () => void;
  onStartGame: (config: GameSetupConfig) => void;
}

export default function SetupScreen({ onBack, onStartGame }: SetupScreenProps) {
  // Game type
  const [gameType, setGameType] = useState<GameType>('cricket');

  // X01 options
  const [startingScore, setStartingScore] = useState(501);
  const [doubleOut, setDoubleOut] = useState(true);
  const [x01Mode, setX01Mode] = useState<'team' | 'individual'>('team');

  // Cricket options
  const [cricketMode, setCricketMode] = useState<'team' | 'solo'>('team');
  const [soloPlayer, setSoloPlayer] = useState("");

  // Team mode state
  const [team1Name, setTeam1Name] = useState("Team 1");
  const [team2Name, setTeam2Name] = useState("Team 2");
  const [team1Players, setTeam1Players] = useState<string[]>([""]);
  const [team2Players, setTeam2Players] = useState<string[]>([""]);
  const [firstTeam, setFirstTeam] = useState(0);

  // Individual mode state
  const [individualPlayers, setIndividualPlayers] = useState<string[]>(["", ""]);

  const [savedNames, setSavedNames] = useState<string[]>([]);

  useEffect(() => {
    setSavedNames(loadPlayerNames());
    loadPlayerNamesFromDb().then((names) => {
      if (names.length > 0) setSavedNames(names);
    });
  }, []);

  const isCricketSolo = gameType === 'cricket' && cricketMode === 'solo';
  const isTeamMode = !isCricketSolo && (gameType === 'cricket' || x01Mode === 'team');

  const canStart = isCricketSolo
    ? true
    : isTeamMode
      ? team1Players.length >= 1 && team2Players.length >= 1
      : individualPlayers.length >= 1;

  const addTeamPlayer = (team: 1 | 2) => {
    if (team === 1) {
      setTeam1Players([...team1Players, ""]);
    } else {
      setTeam2Players([...team2Players, ""]);
    }
  };

  const removeTeamPlayer = (team: 1 | 2, index: number) => {
    if (team === 1 && team1Players.length > 1) {
      setTeam1Players(team1Players.filter((_, i) => i !== index));
    } else if (team === 2 && team2Players.length > 1) {
      setTeam2Players(team2Players.filter((_, i) => i !== index));
    }
  };

  const updateTeamPlayer = (team: 1 | 2, index: number, value: string) => {
    if (team === 1) {
      const updated = [...team1Players];
      updated[index] = value;
      setTeam1Players(updated);
    } else {
      const updated = [...team2Players];
      updated[index] = value;
      setTeam2Players(updated);
    }
  };

  const addIndividualPlayer = () => {
    if (individualPlayers.length < 8) {
      setIndividualPlayers([...individualPlayers, ""]);
    }
  };

  const removeIndividualPlayer = (index: number) => {
    if (individualPlayers.length > 1) {
      setIndividualPlayers(individualPlayers.filter((_, i) => i !== index));
    }
  };

  const updateIndividualPlayer = (index: number, value: string) => {
    const updated = [...individualPlayers];
    updated[index] = value;
    setIndividualPlayers(updated);
  };

  const handleCoinFlip = () => {
    setFirstTeam(Math.random() < 0.5 ? 0 : 1);
  };

  const handleStart = () => {
    const config: GameSetupConfig = {
      gameType,
      team1Name,
      team1Players: team1Players.map((p, i) => p.trim() || `Player ${i + 1}`),
      team2Name,
      team2Players: team2Players.map((p, i) => p.trim() || `Player ${i + 1}`),
      firstTeamIndex: firstTeam,
      startingScore,
      doubleOut,
      x01Mode,
      individualPlayers: individualPlayers.map((p, i) => p.trim() || `Player ${i + 1}`),
      cricketMode,
      soloPlayer: soloPlayer.trim() || 'Player 1',
    };
    onStartGame(config);
  };

  let startLabel: string;
  if (gameType === 'cricket') {
    startLabel = isCricketSolo ? 'Solo Cricket' : 'Cricket';
  } else {
    startLabel = String(startingScore);
  }

  const gameTypeOptions = [
    { kind: 'cricket' as GameType, label: 'CRICKET', score: undefined as number | undefined },
    { kind: 'x01' as GameType, label: '501', score: 501 },
    { kind: 'x01' as GameType, label: '301', score: 301 },
  ];
  const isGameTypeActive = (opt: typeof gameTypeOptions[number]) =>
    gameType === opt.kind && (opt.kind === 'cricket' || startingScore === opt.score);

  return (
    <main className="h-full flex flex-col overflow-y-auto">
      <header className="flex items-center gap-3 px-3 pt-3 pb-1">
        <Button
          data-testid="button-setup-back"
          variant="ghost"
          size="icon"
          aria-label="Back to home"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase">
          Game Setup
        </h2>
      </header>

      <div className="flex-1 px-4 pt-3 pb-6 space-y-7">
        {/* Game Type — anchor of the screen */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-2.5"
        >
          <div className="text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase">
            Game Type
          </div>
          <div className="grid grid-cols-3 gap-2">
            {gameTypeOptions.map((opt) => {
              const active = isGameTypeActive(opt);
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setGameType(opt.kind);
                    if (opt.score) setStartingScore(opt.score);
                  }}
                  className={`relative min-h-[76px] rounded-md border transition-colors hover-elevate active-elevate-2 flex items-center justify-center ${
                    active
                      ? 'bg-accent border-primary/50'
                      : 'bg-card/40 border-border'
                  }`}
                >
                  <span
                    className={`font-mono font-bold leading-none ${
                      opt.kind === 'cricket'
                        ? 'text-[15px] tracking-[0.22em]'
                        : 'text-[34px] tracking-tight'
                    } ${active ? 'text-primary' : 'text-foreground'}`}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Mode — segmented sub-toggle, visually subordinate */}
        <AnimatePresence initial={false}>
          {gameType === 'cricket' && (
            <motion.section
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <div className="space-y-2.5">
                <div className="text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase">
                  Mode
                </div>
                <div className="grid grid-cols-2 rounded-md border border-border bg-card/40 p-1 gap-1">
                  {([
                    { value: 'team', label: 'Teams', testId: 'button-cricket-mode-team' },
                    { value: 'solo', label: 'Solo', testId: 'button-cricket-mode-solo' },
                  ] as const).map((opt) => {
                    const active = cricketMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        data-testid={opt.testId}
                        type="button"
                        onClick={() => setCricketMode(opt.value)}
                        className={`relative rounded-sm py-1.5 text-xs font-medium transition-colors hover-elevate active-elevate-2 ${
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {gameType === 'x01' && (
            <motion.section
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <div className="space-y-2.5">
                <div className="text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase">
                  Mode
                </div>
                <div className="grid grid-cols-2 rounded-md border border-border bg-card/40 p-1 gap-1">
                  {([
                    { value: 'team', label: 'Teams' },
                    { value: 'individual', label: 'Individual' },
                  ] as const).map((opt) => {
                    const active = x01Mode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setX01Mode(opt.value)}
                        className={`relative rounded-sm py-1.5 text-xs font-medium transition-colors hover-elevate active-elevate-2 ${
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Double Out — quiet divider row, not a surface */}
                <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/40">
                  <span className="text-sm text-muted-foreground">Double Out</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={doubleOut}
                    aria-label="Double out"
                    onClick={() => setDoubleOut(!doubleOut)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      doubleOut ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
                      doubleOut ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Team Setup or Individual Player Setup */}
        <AnimatePresence mode="wait">
          {isCricketSolo ? (
            <motion.div
              key="solo-setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase">
                Player
              </div>
              <PlayerNameInput
                value={soloPlayer}
                onChange={setSoloPlayer}
                placeholder="Player 1"
                testId="input-solo-player"
                savedNames={savedNames}
              />
              <p className="text-xs text-muted-foreground/60">
                Close all numbers (15-20, Bull) to win.
              </p>
            </motion.div>
          ) : isTeamMode ? (
            <motion.div
              key="team-setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {[1, 2].map((teamNum) => {
                const teamName = teamNum === 1 ? team1Name : team2Name;
                const setTeamName = teamNum === 1 ? setTeam1Name : setTeam2Name;
                const players = teamNum === 1 ? team1Players : team2Players;
                const teamColor = teamNum === 1 ? "text-primary" : "text-chart-2";

                return (
                  <motion.div
                    key={teamNum}
                    initial={{ opacity: 0, x: teamNum === 1 ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: teamNum * 0.1 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${teamNum === 1 ? 'bg-primary' : 'bg-chart-2'}`} />
                      <input
                        data-testid={`input-team${teamNum}-name`}
                        type="text"
                        value={teamName}
                        aria-label={`Team ${teamNum} name`}
                        onChange={(e) => setTeamName(e.target.value)}
                        className={`bg-transparent border-none outline-none rounded-sm focus-visible:ring-1 focus-visible:ring-ring text-base font-semibold ${teamColor} w-full`}
                        placeholder={`Team ${teamNum}`}
                      />
                    </div>

                    <div className="space-y-2 pl-4">
                      {players.map((player, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <PlayerNameInput
                            value={player}
                            onChange={(val) => updateTeamPlayer(teamNum as 1 | 2, idx, val)}
                            placeholder={`Player ${idx + 1}`}
                            testId={`input-team${teamNum}-player${idx}`}
                            savedNames={savedNames}
                          />
                          {players.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground"
                              aria-label={`Remove player ${idx + 1} from team ${teamNum}`}
                              onClick={() => removeTeamPlayer(teamNum as 1 | 2, idx)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground gap-1 text-xs"
                        onClick={() => addTeamPlayer(teamNum as 1 | 2)}
                      >
                        <Plus className="w-3 h-3" />
                        Add Player
                      </Button>
                    </div>
                  </motion.div>
                );
              })}

              {/* Goes First — own labeled section */}
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2.5 pt-2"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase">
                    Goes First
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCoinFlip}
                    className="text-muted-foreground gap-1.5 -mr-2 h-7 text-[11px] tracking-wider uppercase"
                  >
                    <Shuffle className="w-3 h-3" />
                    Coin flip
                  </Button>
                </div>
                <div className="grid grid-cols-2 rounded-md border border-border bg-card/40 p-1 gap-1">
                  {[0, 1].map((idx) => {
                    const active = firstTeam === idx;
                    const name = idx === 0 ? (team1Name || 'Team 1') : (team2Name || 'Team 2');
                    const dotColor = idx === 0 ? 'bg-primary' : 'bg-chart-2';
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFirstTeam(idx)}
                        className={`relative rounded-sm py-2 text-xs font-medium transition-colors hover-elevate active-elevate-2 flex items-center justify-center gap-2 ${
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${active ? '' : 'opacity-60'}`} />
                        <span className="truncate max-w-[14ch]">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            </motion.div>
          ) : (
            <motion.div
              key="individual-setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase">
                Players
              </div>
              <div className="space-y-2">
                {individualPlayers.map((player, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
                    <PlayerNameInput
                      value={player}
                      onChange={(val) => updateIndividualPlayer(idx, val)}
                      placeholder={`Player ${idx + 1}`}
                      testId={`input-individual-player${idx}`}
                      savedNames={savedNames}
                    />
                    {individualPlayers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground"
                        aria-label={`Remove player ${idx + 1}`}
                        onClick={() => removeIndividualPlayer(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </motion.div>
                ))}
                {individualPlayers.length < 8 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground gap-1 text-xs"
                    onClick={addIndividualPlayer}
                  >
                    <Plus className="w-3 h-3" />
                    Add Player
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="p-4 border-t border-border">
        <Button
          data-testid="button-start-game"
          size="lg"
          className="w-full text-base gap-2"
          disabled={!canStart}
          onClick={handleStart}
        >
          <Play className="w-4 h-4" />
          Start {startLabel}
        </Button>
      </footer>
    </main>
  );
}
