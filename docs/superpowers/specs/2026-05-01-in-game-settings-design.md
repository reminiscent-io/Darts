# In-Game Settings Sheet

## Purpose

Let players edit a running game's safely-mutable configuration without restarting. Common case: fix a typo in a player or team name. Adjacent cases: toggle X01 double-out, reorder who throws next.

## Scope

**Editable mid-game:**
- Player names (all modes)
- Team names (team modes only)
- X01 double-out toggle (applies to finish-checking going forward)
- Turn order of upcoming players (current player frozen)

**Out of scope (would invalidate in-flight state):**
- Game type (Cricket ↔ X01)
- X01 starting score
- Cricket solo ↔ team mode
- Adding or removing players
- Changing the current player mid-turn

A user wanting any of these should leave the game and start a new one. The existing leave-confirm flow covers that.

## Architecture

### Entry point

A gear icon (`Settings` from `lucide-react`) is added to both game-screen headers:

- `client/src/pages/cricket-game-screen.tsx` — between the "Cricket" label and `ShareButton`
- `client/src/pages/x01-game-screen.tsx` — same position relative to its header

The icon is hidden when `game.status === 'completed'` (post-game flow handles that case).

### New component

**`client/src/components/game-settings-sheet.tsx`** — single component used by both game screens.

Props:
```ts
interface GameSettingsSheetProps {
  game: Game; // CricketGame | X01Game
  onGameUpdate: (game: Game) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

Built on shadcn `Sheet` with `side="bottom"`. Sections render conditionally on `game.gameType` and `game.mode`.

### Sheet sections

**1. Names**
- Team modes (Cricket team, X01 team): show each team's name field, with each player nested below.
- Cricket solo: single player name field.
- X01 individual: flat list of player name fields.
- Reuse `PlayerNameInput` from `setup-screen.tsx` so autocomplete from `player_names` keeps working. (Extract it to a shared component file as part of this work — currently it's a local helper in `setup-screen.tsx`.)
- Edits commit on blur, not keystroke. Empty values fall back to the existing value (no empty-string commits).

**2. Rules** (X01 only)
- Single toggle: "Double Out". Same visual style as the setup screen toggle.
- Toggling commits immediately.

**3. Turn order**
- Hidden when `turnOrder.length <= 1` (cricket solo, single-player X01 individual).
- Top row: current player, immutable, with a "Now throwing" badge.
- Below: upcoming players in the order they will throw, each with up/down arrow buttons. Up disabled on the first upcoming player; down disabled on the last.
- Reorder commits immediately on each tap.

### Helper functions

Pure helpers added to keep the component thin. All return a new `Game` (immutable update).

In `client/src/lib/game-logic.ts` (works for both game types):
```ts
renamePlayer(game: Game, playerId: string, name: string): Game
renameTeam(game: Game, teamId: string, name: string): Game
reorderUpcomingTurns(game: Game, newUpcoming: PlayerRef[]): Game
```

In `client/src/lib/x01-game-logic.ts`:
```ts
setDoubleOut(game: X01Game, doubleOut: boolean): X01Game
```

`reorderUpcomingTurns` takes the desired upcoming order as an array (length `turnOrder.length - 1`) and reconstructs `turnOrder` such that index `currentTurnIndex` still points to the same current player and the rest follow in the supplied order.

### Edit semantics

**Names.**
- `teams[].name` and `teams[].players[].name` are updated in place.
- Dart history (`dartHistory`, `currentTurnDarts`, `shots` table) references by `playerId` / `teamId`, so historical rendering picks up new names automatically.
- On commit, also POST the new name to the existing `player_names` save endpoint so future setup screens autocomplete it.

**Double-out (X01).**
- Toggles `game.doubleOut`. `remainingScore` and dart history are untouched.
- Finish-checking logic in `x01-game-logic.ts` already reads `game.doubleOut` per dart, so the change applies on the next dart.

**Turn order.**
- The queue is treated as circular starting at `currentTurnIndex`. The current player (index 0 of the rotated view) is frozen. Reordering only affects who throws after the current turn ends.
- `advanceTurn` is unchanged — it already increments `currentTurnIndex` mod length.

### Persistence and sync

Every helper call returns a new `Game`. The component calls `onGameUpdate(newGame)`, which routes through the existing path:
1. `saveGame` writes to localStorage
2. REST `PUT /api/games/:id` persists to PostgreSQL
3. WebSocket broadcast notifies other connected viewers

No new sync code. Receiving devices update local state and re-render with the new names / order / rule.

### Edge cases

- **Multi-device race.** Two viewers edit at the same time → last write wins (existing pattern across all game updates). Acceptable; names and order are low-stakes.
- **Empty name commit.** If the user blurs an empty field, restore the previous value rather than persisting `""`.
- **Game completes while sheet open.** Sheet stays open; `onGameUpdate` calls still go through, but the gear icon will be hidden next time the screen renders. Not worth special handling.
- **Turn order reorder mid-turn (darts already thrown this turn).** Allowed. Current player is locked, so darts already in `currentTurnDarts` are unaffected.

## Testing

Unit tests for the new helpers — they're pure functions, so this is straightforward.

In `client/src/lib/x01-game-logic.test.ts` (extend) and a new `client/src/lib/game-logic.test.ts`:

- `renamePlayer` updates the player's name on its team and leaves dart history IDs intact.
- `renameTeam` updates the team name and leaves player references intact.
- `setDoubleOut` flips the flag and preserves `remainingScore` for every team.
- `reorderUpcomingTurns`:
  - Preserves the current player at `currentTurnIndex`.
  - Applies the new upcoming order in the correct circular position.
  - No-op when called with the existing upcoming order.

UI behavior is covered by manual smoke testing against the running dev server (mid-game name edit + verify it propagates to scoreboard, dart tray, and a second connected device).

## Risk

Low. All changes are additive: a new component, a few pure helpers, a small header insertion in two files. No schema changes, no migration, no changes to dart-recording logic. The riskiest piece is `reorderUpcomingTurns` — covered by unit tests.

## Files touched

**New:**
- `client/src/components/game-settings-sheet.tsx`
- `client/src/components/player-name-input.tsx` (extracted from setup-screen)
- `client/src/lib/game-logic.test.ts`

**Modified:**
- `client/src/lib/game-logic.ts` — add `renamePlayer`, `renameTeam`, `reorderUpcomingTurns`
- `client/src/lib/x01-game-logic.ts` — add `setDoubleOut`
- `client/src/lib/x01-game-logic.test.ts` — extend with new helper tests
- `client/src/pages/cricket-game-screen.tsx` — add gear button, render sheet
- `client/src/pages/x01-game-screen.tsx` — add gear button, render sheet
- `client/src/pages/setup-screen.tsx` — import `PlayerNameInput` from new location instead of declaring it locally
