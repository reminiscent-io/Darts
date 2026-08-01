import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { broadcastGameEnded } from "./ws";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/games/active", async (_req, res) => {
    const game = await storage.getActiveGame();
    if (!game) return res.json(null);
    res.json(game.gameState);
  });

  app.post("/api/games", async (req, res) => {
    const { id, status, gameState } = req.body;
    if (!id || !gameState) {
      return res.status(400).json({ message: "Missing id or gameState" });
    }
    await storage.upsertGame({ id, status: status || "in_progress", gameState });
    try {
      await storage.persistShotsFromGameState(gameState);
    } catch (err) {
      console.error("persistShotsFromGameState failed", err);
    }
    res.json({ ok: true });
  });

  app.get("/api/games/:id", async (req, res) => {
    const game = await storage.getGame(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    res.json(game.gameState);
  });

  // Ends the game for everyone: the row goes away and every device still in
  // the game's room is told to drop it.
  app.delete("/api/games/:id", async (req, res) => {
    const existing = await storage.getGame(req.params.id);
    await storage.deleteGame(req.params.id);
    // Clearing a finished game leaves anyone still on its post-game screen
    // alone; only killing a live game boots the other devices out.
    if (existing?.status !== "completed") {
      broadcastGameEnded(req.params.id);
    }
    res.json({ ok: true });
  });

  app.get("/api/history", async (_req, res) => {
    const summaries = await storage.getGameSummaries();
    res.json(summaries);
  });

  app.post("/api/history", async (req, res) => {
    const summary = req.body;
    if (!summary.id) {
      return res.status(400).json({ message: "Missing id" });
    }
    await storage.createGameSummary(summary);
    res.json({ ok: true });
  });

  app.delete("/api/history", async (_req, res) => {
    await storage.clearGameSummaries();
    res.json({ ok: true });
  });

  app.get("/api/players", async (_req, res) => {
    const names = await storage.getPlayerNames();
    res.json(names);
  });

  app.post("/api/players", async (req, res) => {
    const { names } = req.body;
    if (!Array.isArray(names)) {
      return res.status(400).json({ message: "names must be an array" });
    }
    await storage.addPlayerNames(names);
    const updated = await storage.getPlayerNames();
    res.json(updated);
  });

  app.get("/api/players/:name/shots", async (req, res) => {
    const limit = req.query.limit ? Math.min(Number(req.query.limit) || 500, 5000) : 500;
    const rows = await storage.getShotsForPlayer(req.params.name, limit);
    res.json(rows);
  });

  return httpServer;
}
