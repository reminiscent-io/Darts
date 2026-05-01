import { describe, it, expect } from 'vitest';
import { createCricketGame, createSoloCricketGame, renameTeam, renamePlayer } from './game-logic';

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
