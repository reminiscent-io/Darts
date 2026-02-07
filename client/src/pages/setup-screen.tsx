import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, X, Shuffle, Play } from "lucide-react";

interface SetupScreenProps {
  onBack: () => void;
  onStartGame: (
    team1Name: string,
    team1Players: string[],
    team2Name: string,
    team2Players: string[],
    firstTeamIndex: number
  ) => void;
}

export default function SetupScreen({ onBack, onStartGame }: SetupScreenProps) {
  const [team1Name, setTeam1Name] = useState("Team 1");
  const [team2Name, setTeam2Name] = useState("Team 2");
  const [team1Players, setTeam1Players] = useState<string[]>([""]);
  const [team2Players, setTeam2Players] = useState<string[]>([""]);
  const [firstTeam, setFirstTeam] = useState(0);

  const canStart = team1Players.length >= 1 && team2Players.length >= 1;

  const addPlayer = (team: 1 | 2) => {
    if (team === 1) {
      setTeam1Players([...team1Players, ""]);
    } else {
      setTeam2Players([...team2Players, ""]);
    }
  };

  const removePlayer = (team: 1 | 2, index: number) => {
    if (team === 1 && team1Players.length > 1) {
      setTeam1Players(team1Players.filter((_, i) => i !== index));
    } else if (team === 2 && team2Players.length > 1) {
      setTeam2Players(team2Players.filter((_, i) => i !== index));
    }
  };

  const updatePlayer = (team: 1 | 2, index: number, value: string) => {
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

  const handleCoinFlip = () => {
    setFirstTeam(Math.random() < 0.5 ? 0 : 1);
  };

  const handleStart = () => {
    const p1 = team1Players.map((p, i) => p.trim() || `Player ${i + 1}`);
    const p2 = team2Players.map((p, i) => p.trim() || `Player ${i + 1}`);
    onStartGame(team1Name, p1, team2Name, p2, firstTeam);
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
                    <input
                      data-testid={`input-team${teamNum}-player${idx}`}
                      type="text"
                      value={player}
                      onChange={(e) => updatePlayer(teamNum as 1 | 2, idx, e.target.value)}
                      placeholder={`Player ${idx + 1}`}
                      className="flex-1 bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                    />
                    {players.length > 1 && (
                      <Button
                        data-testid={`button-remove-team${teamNum}-player${idx}`}
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => removePlayer(teamNum as 1 | 2, idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  data-testid={`button-add-player-team${teamNum}`}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground gap-1 text-xs"
                  onClick={() => addPlayer(teamNum as 1 | 2)}
                >
                  <Plus className="w-3 h-3" />
                  Add Player
                </Button>
              </div>
            </motion.div>
          );
        })}

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
                data-testid="button-first-team1"
                size="sm"
                variant={firstTeam === 0 ? 'default' : 'ghost'}
                onClick={() => setFirstTeam(0)}
                className="text-xs"
              >
                {team1Name || 'Team 1'}
              </Button>
              <Button
                data-testid="button-first-team2"
                size="sm"
                variant={firstTeam === 1 ? 'default' : 'ghost'}
                onClick={() => setFirstTeam(1)}
                className="text-xs"
              >
                {team2Name || 'Team 2'}
              </Button>
              <Button
                data-testid="button-coin-flip"
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
          Start Game
        </Button>
      </div>
    </div>
  );
}
