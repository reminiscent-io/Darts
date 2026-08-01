import { useEffect, useRef, useCallback, useState } from "react";
import type { Game } from "@/lib/types";

interface GameSyncState {
  isConnected: boolean;
  playerCount: number;
  sendUpdate: (game: Game) => void;
}

export function useGameSync(
  gameId: string | null,
  onRemoteUpdate: (game: Game) => void,
  onGameEnded?: (gameId: string) => void
): GameSyncState {
  const [isConnected, setIsConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempt = useRef(0);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;
  const onGameEndedRef = useRef(onGameEnded);
  onGameEndedRef.current = onGameEnded;
  // Set once a game has been ended for everyone, so the socket stops trying to
  // rejoin a room the server has torn down.
  const endedRef = useRef(false);

  const connect = useCallback(() => {
    if (!gameId) return;
    const joinedGameId = gameId;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempt.current = 0;
      // Join the game room
      ws.send(JSON.stringify({ type: "join", gameId }));
    };

    ws.onmessage = (event) => {
      // A socket that has already been replaced or disposed must not feed
      // state back into the app — leaving a game would undo itself.
      if (wsRef.current !== ws) return;

      let msg: { type: string; game?: unknown; count?: number; message?: string; gameId?: string };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "game-state":
          if (msg.game) {
            onRemoteUpdateRef.current(msg.game as Game);
          }
          break;
        case "player-count":
          if (typeof msg.count === "number") {
            setPlayerCount(msg.count);
          }
          break;
        case "game-ended":
          // Another player ended the game. The server has already dropped it,
          // so stop reconnecting into a room that no longer exists.
          endedRef.current = true;
          clearTimeout(reconnectTimer.current);
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
          onGameEndedRef.current?.(msg.gameId ?? joinedGameId);
          break;
        case "error":
          console.warn("[game-sync] Server error:", msg.message);
          break;
      }
    };

    ws.onclose = () => {
      // Closes arrive asynchronously, so a socket we deliberately dropped
      // (leaving the game, or reconnecting) lands here after wsRef moved on.
      // Reconnecting it would rejoin the game the user just walked away from.
      if (wsRef.current !== ws) return;

      setIsConnected(false);
      wsRef.current = null;

      if (endedRef.current) return;

      // Auto-reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 10000);
      reconnectAttempt.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setIsConnected(false);
      setPlayerCount(0);
      return;
    }

    endedRef.current = false;
    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [gameId, connect]);

  const sendUpdate = useCallback(
    (game: Game) => {
      if (!gameId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      wsRef.current.send(
        JSON.stringify({ type: "game-update", gameId, game })
      );
    },
    [gameId]
  );

  return { isConnected, playerCount, sendUpdate };
}
