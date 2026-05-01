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
