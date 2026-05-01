import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, X, Shuffle, Play } from "lucide-react";
import { loadPlayerNames, loadPlayerNamesFromDb } from "@/lib/game-logic";
import { GameType } from "@/lib/types";

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

function PlayerNameInput({
  value,
  onChange,
  placeholder,
  testId,
  savedNames,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  testId: string;
  savedNames: string[];
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? savedNames.filter(
        (n) =>
          n.toLowerCase().includes(value.toLowerCase()) &&
          n.toLowerCase() !== value.toLowerCase()
      )
    : savedNames;

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        data-testid={testId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-popover border border-border rounded-md shadow-md max-h-32 overflow-y-auto">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Button
          data-testid="button-setup-back"
          variant="ghost"
          size="icon"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Game Setup</h2>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5">
        {/* Game Type Selector */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-2">
            Game Type
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { type: 'cricket' as GameType, label: 'Cricket' },
              { type: 'x01' as GameType, label: '501', score: 501 },
              { type: 'x01' as GameType, label: '301', score: 301 },
            ]).map((opt) => (
              <Button
                key={opt.label}
                variant={gameType === opt.type && (opt.type === 'cricket' || startingScore === opt.score) ? 'default' : 'secondary'}
                size="sm"
                className="text-sm font-semibold"
                onClick={() => {
                  setGameType(opt.type);
                  if (opt.score) setStartingScore(opt.score);
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Cricket Options */}
        <AnimatePresence>
          {gameType === 'cricket' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-2">
                Mode
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  data-testid="button-cricket-mode-team"
                  variant={cricketMode === 'team' ? 'default' : 'secondary'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setCricketMode('team')}
                >
                  Teams
                </Button>
                <Button
                  data-testid="button-cricket-mode-solo"
                  variant={cricketMode === 'solo' ? 'default' : 'secondary'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setCricketMode('solo')}
                >
                  Solo
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* X01 Options */}
        <AnimatePresence>
          {gameType === 'x01' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3"
            >
              {/* Mode: Teams vs Individual */}
              <div>
                <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-2">
                  Mode
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant={x01Mode === 'team' ? 'default' : 'secondary'}
                    size="sm"
                    className="text-xs"
                    onClick={() => setX01Mode('team')}
                  >
                    Teams
                  </Button>
                  <Button
                    variant={x01Mode === 'individual' ? 'default' : 'secondary'}
                    size="sm"
                    className="text-xs"
                    onClick={() => setX01Mode('individual')}
                  >
                    Individual
                  </Button>
                </div>
              </div>

              {/* Double Out Toggle */}
              <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2.5">
                <span className="text-sm text-muted-foreground">Double Out</span>
                <button
                  type="button"
                  onClick={() => setDoubleOut(!doubleOut)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    doubleOut ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    doubleOut ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </motion.div>
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
              <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
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
                        onChange={(e) => setTeamName(e.target.value)}
                        className={`bg-transparent border-none outline-none text-base font-semibold ${teamColor} w-full`}
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

              {/* Goes First */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="pt-2"
              >
                <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-3">
                  <span className="text-sm text-muted-foreground">Goes first:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={firstTeam === 0 ? 'default' : 'ghost'}
                      onClick={() => setFirstTeam(0)}
                      className="text-xs"
                    >
                      {team1Name || 'Team 1'}
                    </Button>
                    <Button
                      size="sm"
                      variant={firstTeam === 1 ? 'default' : 'ghost'}
                      onClick={() => setFirstTeam(1)}
                      className="text-xs"
                    >
                      {team2Name || 'Team 2'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCoinFlip}
                      className="text-muted-foreground"
                    >
                      <Shuffle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="individual-setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
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

      <div className="p-4 border-t border-border">
        <Button
          data-testid="button-start-game"
          size="lg"
          className="w-full text-base gap-2"
          disabled={!canStart}
          onClick={handleStart}
        >
          <Play className="w-4 h-4" />
          Start {gameType === 'cricket' ? (isCricketSolo ? 'Solo Cricket' : 'Cricket') : startingScore} Game
        </Button>
      </div>
    </div>
  );
}
