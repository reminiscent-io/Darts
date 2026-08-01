import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { ClientMessage, ServerMessage } from "@shared/ws-types";
import { storage } from "./storage";
import { log } from "./index";

// Room management: gameId -> set of connected sockets
const rooms = new Map<string, Set<WebSocket>>();

// Track which game each socket belongs to
const socketGameMap = new WeakMap<WebSocket, string>();

function broadcast(gameId: string, message: ServerMessage, exclude?: WebSocket) {
  const room = rooms.get(gameId);
  if (!room) return;

  const payload = JSON.stringify(message);
  for (const client of room) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastPlayerCount(gameId: string) {
  const room = rooms.get(gameId);
  const count = room ? room.size : 0;
  broadcast(gameId, { type: "player-count", count });
}

function removeFromRoom(ws: WebSocket) {
  const gameId = socketGameMap.get(ws);
  if (!gameId) return;

  const room = rooms.get(gameId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(gameId);
    } else {
      broadcastPlayerCount(gameId);
    }
  }
  socketGameMap.delete(ws);
}

async function handleJoin(ws: WebSocket, gameId: string) {
  // Remove from any previous room
  removeFromRoom(ws);

  // Add to new room
  if (!rooms.has(gameId)) {
    rooms.set(gameId, new Set());
  }
  rooms.get(gameId)!.add(ws);
  socketGameMap.set(ws, gameId);

  // Send current game state from DB
  try {
    const gameRow = await storage.getGame(gameId);
    if (gameRow) {
      const msg: ServerMessage = {
        type: "game-state",
        game: gameRow.gameState as Record<string, unknown>,
      };
      ws.send(JSON.stringify(msg));
    } else {
      const msg: ServerMessage = { type: "error", message: "Game not found" };
      ws.send(JSON.stringify(msg));
    }
  } catch (err) {
    const msg: ServerMessage = { type: "error", message: "Failed to load game" };
    ws.send(JSON.stringify(msg));
  }

  // Broadcast updated player count to everyone in the room
  broadcastPlayerCount(gameId);
}

// A player ended the game for everyone (DELETE /api/games/:id). Tell every
// device in the room to drop it, then tear the room down.
export function broadcastGameEnded(gameId: string) {
  const room = rooms.get(gameId);
  if (!room) return;

  broadcast(gameId, { type: "game-ended", gameId });
  // Drop the room itself; clients are navigating away and removeFromRoom
  // tolerates a socket whose room is already gone.
  rooms.delete(gameId);
}

async function handleGameUpdate(ws: WebSocket, gameId: string, game: Record<string, unknown>) {
  // Persist to database
  try {
    await storage.upsertGame({
      id: gameId,
      status: (game.status as string) || "in_progress",
      gameState: game,
    });
  } catch (err) {
    log(`Failed to persist game ${gameId}: ${err}`, "ws");
  }

  // Broadcast to all other clients in the room
  broadcast(gameId, { type: "game-state", game }, ws);
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Heartbeat: detect stale connections
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      const socket = ws as WebSocket & { isAlive?: boolean };
      if (socket.isAlive === false) {
        removeFromRoom(ws);
        ws.terminate();
        continue;
      }
      socket.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  wss.on("connection", (ws) => {
    const socket = ws as WebSocket & { isAlive?: boolean };
    socket.isAlive = true;

    ws.on("pong", () => {
      socket.isAlive = true;
    });

    ws.on("message", async (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "join":
          await handleJoin(ws, msg.gameId);
          break;
        case "game-update":
          await handleGameUpdate(ws, msg.gameId, msg.game);
          break;
      }
    });

    ws.on("close", () => {
      removeFromRoom(ws);
    });

    ws.on("error", () => {
      removeFromRoom(ws);
    });
  });

  log("WebSocket server ready on /ws", "ws");
}
