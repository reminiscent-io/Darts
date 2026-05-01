# In-Game Settings Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings button to in-game screens that opens a bottom sheet for editing player names, team names, X01 double-out, and turn order — without restarting the game.

**Architecture:** Introduce four pure helper functions (`renamePlayer`, `renameTeam`, `reorderUpcomingTurns` in `game-logic.ts`; `setDoubleOut` in `x01-game-logic.ts`). Build a single `GameSettingsSheet` component used by both `cricket-game-screen.tsx` and `x01-game-screen.tsx`. Edits flow through the existing `onGameUpdate` → `saveGame` → REST + WebSocket path. Tests cover helpers; UI is verified by manual smoke against the dev server.

**Tech Stack:** React 18, TypeScript, shadcn/ui (Sheet component already present), Tailwind, Vitest, Drizzle/PostgreSQL (touched only via existing endpoints).

---

## File Structure

**New files:**
- `client/src/components/player-name-input.tsx` — extracted from `setup-screen.tsx`, reused by setup and the settings sheet.
- `client/src/components/game-settings-sheet.tsx` — the bottom sheet UI, conditional on `gameType` and `mode`.
- `client/src/lib/game-logic.test.ts` — unit tests for shared helpers (`renamePlayer`, `renameTeam`, `reorderUpcomingTurns`).

**Modified files:**
- `client/src/lib/game-logic.ts` — add `renamePlayer`, `renameTeam`, `reorderUpcomingTurns`.
- `client/src/lib/x01-game-logic.ts` — add `setDoubleOut`.
- `client/src/lib/x01-game-logic.test.ts` — add `setDoubleOut` tests.
- `client/src/pages/setup-screen.tsx` — replace inline `PlayerNameInput` with import from new module.
- `client/src/pages/cricket-game-screen.tsx` — add gear button + sheet wiring.
- `client/src/pages/x01-game-screen.tsx` — add gear button + sheet wiring.

---

## Task 1: Extract `PlayerNameInput` to a shared component

**Why first:** The settings sheet reuses this component; extracting it now avoids a duplicate later. Pure refactor — no behavior change.

**Files:**
- Create: `client/src/components/player-name-input.tsx`
- Modify: `client/src/pages/setup-screen.tsx` (remove local function, add import)

- [ ] **Step 1: Create the new component file**

Create `client/src/components/player-name-input.tsx` with this content (lifted verbatim from `setup-screen.tsx` lines 32-93):

```tsx
import { useState, useRef } from "react";

interface PlayerNameInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  testId: string;
  savedNames: string[];
}

export default function PlayerNameInput({
  value,
  onChange,
  placeholder,
  testId,
  savedNames,
}: PlayerNameInputProps) {
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
```

- [ ] **Step 2: Update `setup-screen.tsx` to import the extracted component**

In `client/src/pages/setup-screen.tsx`:

1. Add to the imports at the top:
```tsx
import PlayerNameInput from "@/components/player-name-input";
```

2. Delete the local `PlayerNameInput` function (currently lines 32-93 — the entire `function PlayerNameInput(...) { ... }` block).

3. Delete `useRef` from the React import on line 1 if it's no longer used. Check: search the rest of the file for `useRef` — if nothing else uses it, change line 1 from:
```tsx
import { useState, useRef, useEffect } from "react";
```
to:
```tsx
import { useState, useEffect } from "react";
```

- [ ] **Step 3: Verify the app still builds and setup screen still works**

Run: `npm run check`
Expected: 0 errors.

Run: `npm run dev` and navigate to setup → confirm autocomplete still works on the player name fields (focus a field, see saved names dropdown). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/player-name-input.tsx client/src/pages/setup-screen.tsx
git commit -m "Extract PlayerNameInput to shared component"
```

---

## Task 2: Add `renameTeam` helper + tests

**Files:**
- Modify: `client/src/lib/game-logic.ts`
- Create: `client/src/lib/game-logic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/lib/game-logic.test.ts` with this content:

```ts
import { describe, it, expect } from 'vitest';
import { createCricketGame, createSoloCricketGame, renameTeam, renamePlayer, reorderUpcomingTurns } from './game-logic';

describe('renameTeam', () => {
  it('renames the matching team and leaves others untouched', () => {
    const game = createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']);
    const team1Id = game.teams[0].id;
    const team2Id = game.teams[1].id;

    const result = renameTeam(game, team1Id, 'Crimson');

    expect(result.teams[0].name).toBe('Crimson');
    expect(result.teams[1].name).toBe('Blues');
    expect(result.teams[0].id).toBe(team1Id);
    expect(result.teams[1].id).toBe(team2Id);
  });

  it('returns a new game object (immutable update)', () => {
    const game = createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']);
    const result = renameTeam(game, game.teams[0].id, 'Crimson');
    expect(result).not.toBe(game);
    expect(game.teams[0].name).toBe('Reds');
  });

  it('is a no-op when teamId does not match', () => {
    const game = createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']);
    const result = renameTeam(game, 'nonexistent-id', 'Crimson');
    expect(result.teams[0].name).toBe('Reds');
    expect(result.teams[1].name).toBe('Blues');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/game-logic.test.ts`
Expected: FAIL — `renameTeam is not exported from './game-logic'` (or similar import error).

- [ ] **Step 3: Implement `renameTeam`**

In `client/src/lib/game-logic.ts`, add this function after `confirmWin` (around line 348):

```ts
export function renameTeam(game: Game, teamId: string, name: string): Game {
  const newTeams = game.teams.map(t =>
    t.id === teamId ? { ...t, name } : t
  );
  return { ...game, teams: newTeams } as Game;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/lib/game-logic.test.ts -t "renameTeam"`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/game-logic.ts client/src/lib/game-logic.test.ts
git commit -m "Add renameTeam helper for in-game team renaming"
```

---

## Task 3: Add `renamePlayer` helper + tests

**Files:**
- Modify: `client/src/lib/game-logic.ts`
- Modify: `client/src/lib/game-logic.test.ts`

- [ ] **Step 1: Write the failing test**

In `client/src/lib/game-logic.test.ts`, add this `describe` block after the `renameTeam` block:

```ts
describe('renamePlayer', () => {
  it('renames the matching player on their team', () => {
    const game = createCricketGame('Reds', ['Alice', 'Bob'], 'Blues', ['Carol']);
    const aliceId = game.teams[0].players[0].id;

    const result = renamePlayer(game, aliceId, 'Alicia');

    expect(result.teams[0].players[0].name).toBe('Alicia');
    expect(result.teams[0].players[0].id).toBe(aliceId);
    expect(result.teams[0].players[1].name).toBe('Bob');
    expect(result.teams[1].players[0].name).toBe('Carol');
  });

  it('preserves dart history references after rename', () => {
    const game = createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']);
    const aliceId = game.teams[0].players[0].id;
    const fakeGame = {
      ...game,
      dartHistory: [{
        id: 'd1',
        playerId: aliceId,
        teamId: game.teams[0].id,
        target: 20 as const,
        multiplier: 1 as const,
        pointsScored: 0,
        marksApplied: 1,
        timestamp: '2026-05-01T00:00:00Z',
      }],
    };

    const result = renamePlayer(fakeGame, aliceId, 'Alicia');

    expect(result.dartHistory).toEqual(fakeGame.dartHistory);
    expect(result.teams[0].players[0].name).toBe('Alicia');
  });

  it('returns a new game object (immutable update)', () => {
    const game = createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']);
    const aliceId = game.teams[0].players[0].id;
    const result = renamePlayer(game, aliceId, 'Alicia');
    expect(result).not.toBe(game);
    expect(game.teams[0].players[0].name).toBe('Alice');
  });

  it('is a no-op when playerId does not match', () => {
    const game = createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']);
    const result = renamePlayer(game, 'nonexistent-id', 'Alicia');
    expect(result.teams[0].players[0].name).toBe('Alice');
    expect(result.teams[1].players[0].name).toBe('Bob');
  });

  it('also updates the team name when in solo cricket (team name === player name)', () => {
    const game = createSoloCricketGame('Alice');
    const aliceId = game.teams[0].players[0].id;

    const result = renamePlayer(game, aliceId, 'Alicia');

    expect(result.teams[0].players[0].name).toBe('Alicia');
    expect(result.teams[0].name).toBe('Alicia');
  });
});
```

Note on the last test: in solo Cricket, `team.name === player.name` (see `createSoloCricketGame` in `game-logic.ts:62-88`). Renaming the player should keep them in sync.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/game-logic.test.ts -t "renamePlayer"`
Expected: FAIL — `renamePlayer is not exported from './game-logic'`.

- [ ] **Step 3: Implement `renamePlayer`**

In `client/src/lib/game-logic.ts`, add this function after `renameTeam`:

```ts
export function renamePlayer(game: Game, playerId: string, name: string): Game {
  const newTeams = game.teams.map(t => {
    const playerIdx = t.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return t;
    const newPlayers = t.players.map((p, i) =>
      i === playerIdx ? { ...p, name } : p
    );
    // Solo cricket convention: team.name mirrors the single player's name.
    const isSoloTeam = t.players.length === 1 && t.name === t.players[0].name;
    return {
      ...t,
      players: newPlayers,
      ...(isSoloTeam ? { name } : {}),
    };
  });
  return { ...game, teams: newTeams } as Game;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/lib/game-logic.test.ts -t "renamePlayer"`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/game-logic.ts client/src/lib/game-logic.test.ts
git commit -m "Add renamePlayer helper preserving dart history and solo-team mirror"
```

---

## Task 4: Add `reorderUpcomingTurns` helper + tests

**Files:**
- Modify: `client/src/lib/game-logic.ts`
- Modify: `client/src/lib/game-logic.test.ts`

**Context for the engineer:** `game.turnOrder` is a flat `PlayerRef[]` array; `currentTurnIndex` points into it. The "upcoming" players are those at positions `(currentTurnIndex + 1) % len, (currentTurnIndex + 2) % len, ...`, wrapping back to just before `currentTurnIndex`. There are exactly `len - 1` upcoming positions.

`reorderUpcomingTurns(game, newUpcoming)` must:
1. Keep `game.turnOrder[currentTurnIndex]` in place (the current player).
2. Place `newUpcoming[0]` at `(currentTurnIndex + 1) % len`, `newUpcoming[1]` at `(currentTurnIndex + 2) % len`, etc.
3. `currentTurnIndex` itself stays the same number.

- [ ] **Step 1: Write the failing test**

In `client/src/lib/game-logic.test.ts`, add this `describe` block:

```ts
describe('reorderUpcomingTurns', () => {
  it('preserves the current player at currentTurnIndex', () => {
    const game = createCricketGame('Reds', ['Alice', 'Bob'], 'Blues', ['Carol', 'Dave']);
    // turnOrder: [Alice, Carol, Bob, Dave]
    const originalCurrent = game.turnOrder[game.currentTurnIndex];

    // Reverse the upcoming order
    const upcoming = [];
    const len = game.turnOrder.length;
    for (let i = 1; i < len; i++) {
      upcoming.push(game.turnOrder[(game.currentTurnIndex + i) % len]);
    }
    const reversed = [...upcoming].reverse();

    const result = reorderUpcomingTurns(game, reversed);

    expect(result.currentTurnIndex).toBe(game.currentTurnIndex);
    expect(result.turnOrder[result.currentTurnIndex]).toEqual(originalCurrent);
  });

  it('places the new upcoming order in the correct circular positions', () => {
    const game = createCricketGame('Reds', ['Alice', 'Bob'], 'Blues', ['Carol', 'Dave']);
    // turnOrder: [Alice, Carol, Bob, Dave], currentTurnIndex=0
    const len = game.turnOrder.length;
    const aliceRef = game.turnOrder[0];
    const carolRef = game.turnOrder[1];
    const bobRef = game.turnOrder[2];
    const daveRef = game.turnOrder[3];

    // New upcoming: [Dave, Bob, Carol]
    const result = reorderUpcomingTurns(game, [daveRef, bobRef, carolRef]);

    expect(result.turnOrder[0]).toEqual(aliceRef);
    expect(result.turnOrder[1]).toEqual(daveRef);
    expect(result.turnOrder[2]).toEqual(bobRef);
    expect(result.turnOrder[3]).toEqual(carolRef);
  });

  it('handles a non-zero currentTurnIndex correctly', () => {
    const game = createCricketGame('Reds', ['Alice', 'Bob'], 'Blues', ['Carol', 'Dave']);
    // turnOrder: [Alice, Carol, Bob, Dave]
    const advancedGame = { ...game, currentTurnIndex: 2 };
    // Now current is Bob (index 2). Upcoming order is [Dave (3), Alice (0), Carol (1)].
    const aliceRef = advancedGame.turnOrder[0];
    const carolRef = advancedGame.turnOrder[1];
    const bobRef = advancedGame.turnOrder[2];
    const daveRef = advancedGame.turnOrder[3];

    // New upcoming: [Carol, Alice, Dave]
    const result = reorderUpcomingTurns(advancedGame, [carolRef, aliceRef, daveRef]);

    expect(result.currentTurnIndex).toBe(2);
    expect(result.turnOrder[2]).toEqual(bobRef);
    expect(result.turnOrder[3]).toEqual(carolRef);
    expect(result.turnOrder[0]).toEqual(aliceRef);
    expect(result.turnOrder[1]).toEqual(daveRef);
  });

  it('is a no-op when the supplied order matches the existing upcoming order', () => {
    const game = createCricketGame('Reds', ['Alice', 'Bob'], 'Blues', ['Carol', 'Dave']);
    const len = game.turnOrder.length;
    const upcoming = [];
    for (let i = 1; i < len; i++) {
      upcoming.push(game.turnOrder[(game.currentTurnIndex + i) % len]);
    }

    const result = reorderUpcomingTurns(game, upcoming);

    expect(result.turnOrder).toEqual(game.turnOrder);
    expect(result.currentTurnIndex).toBe(game.currentTurnIndex);
  });

  it('returns a new game object (immutable update)', () => {
    const game = createCricketGame('Reds', ['Alice', 'Bob'], 'Blues', ['Carol', 'Dave']);
    const len = game.turnOrder.length;
    const upcoming = [];
    for (let i = 1; i < len; i++) {
      upcoming.push(game.turnOrder[(game.currentTurnIndex + i) % len]);
    }
    const result = reorderUpcomingTurns(game, upcoming);
    expect(result).not.toBe(game);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/game-logic.test.ts -t "reorderUpcomingTurns"`
Expected: FAIL — `reorderUpcomingTurns is not exported`.

- [ ] **Step 3: Implement `reorderUpcomingTurns`**

In `client/src/lib/game-logic.ts`, add this function after `renamePlayer`:

```ts
export function reorderUpcomingTurns(game: Game, newUpcoming: PlayerRef[]): Game {
  const len = game.turnOrder.length;
  if (newUpcoming.length !== len - 1) return game;

  const newTurnOrder = [...game.turnOrder];
  for (let i = 0; i < newUpcoming.length; i++) {
    const pos = (game.currentTurnIndex + 1 + i) % len;
    newTurnOrder[pos] = newUpcoming[i];
  }
  return { ...game, turnOrder: newTurnOrder } as Game;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/lib/game-logic.test.ts -t "reorderUpcomingTurns"`
Expected: 5 tests pass.

Run the full test file to ensure no regression: `npx vitest run client/src/lib/game-logic.test.ts`
Expected: all tests pass (3 + 5 + 5 = 13 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/game-logic.ts client/src/lib/game-logic.test.ts
git commit -m "Add reorderUpcomingTurns helper preserving current player"
```

---

## Task 5: Add `setDoubleOut` helper + tests

**Files:**
- Modify: `client/src/lib/x01-game-logic.ts`
- Modify: `client/src/lib/x01-game-logic.test.ts`

- [ ] **Step 1: Write the failing test**

Open `client/src/lib/x01-game-logic.test.ts`. Add `setDoubleOut` to the import on line 2:

```ts
import {
  createX01Game,
  recordX01Dart,
  undoLastX01Dart,
  removeX01DartAtIndex,
  getDartPointValue,
  getX01PlayerStats,
  getCurrentTurnTotal,
  setDoubleOut,
} from './x01-game-logic';
```

Append this `describe` block at the end of the file:

```ts
describe('setDoubleOut', () => {
  it('flips the doubleOut flag', () => {
    const game = createX01Game({
      startingScore: 501,
      doubleOut: false,
      mode: 'individual',
      playerNames: ['Alice', 'Bob'],
    });

    const enabled = setDoubleOut(game, true);
    expect(enabled.doubleOut).toBe(true);

    const disabled = setDoubleOut(enabled, false);
    expect(disabled.doubleOut).toBe(false);
  });

  it('preserves remainingScore for every team', () => {
    const game = createX01Game({
      startingScore: 501,
      doubleOut: false,
      mode: 'individual',
      playerNames: ['Alice', 'Bob'],
    });
    const afterDart = recordX01Dart(game, 20, 3).game; // -60
    expect(afterDart.teams[0].remainingScore).toBe(441);

    const toggled = setDoubleOut(afterDart, true);
    expect(toggled.teams[0].remainingScore).toBe(441);
    expect(toggled.teams[1].remainingScore).toBe(501);
  });

  it('preserves dart history', () => {
    const game = createX01Game({
      startingScore: 301,
      doubleOut: false,
      mode: 'individual',
      playerNames: ['Alice', 'Bob'],
    });
    const afterDart = recordX01Dart(game, 20, 1).game;

    const toggled = setDoubleOut(afterDart, true);
    expect(toggled.dartHistory).toEqual(afterDart.dartHistory);
    expect(toggled.currentTurnDarts).toEqual(afterDart.currentTurnDarts);
  });

  it('returns a new game object (immutable update)', () => {
    const game = createX01Game({
      startingScore: 501,
      doubleOut: false,
      mode: 'individual',
      playerNames: ['Alice', 'Bob'],
    });
    const result = setDoubleOut(game, true);
    expect(result).not.toBe(game);
    expect(game.doubleOut).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/lib/x01-game-logic.test.ts -t "setDoubleOut"`
Expected: FAIL — `setDoubleOut is not exported`.

- [ ] **Step 3: Implement `setDoubleOut`**

In `client/src/lib/x01-game-logic.ts`, append this function at the end of the file:

```ts
export function setDoubleOut(game: X01Game, doubleOut: boolean): X01Game {
  return { ...game, doubleOut };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/lib/x01-game-logic.test.ts -t "setDoubleOut"`
Expected: 4 tests pass.

Run the full file to confirm no regression: `npx vitest run client/src/lib/x01-game-logic.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/x01-game-logic.ts client/src/lib/x01-game-logic.test.ts
git commit -m "Add setDoubleOut helper for mid-game X01 rule toggle"
```

---

## Task 6: Build `GameSettingsSheet` component

**Files:**
- Create: `client/src/components/game-settings-sheet.tsx`

This is a UI-only task. It uses helpers from Tasks 2-5. There are no unit tests for this component (UI behavior is verified by manual smoke in Task 8); the helpers it calls are already covered.

- [ ] **Step 1: Create the component file**

Create `client/src/components/game-settings-sheet.tsx`:

```tsx
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

  const isTeamMode =
    (game.gameType === "cricket" && game.mode === "team") ||
    (game.gameType === "x01" && game.mode === "team");

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
                    <input
                      data-testid={`settings-team-name-${team.id}`}
                      type="text"
                      defaultValue={team.name}
                      onBlur={(e) => commitTeamName(team.id, team.name, e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm font-semibold outline-none focus:border-primary/50"
                    />
                    <div className="space-y-2 pl-3">
                      {team.players.map((p) => (
                        <PlayerNameInput
                          key={p.id}
                          value={p.name}
                          onChange={() => {}}
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
                      onChange={() => {}}
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
                    key={`${ref.playerId}-${idx}`}
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
```

**Important note on `PlayerNameInput`:** The `PlayerNameInput` component is currently designed to be controlled (`value`/`onChange`). For settings, we want commit-on-blur, not on every keystroke. Step 2 below adapts the component to accept an optional `onCommit` prop for blur-based commits, which the settings sheet uses.

- [ ] **Step 2: Extend `PlayerNameInput` with an optional `onCommit` prop**

Update `client/src/components/player-name-input.tsx` to support both the existing controlled mode (used by setup) and a commit-on-blur mode (used by settings). Replace the file with:

```tsx
import { useState, useRef, useEffect } from "react";

interface PlayerNameInputProps {
  value: string;
  onChange?: (val: string) => void;
  onCommit?: (val: string) => void;
  placeholder: string;
  testId: string;
  savedNames: string[];
}

export default function PlayerNameInput({
  value,
  onChange,
  onCommit,
  placeholder,
  testId,
  savedNames,
}: PlayerNameInputProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Re-sync if the upstream value changes (e.g., remote update via WebSocket)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const filtered = localValue.trim()
    ? savedNames.filter(
        (n) =>
          n.toLowerCase().includes(localValue.toLowerCase()) &&
          n.toLowerCase() !== localValue.toLowerCase()
      )
    : savedNames;

  const showDropdown = open && filtered.length > 0;

  const handleChange = (next: string) => {
    setLocalValue(next);
    if (onChange) onChange(next);
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 150);
    if (onCommit && localValue !== value) {
      onCommit(localValue);
    }
  };

  const handlePick = (name: string) => {
    setLocalValue(name);
    if (onChange) onChange(name);
    if (onCommit) onCommit(name);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        data-testid={testId}
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
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
              onClick={() => handlePick(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

This keeps the setup-screen behavior unchanged (it passes `onChange` only) while letting the settings sheet pass `onCommit` for blur-based commits.

- [ ] **Step 3: Wire `onCommit` into the settings sheet**

In `client/src/components/game-settings-sheet.tsx`, replace each `PlayerNameInput` usage so the player-name commit fires on blur. Update the team-mode block (the one with `data-testid={`settings-player-name-${p.id}`}`):

Replace:
```tsx
<PlayerNameInput
  key={p.id}
  value={p.name}
  onChange={() => {}}
  placeholder={p.name}
  testId={`settings-player-name-${p.id}`}
  savedNames={savedNames}
/>
```

with:
```tsx
<PlayerNameInput
  key={p.id}
  value={p.name}
  onCommit={(val) => commitPlayerName(p.id, p.name, val)}
  placeholder={p.name}
  testId={`settings-player-name-${p.id}`}
  savedNames={savedNames}
/>
```

Apply the same change to the individual-mode block (the `game.teams.map((team) => { const player = team.players[0]; ... })` section).

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/game-settings-sheet.tsx client/src/components/player-name-input.tsx
git commit -m "Add GameSettingsSheet for in-game name and rule edits"
```

---

## Task 7: Wire the gear button into both game screens

**Files:**
- Modify: `client/src/pages/cricket-game-screen.tsx`
- Modify: `client/src/pages/x01-game-screen.tsx`

- [ ] **Step 1: Wire into cricket-game-screen**

In `client/src/pages/cricket-game-screen.tsx`:

1. Update the lucide-react import on line 4 to include `Settings`:
```tsx
import { Undo2, ChevronRight, X, Home, Settings } from "lucide-react";
```

2. Add an import for the sheet near the other component imports (after the `LongPressScoreButton` import):
```tsx
import GameSettingsSheet from "@/components/game-settings-sheet";
```

3. Add a `useState` near the other `useState` calls in the component body (around line 33):
```tsx
const [showSettings, setShowSettings] = useState(false);
```

4. Find the header block at line 209:
```tsx
<div className="flex items-center justify-between px-2 py-1 border-b border-border flex-shrink-0 bg-muted/10">
  <Button
    variant="ghost"
    size="icon"
    className="w-8 h-8 text-muted-foreground"
    onClick={() => setShowLeaveConfirm(true)}
  >
    <Home className="w-4 h-4" />
  </Button>
  <span className="text-xs font-mono text-muted-foreground/50 tracking-wider uppercase">Cricket</span>
  <ShareButton gameId={game.id} playerCount={playerCount} isConnected={isConnected} />
</div>
```

Replace the trailing `<ShareButton ... />` line with:
```tsx
<div className="flex items-center gap-1">
  {game.status !== 'completed' && (
    <Button
      variant="ghost"
      size="icon"
      className="w-8 h-8 text-muted-foreground"
      onClick={() => setShowSettings(true)}
      data-testid="button-game-settings"
    >
      <Settings className="w-4 h-4" />
    </Button>
  )}
  <ShareButton gameId={game.id} playerCount={playerCount} isConnected={isConnected} />
</div>
```

5. Find the closing `</div>` of the outermost component return (the one that wraps all the screen content). Just before it, add:
```tsx
<GameSettingsSheet
  game={game}
  onGameUpdate={(g) => onGameUpdate(g as CricketGame)}
  open={showSettings}
  onOpenChange={setShowSettings}
/>
```

The cast is needed because `GameSettingsSheet` is generic over `Game`, but this screen's `onGameUpdate` is typed `CricketGame`. The helpers preserve `gameType`, so the cast is safe.

- [ ] **Step 2: Wire into x01-game-screen**

In `client/src/pages/x01-game-screen.tsx`:

1. Update the lucide-react import on line 4 to include `Settings`:
```tsx
import { Undo2, ChevronRight, X, AlertTriangle, Home, Settings } from "lucide-react";
```

2. Add the sheet import after the `LongPressScoreButton` import:
```tsx
import GameSettingsSheet from "@/components/game-settings-sheet";
```

3. Add a `useState` next to the others (around line 35):
```tsx
const [showSettings, setShowSettings] = useState(false);
```

4. Find the header block at line 213:
```tsx
<div className="flex items-center justify-between px-2 py-1 border-b border-border flex-shrink-0 bg-muted/10">
  <div className="w-8" />
  <span className="text-xs font-mono text-muted-foreground/50 tracking-wider uppercase">X01</span>
  <ShareButton gameId={game.id} playerCount={playerCount} isConnected={isConnected} />
</div>
```

Replace the trailing `<ShareButton ... />` line with:
```tsx
<div className="flex items-center gap-1">
  {game.status !== 'completed' && (
    <Button
      variant="ghost"
      size="icon"
      className="w-8 h-8 text-muted-foreground"
      onClick={() => setShowSettings(true)}
      data-testid="button-game-settings"
    >
      <Settings className="w-4 h-4" />
    </Button>
  )}
  <ShareButton gameId={game.id} playerCount={playerCount} isConnected={isConnected} />
</div>
```

5. Just before the outermost closing `</div>` of the component return, add:
```tsx
<GameSettingsSheet
  game={game}
  onGameUpdate={(g) => onGameUpdate(g as X01Game)}
  open={showSettings}
  onOpenChange={setShowSettings}
/>
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/cricket-game-screen.tsx client/src/pages/x01-game-screen.tsx
git commit -m "Add gear button to game screens that opens settings sheet"
```

---

## Task 8: Manual smoke test

UI behavior is verified by hand against the running dev server. No automated tests for the sheet itself — the helpers it calls are already unit-tested.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server listening on port 3000 with no errors.

- [ ] **Step 2: Smoke-test Cricket team mode**

1. Open `http://localhost:3000` and start a Cricket team game with two teams, two players each, named "Reds" with "Alice" / "Bob" and "Blues" with "Carol" / "Dave".
2. Throw a few darts so dart history exists.
3. Tap the gear icon in the top-right of the game header. The bottom sheet should appear.
4. Edit "Reds" → "Crimson", blur the field. Confirm the team scoreboard at the top of the game updates to "Crimson".
5. Edit "Alice" → "Alicia". Confirm the player queue and current-player display update.
6. In the turn-order section, use down arrow on the first upcoming player to move it. Confirm the upcoming queue at the top of the screen reorders.
7. Close the sheet. Reopen it — values should match the new state.
8. Throw another dart. Confirm scoring still works and the player named "Alicia" is correctly attributed.

- [ ] **Step 3: Smoke-test X01 team mode**

1. Start a fresh 501 team game with two teams and two players each.
2. Open settings. Toggle Double Out off, close, and verify finishing now allows non-double finishes (throw down to 0 with a single dart).
3. Re-open settings. Toggle Double Out on. Confirm the next attempt to finish on a non-double busts.
4. Edit a team name and a player name. Confirm scoreboard updates.

- [ ] **Step 4: Smoke-test X01 individual mode**

1. Start a 501 individual game with three players.
2. Open settings. There should be no team-name fields, just a flat list of player names. Double-out toggle present. Turn order section shows current player + 2 upcoming with up/down arrows.
3. Reorder the upcoming queue. Close. Confirm the next-up display matches.

- [ ] **Step 5: Smoke-test cricket solo**

1. Start a Cricket Solo game with player "Alice".
2. Open settings. Should see one player name field. No team-name field, no turn-order section, no rules section.
3. Rename Alice → Alicia. Confirm the scoreboard updates.

- [ ] **Step 6: Smoke-test multi-device sync**

1. Start a fresh game in one browser tab.
2. Open the share link in a second tab (or another device on the same network).
3. In tab 1, edit a player name through the settings sheet.
4. Confirm tab 2's display updates within ~1 second (WebSocket broadcast).

- [ ] **Step 7: Smoke-test completed game**

1. Finish a game (close all numbers in cricket, or check out in X01).
2. Confirm the post-game screen does not show the gear icon (game.status === 'completed' hides it on the in-game screen, and the post-game screen never had it).

- [ ] **Step 8: Stop the dev server. Final type-check and full test run.**

Run: `npm run check`
Expected: 0 errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 9: Commit any small fixes from smoke testing if needed**

If smoke testing turned up issues, fix them and commit. If everything worked first try, no commit needed at this step.

---

## Self-Review Notes

**Spec coverage check:**
- Editable mid-game: player names ✓ (Task 3, Task 6 sec 1), team names ✓ (Task 2, Task 6 sec 1), X01 double-out ✓ (Task 5, Task 6 sec 2), turn order ✓ (Task 4, Task 6 sec 3).
- Out-of-scope items (game type, starting score, mode, roster) — correctly absent from sheet UI.
- Entry point: gear icon in both headers, hidden on completed ✓ (Task 7).
- Helper functions match spec names exactly: `renamePlayer`, `renameTeam`, `setDoubleOut`, `reorderUpcomingTurns` ✓.
- Persistence + sync via existing `onGameUpdate` ✓ (Task 6).
- Edge cases: empty name fallback (commit-on-blur with trim guard, Task 6) ✓; turn-order reorder mid-turn allowed (current player frozen, never sent to `reorderUpcomingTurns`) ✓; multi-device race = last write wins (existing pattern) ✓.

**Type consistency:**
- `renamePlayer(game, playerId, name)` — same signature in spec, helper, and tests.
- `renameTeam(game, teamId, name)` — same.
- `reorderUpcomingTurns(game, newUpcoming)` — same. `newUpcoming` is `PlayerRef[]` of length `len - 1` in spec and implementation.
- `setDoubleOut(game, doubleOut)` — same.
- `PlayerNameInput` extension: `onChange` and `onCommit` are both optional, setup-screen (uses `onChange`) and sheet (uses `onCommit`) both type-check.

**Placeholder scan:** None found. Every step has the actual code/command.
