import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "shared";

import { createGameManager } from "./gridManager.js";
import { registerSocketHandlers } from "./socketHandlers.js";

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

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
