import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createCricketGame, saveGame, loadGame, loadGameFromDb,
  leaveGameLocally, endGameForEveryone, hasLeftGame, clearSavedGame,
} from './game-logic';
import type { Game } from './types';

// Minimal localStorage stand-in: the tests run in node, not jsdom.
function installLocalStorage() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe('leaving vs. ending a game', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installLocalStorage();
    fetchMock = vi.fn(async () => jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const newGame = () => createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']) as Game;

  it('leaveGameLocally drops the local save without deleting the game on the server', () => {
    const game = newGame();
    saveGame(game);
    fetchMock.mockClear();

    leaveGameLocally(game.id);

    expect(loadGame()).toBeNull();
    expect(hasLeftGame(game.id)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaveGameLocally with no argument releases whatever is currently saved', () => {
    const game = newGame();
    saveGame(game);

    leaveGameLocally();

    expect(loadGame()).toBeNull();
    expect(hasLeftGame(game.id)).toBe(true);
  });

  it('leaveGameLocally keeps a different game that is saved locally', () => {
    const mine = newGame();
    const theirs = newGame();
    saveGame(mine);

    leaveGameLocally(theirs.id);

    expect(loadGame()?.id).toBe(mine.id);
    expect(hasLeftGame(theirs.id)).toBe(true);
  });

  it('endGameForEveryone deletes the game on the server and clears it locally', async () => {
    const game = newGame();
    saveGame(game);
    fetchMock.mockClear();

    await endGameForEveryone(game.id);

    expect(loadGame()).toBeNull();
    expect(hasLeftGame(game.id)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`/api/games/${game.id}`, { method: 'DELETE' });
  });

  it('endGameForEveryone still clears locally when the server call fails', async () => {
    const game = newGame();
    saveGame(game);
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(endGameForEveryone(game.id)).resolves.toBeUndefined();
    expect(loadGame()).toBeNull();
  });

  it('clearSavedGame releases the game so it cannot be reloaded from the server', () => {
    const game = newGame();
    saveGame(game);

    clearSavedGame();

    expect(loadGame()).toBeNull();
    expect(hasLeftGame(game.id)).toBe(true);
  });
});

describe('loadGameFromDb', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installLocalStorage();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const newGame = () => createCricketGame('Reds', ['Alice'], 'Blues', ['Bob']) as Game;

  it('caches the active game locally when there is nothing saved', async () => {
    const remote = newGame();
    fetchMock.mockResolvedValue(jsonResponse(remote));

    const loaded = await loadGameFromDb();

    expect(loaded?.id).toBe(remote.id);
    expect(loadGame()?.id).toBe(remote.id);
  });

  it('ignores a game this device has left', async () => {
    const remote = newGame();
    fetchMock.mockResolvedValue(jsonResponse(remote));
    leaveGameLocally(remote.id);

    expect(await loadGameFromDb()).toBeNull();
    expect(loadGame()).toBeNull();
  });

  it('does not let another device\'s game clobber a game in progress here', async () => {
    const mine = newGame();
    // saveGame posts to the server; swallow it with a generic response.
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    saveGame(mine);

    const theirs = newGame();
    fetchMock.mockResolvedValue(jsonResponse(theirs));

    expect(await loadGameFromDb()).toBeNull();
    expect(loadGame()?.id).toBe(mine.id);
  });

  it('accepts fresher server state for the game saved here', async () => {
    const mine = newGame();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    saveGame(mine);

    const advanced = { ...mine, currentTurnIndex: 1 };
    fetchMock.mockResolvedValue(jsonResponse(advanced));

    const loaded = await loadGameFromDb();

    expect(loaded?.id).toBe(mine.id);
    expect(loadGame()?.currentTurnIndex).toBe(1);
  });

  it('replaces a completed local game with the active one from the server', async () => {
    const finished = { ...newGame(), status: 'completed' as const };
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    saveGame(finished);

    const active = newGame();
    fetchMock.mockResolvedValue(jsonResponse(active));

    expect((await loadGameFromDb())?.id).toBe(active.id);
    expect(loadGame()?.id).toBe(active.id);
  });
});
