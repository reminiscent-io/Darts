import { describe, it, expect } from 'vitest';
import { createCricketGame, renameTeam } from './game-logic';

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
