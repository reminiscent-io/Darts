// WebSocket message protocol for game sharing
// Game state is passed as a generic JSON object to avoid cross-boundary type imports.
// The client-side hook casts it to the proper Game type.

// Messages from client to server
export type ClientMessage =
  | { type: 'join'; gameId: string }
  | { type: 'game-update'; gameId: string; game: Record<string, unknown> };

// Messages from server to client
export type ServerMessage =
  | { type: 'game-state'; game: Record<string, unknown> }
  | { type: 'player-count'; count: number }
  | { type: 'error'; message: string };
