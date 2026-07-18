import { useEffect, useRef, useCallback, useState } from "react";
import type { Game } from "@/lib/types";

interface GameSyncState {
  isConnected: boolean;
  playerCount: number;
  sendUpdate: (game: Game) => void;
}

export function useGameSync(
  gameId: string | null,
  onRemoteUpdate: (game: Game) => void
): GameSyncState {
  const [isConnected, setIsConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;

  useEffect(() => {
    if (!gameId) {
      setIsConnected(false);
      setPlayerCount(0);
      return;
    }

    // The socket, reconnect timer, and backoff counter all live inside this
    // effect run, guarded by `disposed`. A socket closed because the gameId
    // changed must never reconnect: its onclose fires *after* cleanup, and
    // without the guard it would rejoin the previous game's room — the server
    // replays that room's state on join, yanking the app back to the old game.
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempt = 0;

    const connect = () => {
      if (disposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws = socket;
      wsRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        setIsConnected(true);
        reconnectAttempt = 0;
        // Join the game room
        socket.send(JSON.stringify({ type: "join", gameId }));
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        let msg: { type: string; game?: unknown; count?: number; message?: string };
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
          case "error":
            console.warn("[game-sync] Server error:", msg.message);
            break;
        }
      };

      socket.onclose = () => {
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (disposed) return;
        setIsConnected(false);

        // Auto-reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 10000);
        reconnectAttempt++;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        // onclose will fire after onerror, triggering reconnect
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }
      setIsConnected(false);
      setPlayerCount(0);
    };
  }, [gameId]);

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
