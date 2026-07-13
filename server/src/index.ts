import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "shared";

import { createGameManager } from "./gridManager.js";
import { registerSocketHandlers } from "./socketHandlers.js";

const PORT = process.env.PORT || 3001;

// Harden CORS: Sanitize CLIENT_ORIGIN to prevent server crashes from invalid header characters
function getSanitizedOrigin(rawOrigin: string | undefined): string {
  if (!rawOrigin) return "*";
  
  const trimmed = rawOrigin.trim();
  if (!trimmed || trimmed === "*") return "*";

  // Strip trailing slash
  const sanitized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;

  // Validate protocol
  if (!sanitized.startsWith("http://") && !sanitized.startsWith("https://")) {
    console.warn(`[server] Invalid CLIENT_ORIGIN "${rawOrigin}" provided. Falling back to "*". Origins must start with http:// or https://`);
    return "*";
  }

  return sanitized;
}

const CLIENT_ORIGIN = getSanitizedOrigin(process.env.CLIENT_ORIGIN);

const app = express();

app.use(cors({
  origin: CLIENT_ORIGIN
}));

app.get("/", (_request, response) => {
  response.json({ name: "blockwars-server", status: "ok" });
});

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN
  }
});

const gameManager = createGameManager();

registerSocketHandlers(io, gameManager);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(
    `[server] initialized ${gameManager.getGridState().blocks.length} blocks`
  );
});
