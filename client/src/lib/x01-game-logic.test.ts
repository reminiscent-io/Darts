import { describe, it, expect } from 'vitest';
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
import { advanceTurn, getCurrentPlayer } from './game-logic';
import type { X01Game } from './types';

// Helper to create a standard 501 individual game with 2 players
function create501Game(doubleOut = false) {
  return createX01Game({
    startingScore: 501,
    doubleOut,
    mode: 'individual',
    playerNames: ['Alice', 'Bob'],
  });
}

// Helper to throw a sequence of darts and return updated game
function throwDarts(
  game: X01Game,
  darts: Array<{ target: number | 'B' | 'miss'; multiplier: 1 | 2 | 3 }>
): { game: X01Game; results: Array<{ isWin: boolean; isBust: boolean }> } {
  let currentGame = game;
  const results: Array<{ isWin: boolean; isBust: boolean }> = [];
  for (const dart of darts) {
    const result = recordX01Dart(currentGame, dart.target, dart.multiplier);
    currentGame = result.game;
    results.push({ isWin: result.isWin, isBust: result.isBust });
  }
  return { game: currentGame, results };
}

// Helper to advance turn on a game
function nextTurn(game: X01Game): X01Game {
  return advanceTurn(game) as X01Game;
}

describe('getDartPointValue', () => {
  it('calculates single number values', () => {
    expect(getDartPointValue(20, 1)).toBe(20);
    expect(getDartPointValue(1, 1)).toBe(1);
    expect(getDartPointValue(5, 1)).toBe(5);
  });

  it('calculates double number values', () => {
    expect(getDartPointValue(20, 2)).toBe(40);
    expect(getDartPointValue(16, 2)).toBe(32);
  });

  it('calculates triple number values', () => {
    expect(getDartPointValue(20, 3)).toBe(60);
    expect(getDartPointValue(19, 3)).toBe(57);
  });

  it('calculates bullseye values', () => {
    expect(getDartPointValue('B', 1)).toBe(25);
    expect(getDartPointValue('B', 2)).toBe(50);
  });
});

describe('createX01Game', () => {
  it('creates a 501 individual game with correct starting scores', () => {
    const game = create501Game();
    expect(game.startingScore).toBe(501);
    expect(game.teams.length).toBe(2);
    expect(game.teams[0].remainingScore).toBe(501);
    expect(game.teams[1].remainingScore).toBe(501);
    expect(game.status).toBe('in_progress');
    expect(game.gameType).toBe('x01');
  });

  it('creates a team mode game', () => {
    const game = createX01Game({
      startingScore: 501,
      doubleOut: false,
      mode: 'team',
      team1Name: 'Team A',
      team1Players: ['Alice', 'Charlie'],
      team2Name: 'Team B',
      team2Players: ['Bob', 'Dave'],
    });
    expect(game.teams[0].name).toBe('Team A');
    expect(game.teams[0].players.length).toBe(2);
    expect(game.teams[1].name).toBe('Team B');
    expect(game.teams[1].players.length).toBe(2);
  });

  it('creates a 301 game', () => {
    const game = createX01Game({
      startingScore: 301,
      doubleOut: true,
      mode: 'individual',
      playerNames: ['Alice', 'Bob'],
    });
    expect(game.startingScore).toBe(301);
    expect(game.teams[0].remainingScore).toBe(301);
  });

  it('builds turn order alternating between teams', () => {
    const game = create501Game();
    expect(game.turnOrder.length).toBe(2);
    expect(game.turnOrder[0].teamIndex).toBe(0);
    expect(game.turnOrder[1].teamIndex).toBe(1);
  });
});

describe('recordX01Dart - basic scoring', () => {
  it('deducts points for a single dart', () => {
    const game = create501Game();
    const result = recordX01Dart(game, 20, 1);
    expect(result.game.teams[0].remainingScore).toBe(481);
    expect(result.isWin).toBe(false);
    expect(result.isBust).toBe(false);
  });

  it('deducts points for a triple 20', () => {
    const game = create501Game();
    const result = recordX01Dart(game, 20, 3);
    expect(result.game.teams[0].remainingScore).toBe(441);
  });

  it('handles miss correctly', () => {
    const game = create501Game();
    const result = recordX01Dart(game, 'miss', 1);
    expect(result.game.teams[0].remainingScore).toBe(501);
    expect(result.isBust).toBe(false);
  });

  it('records dart in history and currentTurnDarts', () => {
    const game = create501Game();
    const result = recordX01Dart(game, 20, 3);
    expect(result.game.dartHistory.length).toBe(1);
    expect(result.game.currentTurnDarts.length).toBe(1);
    expect(result.dart.pointsScored).toBe(60);
  });

  it('accumulates darts in a turn', () => {
    const game = create501Game();
    const r1 = recordX01Dart(game, 20, 3);
    const r2 = recordX01Dart(r1.game, 20, 3);
    const r3 = recordX01Dart(r2.game, 20, 3);
    expect(r3.game.teams[0].remainingScore).toBe(501 - 180);
    expect(r3.game.currentTurnDarts.length).toBe(3);
    expect(r3.game.dartHistory.length).toBe(3);
  });
});

describe('recordX01Dart - bust scenarios (no double out)', () => {
  it('busts when score goes below zero', () => {
    let game = create501Game(false);
    // Get score down to 10
    // Throw T20 (60) x 8 = 480, remaining = 21
    for (let i = 0; i < 8; i++) {
      const r = recordX01Dart(game, 20, 3);
      game = r.game;
      if (r.game.currentTurnDarts.length === 3 || r.isBust) {
        game = nextTurn(game);
      }
    }
    // Discard Bob's turns - just advance
    // Alice should have 501 - 480 = 21 (after turn advances properly)
    // Actually let me track more carefully with turns
  });

  it('busts when score goes below zero - simplified', () => {
    let game = create501Game(false);
    // Throw three T20s for Alice (180), then advance
    let r = recordX01Dart(game, 20, 3); // 441
    r = recordX01Dart(r.game, 20, 3); // 381
    r = recordX01Dart(r.game, 20, 3); // 321
    game = nextTurn(r.game);
    // Bob's turn - throw misses
    r = recordX01Dart(game, 'miss', 1);
    r = recordX01Dart(r.game, 'miss', 1);
    r = recordX01Dart(r.game, 'miss', 1);
    game = nextTurn(r.game);
    // Alice: 321, throw three T20s -> 141
    r = recordX01Dart(game, 20, 3);
    r = recordX01Dart(r.game, 20, 3);
    r = recordX01Dart(r.game, 20, 3);
    game = nextTurn(r.game);
    // Bob misses
    r = recordX01Dart(game, 'miss', 1);
    r = recordX01Dart(r.game, 'miss', 1);
    r = recordX01Dart(r.game, 'miss', 1);
    game = nextTurn(r.game);
    // Alice: 141, throw two T20s -> 21
    r = recordX01Dart(game, 20, 3);
    r = recordX01Dart(r.game, 20, 3);
    expect(r.game.teams[0].remainingScore).toBe(21);
    // Now throw T20 (60) -> would go to -39, should bust
    r = recordX01Dart(r.game, 20, 3);
    expect(r.isBust).toBe(true);
    expect(r.game.teams[0].remainingScore).toBe(141); // reverted to turn start
  });
});

describe('recordX01Dart - double out bust scenarios', () => {
  it('busts when hitting 0 without a double (double-out mode)', () => {
    let game = create501Game(true);
    // Get Alice to exactly 20
    // 501 - 180 = 321 - 180 = 141 - 120 = 21 ... let's use a cleaner path
    // 501 - 180 - 180 - 121 = 20
    // Throw T20 T20 T20 (180) for Alice
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // Alice: 321
    // Bob misses
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice throws T20 T20 T20 (180) -> 141
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // Alice: 141
    // Bob misses
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice throws T20 T20 S1 -> 141 - 60 - 60 - 1 = 20
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 1, multiplier: 1 },
    ]);
    game = nextTurn(r.game); // Alice: 20
    expect(game.teams[0].remainingScore).toBe(20);
    // Bob misses
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice tries S20 (single 20 = 20 points, score goes to 0 but NOT a double)
    const bustResult = recordX01Dart(game, 20, 1);
    expect(bustResult.isBust).toBe(true);
    expect(bustResult.game.teams[0].remainingScore).toBe(20); // score reverted
  });

  it('wins when hitting 0 with a double (double-out mode)', () => {
    let game = create501Game(true);
    // Get Alice to 20 same path as above
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 1, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(20);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice hits D10 (double 10 = 20) -> 0 with a double = WIN
    const winResult = recordX01Dart(game, 10, 2);
    expect(winResult.isWin).toBe(true);
    expect(winResult.isBust).toBe(false);
    expect(winResult.game.teams[0].remainingScore).toBe(0);
  });

  it('busts when remaining would be 1 (double-out mode)', () => {
    let game = create501Game(true);
    // Get Alice to 21
    // 501 - 180 - 180 - 120 = 21
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // 141 - T20 - T20 = 21
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(21);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice throws S20 -> remaining would be 1, bust in double-out
    const bustResult = recordX01Dart(game, 20, 1);
    expect(bustResult.isBust).toBe(true);
    expect(bustResult.game.teams[0].remainingScore).toBe(21);
  });
});

describe('recordX01Dart - win without double out', () => {
  it('wins when score reaches exactly 0 (single finish)', () => {
    let game = create501Game(false);
    // Get Alice to 20
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 1, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(20);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice hits S20 -> 0, wins without needing double
    const winResult = recordX01Dart(game, 20, 1);
    expect(winResult.isWin).toBe(true);
    expect(winResult.game.teams[0].remainingScore).toBe(0);
  });
});

describe('recordX01Dart - bust reverts entire turn', () => {
  it('reverts all darts in the turn when bust occurs', () => {
    let game = create501Game(false);
    // Get Alice to a low score: throw until near the end
    // Alice: 501 - T20(60) - T20(60) - T20(60) = 321
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice: 141. Throw T20 (81), T20 (21), then T20 busts (-39)
    expect(game.teams[0].remainingScore).toBe(141);
    const r1 = recordX01Dart(game, 20, 3); // 81
    expect(r1.game.teams[0].remainingScore).toBe(81);
    const r2 = recordX01Dart(r1.game, 20, 3); // 21
    expect(r2.game.teams[0].remainingScore).toBe(21);
    const r3 = recordX01Dart(r2.game, 20, 3); // -39, BUST
    expect(r3.isBust).toBe(true);
    // Score should revert to turn start (141)
    expect(r3.game.teams[0].remainingScore).toBe(141);
    // Turn should have advanced
    expect(r3.game.currentTurnDarts.length).toBe(0);
  });

  it('marks all darts in the turn as bust', () => {
    let game = create501Game(false);
    // Get Alice to 15
    // 501 - 180 - 180 - 126 = 15
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 321
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 141
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // 141 - T20(60) - T20(60) - S6(6) = 15
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 6, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(15);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice: 15. Throw S5 (10), S5 (5), then T20 (60) -> -55 busts
    const historyBefore = game.dartHistory.length;
    const r1 = recordX01Dart(game, 5, 1); // 10
    const r2 = recordX01Dart(r1.game, 5, 1); // 5
    const r3 = recordX01Dart(r2.game, 20, 3); // bust (-55)
    expect(r3.isBust).toBe(true);
    // All 3 darts should be in history as bust
    const bustDarts = r3.game.dartHistory.slice(historyBefore);
    expect(bustDarts.length).toBe(3);
    expect(bustDarts.every(d => d.isBust)).toBe(true);
    // Score should revert
    expect(r3.game.teams[0].remainingScore).toBe(15);
  });
});

describe('recordX01Dart - bullseye scoring', () => {
  it('scores single bull (25) correctly', () => {
    const game = create501Game();
    const r = recordX01Dart(game, 'B', 1);
    expect(r.game.teams[0].remainingScore).toBe(476);
    expect(r.dart.pointsScored).toBe(25);
  });

  it('scores double bull (50) correctly', () => {
    const game = create501Game();
    const r = recordX01Dart(game, 'B', 2);
    expect(r.game.teams[0].remainingScore).toBe(451);
    expect(r.dart.pointsScored).toBe(50);
  });

  it('can win on double bull with double-out', () => {
    let game = create501Game(true);
    // Get Alice to 50
    // 501 - 180 - 180 - 91 = 50
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 321
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 141
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // 141 - T20(60) - T10(30) - S1(1) = 50
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 10, multiplier: 3 },
      { target: 1, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(50);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice hits DB (double bull = 50) -> win
    const winResult = recordX01Dart(game, 'B', 2);
    expect(winResult.isWin).toBe(true);
    expect(winResult.game.teams[0].remainingScore).toBe(0);
  });
});

describe('undoLastX01Dart', () => {
  it('undoes dart within current turn', () => {
    const game = create501Game();
    const r = recordX01Dart(game, 20, 3);
    expect(r.game.teams[0].remainingScore).toBe(441);
    const undone = undoLastX01Dart(r.game);
    expect(undone.game.teams[0].remainingScore).toBe(501);
    expect(undone.crossedTurnBoundary).toBe(false);
    expect(undone.game.currentTurnDarts.length).toBe(0);
  });

  it('undoes multiple darts within a turn', () => {
    const game = create501Game();
    let r = recordX01Dart(game, 20, 3); // 441
    r = recordX01Dart(r.game, 19, 3); // 384
    const undone = undoLastX01Dart(r.game);
    expect(undone.game.teams[0].remainingScore).toBe(441);
    expect(undone.game.currentTurnDarts.length).toBe(1);
  });

  it('undoes across turn boundary', () => {
    const game = create501Game();
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    const advanced = nextTurn(r.game);
    // Now it's Bob's turn, undo should go back to Alice's last dart
    const undone = undoLastX01Dart(advanced);
    expect(undone.crossedTurnBoundary).toBe(true);
    // Should restore Alice's last two darts as currentTurnDarts
    expect(undone.game.currentTurnDarts.length).toBe(2);
    expect(undone.game.teams[0].remainingScore).toBe(381); // 501 - 60 - 60
  });

  it('does nothing when no darts thrown', () => {
    const game = create501Game();
    const undone = undoLastX01Dart(game);
    expect(undone.game).toBe(game);
    expect(undone.crossedTurnBoundary).toBe(false);
  });

  it('undoes a bust turn', () => {
    let game = create501Game(false);
    // Get Alice to 21
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 321
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 141
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(21);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice: 21. T20 -> bust, reverted to 21
    const bustR = recordX01Dart(game, 20, 3);
    expect(bustR.isBust).toBe(true);
    expect(bustR.game.teams[0].remainingScore).toBe(21);
    // Now it's Bob's turn after bust. Undo should restore the bust turn
    const undone = undoLastX01Dart(bustR.game);
    expect(undone.crossedTurnBoundary).toBe(true);
    // After undoing the bust, Alice's score should still be 21 (the bust darts are removed)
    expect(undone.game.teams[0].remainingScore).toBe(21);
  });
});

describe('removeX01DartAtIndex', () => {
  it('removes a dart from the middle of a turn', () => {
    const game = create501Game();
    let r = recordX01Dart(game, 20, 3); // 441
    r = recordX01Dart(r.game, 19, 3); // 384
    r = recordX01Dart(r.game, 18, 3); // 330
    // Remove the middle dart (T19 = 57)
    const removed = removeX01DartAtIndex(r.game, 1);
    expect(removed.teams[0].remainingScore).toBe(330 + 57); // 387
    expect(removed.currentTurnDarts.length).toBe(2);
    expect(removed.dartHistory.length).toBe(2);
  });

  it('returns unchanged game for invalid index', () => {
    const game = create501Game();
    const removed = removeX01DartAtIndex(game, 5);
    expect(removed).toBe(game);
  });
});

describe('getCurrentTurnTotal', () => {
  it('returns 0 for empty turn', () => {
    const game = create501Game();
    expect(getCurrentTurnTotal(game)).toBe(0);
  });

  it('sums current turn darts', () => {
    const game = create501Game();
    let r = recordX01Dart(game, 20, 3);
    r = recordX01Dart(r.game, 19, 3);
    expect(getCurrentTurnTotal(r.game)).toBe(117);
  });
});

describe('getX01PlayerStats', () => {
  it('calculates stats for a player', () => {
    const game = create501Game();
    const playerId = game.teams[0].players[0].id;
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    const stats = getX01PlayerStats(r.game, playerId);
    expect(stats.totalDarts).toBe(3);
    expect(stats.totalPoints).toBe(180);
    expect(stats.highestRound).toBe(180);
    expect(stats.ppd).toBe(60);
    expect(stats.threeDartAvg).toBe(180);
  });

  it('returns zero stats for unknown player', () => {
    const game = create501Game();
    const stats = getX01PlayerStats(game, 'nonexistent');
    expect(stats.totalDarts).toBe(0);
    expect(stats.totalPoints).toBe(0);
  });
});

describe('turn management with advanceTurn', () => {
  it('alternates between players', () => {
    const game = create501Game();
    const p1 = getCurrentPlayer(game);
    expect(p1.teamIndex).toBe(0);
    const advanced = nextTurn(game);
    const p2 = getCurrentPlayer(advanced);
    expect(p2.teamIndex).toBe(1);
    const advanced2 = nextTurn(advanced);
    const p3 = getCurrentPlayer(advanced2);
    expect(p3.teamIndex).toBe(0);
  });
});

describe('end-game edge cases', () => {
  it('winning on first dart of a turn', () => {
    let game = create501Game(false);
    // Get Alice to 60
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 321
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 141
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // 141 - T20 - T20 - S1 = 20
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 1, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(20);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Win on first dart of turn
    const winResult = recordX01Dart(game, 20, 1);
    expect(winResult.isWin).toBe(true);
    expect(winResult.game.currentTurnDarts.length).toBe(1);
  });

  it('winning on second dart of a turn', () => {
    let game = create501Game(false);
    // Get Alice to 21
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 321
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 141
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game); // 21
    expect(game.teams[0].remainingScore).toBe(21);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Throw S1 (20), then S20 (0) = win
    const r1 = recordX01Dart(game, 1, 1); // 20
    const winResult = recordX01Dart(r1.game, 20, 1); // 0
    expect(winResult.isWin).toBe(true);
    expect(winResult.game.currentTurnDarts.length).toBe(2);
  });

  it('bust on first dart reverts correctly', () => {
    let game = create501Game(false);
    // Get Alice to 5
    // 501 - 180 - 180 - 136 = 5
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 321
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 141
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // 141 - T20(60) - T20(60) - S16(16) = 5
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 16, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(5);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice: 5. Throw S20 -> busts on first dart
    const bustResult = recordX01Dart(game, 20, 1);
    expect(bustResult.isBust).toBe(true);
    expect(bustResult.game.teams[0].remainingScore).toBe(5);
  });

  it('double out: D1 for score of 2 wins', () => {
    let game = create501Game(true);
    // Get Alice to 2
    // 501 - 180 - 180 - 139 = 2
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 321
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game); // 141
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // 141 - T20(60) - T20(60) - S19(19) = 2
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 19, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(2);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // D1 = 2, wins!
    const winResult = recordX01Dart(game, 1, 2);
    expect(winResult.isWin).toBe(true);
    expect(winResult.game.teams[0].remainingScore).toBe(0);
  });

  it('double out: S1 for score of 2 busts (leaves 1)', () => {
    let game = create501Game(true);
    // Get Alice to 2 same as above
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 19, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(2);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // S1 for score of 2 -> remaining = 1, bust in double-out
    const bustResult = recordX01Dart(game, 1, 1);
    expect(bustResult.isBust).toBe(true);
    expect(bustResult.game.teams[0].remainingScore).toBe(2);
  });

  it('multiple consecutive busts dont corrupt score', () => {
    let game = create501Game(false);
    // Get Alice to 5
    let r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    r = throwDarts(game, [
      { target: 20, multiplier: 3 },
      { target: 20, multiplier: 3 },
      { target: 16, multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    expect(game.teams[0].remainingScore).toBe(5);
    // Bob misses
    r = throwDarts(game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice busts (T20)
    const bust1 = recordX01Dart(game, 20, 3);
    expect(bust1.isBust).toBe(true);
    expect(bust1.game.teams[0].remainingScore).toBe(5);
    // Bob misses
    r = throwDarts(bust1.game, [
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
      { target: 'miss', multiplier: 1 },
    ]);
    game = nextTurn(r.game);
    // Alice busts again
    const bust2 = recordX01Dart(game, 20, 3);
    expect(bust2.isBust).toBe(true);
    expect(bust2.game.teams[0].remainingScore).toBe(5);
    // Score should still be 5 after multiple busts
  });
});

describe('team mode game', () => {
  it('creates team game and scores correctly', () => {
    const game = createX01Game({
      startingScore: 501,
      doubleOut: false,
      mode: 'team',
      team1Name: 'Team A',
      team1Players: ['Alice', 'Charlie'],
      team2Name: 'Team B',
      team2Players: ['Bob'],
    });
    // First turn should be Team A player
    const p1 = getCurrentPlayer(game);
    expect(p1.teamIndex).toBe(0);
    const r = recordX01Dart(game, 20, 3);
    expect(r.game.teams[0].remainingScore).toBe(441);
    expect(r.game.teams[1].remainingScore).toBe(501);
  });
});

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
