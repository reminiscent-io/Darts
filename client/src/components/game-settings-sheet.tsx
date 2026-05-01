import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChevronUp, ChevronDown } from "lucide-react";
import PlayerNameInput from "@/components/player-name-input";
import {
  Game,
  X01Game,
  PlayerRef,
} from "@/lib/types";
import {
  renamePlayer,
  renameTeam,
  reorderUpcomingTurns,
  loadPlayerNames,
  loadPlayerNamesFromDb,
  savePlayerNames,
} from "@/lib/game-logic";
import { setDoubleOut } from "@/lib/x01-game-logic";

function TeamNameInput({
  team,
  onCommit,
}: {
  team: { id: string; name: string };
  onCommit: (val: string) => void;
}) {
  const [localValue, setLocalValue] = useState(team.name);

  useEffect(() => {
    setLocalValue(team.name);
  }, [team.name]);

  return (
    <input
      data-testid={`settings-team-name-${team.id}`}
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onCommit(localValue)}
      className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm font-semibold outline-none focus:border-primary/50"
    />
  );
}

interface GameSettingsSheetProps {
  game: Game;
  onGameUpdate: (game: Game) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GameSettingsSheet({
  game,
  onGameUpdate,
  open,
  onOpenChange,
}: GameSettingsSheetProps) {
  const [savedNames, setSavedNames] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSavedNames(loadPlayerNames());
    loadPlayerNamesFromDb().then((names) => {
      if (names.length > 0) setSavedNames(names);
    });
  }, [open]);

  const isTeamMode = game.mode === "team";

  const showTurnOrder = game.turnOrder.length > 1;

  const commitTeamName = (teamId: string, currentName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) return;
    onGameUpdate(renameTeam(game, teamId, trimmed));
  };

  const commitPlayerName = (playerId: string, currentName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) return;
    const updated = renamePlayer(game, playerId, trimmed);
    onGameUpdate(updated);
    savePlayerNames([trimmed]);
  };

  const handleDoubleOutToggle = () => {
    if (game.gameType !== "x01") return;
    onGameUpdate(setDoubleOut(game as X01Game, !(game as X01Game).doubleOut));
  };

  // Build the upcoming queue: refs at positions [(current+1) % len .. (current-1) % len]
  const len = game.turnOrder.length;
  const upcoming: PlayerRef[] = [];
  for (let i = 1; i < len; i++) {
    upcoming.push(game.turnOrder[(game.currentTurnIndex + i) % len]);
  }

  const moveUpcoming = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= upcoming.length) return;
    const reordered = [...upcoming];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    onGameUpdate(reorderUpcomingTurns(game, reordered));
  };

  const playerNameByRef = (ref: PlayerRef): string => {
    const team = game.teams[ref.teamIndex];
    return team.players.find((p) => p.id === ref.playerId)?.name ?? "Player";
  };

  const currentRef = game.turnOrder[game.currentTurnIndex];
  const currentName = playerNameByRef(currentRef);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Game Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pt-4">
          {/* Section 1: Names */}
          <section className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
              {isTeamMode ? "Teams & Players" : "Players"}
            </div>

            {isTeamMode
              ? game.teams.map((team) => (
                  <div key={team.id} className="space-y-2">
                    <TeamNameInput
                      team={team}
                      onCommit={(val) => commitTeamName(team.id, team.name, val)}
                    />
                    <div className="space-y-2 pl-3">
                      {team.players.map((p) => (
                        <PlayerNameInput
                          key={p.id}
                          value={p.name}
                          onCommit={(val) => commitPlayerName(p.id, p.name, val)}
                          placeholder={p.name}
                          testId={`settings-player-name-${p.id}`}
                          savedNames={savedNames}
                        />
                      ))}
                    </div>
                  </div>
                ))
              : game.teams.map((team) => {
                  const player = team.players[0];
                  return (
                    <PlayerNameInput
                      key={player.id}
                      value={player.name}
                      onCommit={(val) => commitPlayerName(player.id, player.name, val)}
                      placeholder={player.name}
                      testId={`settings-player-name-${player.id}`}
                      savedNames={savedNames}
                    />
                  );
                })}
          </section>

          {/* Section 2: Rules (X01 only) */}
          {game.gameType === "x01" && (
            <section className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
                Rules
              </div>
              <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2.5">
                <span className="text-sm text-muted-foreground">Double Out</span>
                <button
                  type="button"
                  data-testid="settings-double-out-toggle"
                  onClick={handleDoubleOutToggle}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    (game as X01Game).doubleOut ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      (game as X01Game).doubleOut ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </section>
          )}

          {/* Section 3: Turn order */}
          {showTurnOrder && (
            <section className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase">
                Turn Order
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-primary/10 rounded-md px-3 py-2">
                  <span className="text-sm font-medium">{currentName}</span>
                  <span className="text-xs text-primary uppercase tracking-wider">
                    Now throwing
                  </span>
                </div>
                {upcoming.map((ref, idx) => (
                  <div
                    key={ref.playerId}
                    className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2"
                  >
                    <span className="text-sm">{playerNameByRef(ref)}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === 0}
                        onClick={() => moveUpcoming(idx, -1)}
                        data-testid={`settings-move-up-${idx}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === upcoming.length - 1}
                        onClick={() => moveUpcoming(idx, 1)}
                        data-testid={`settings-move-down-${idx}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
