import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "shared";

import { createInitialGrid } from "./gridManager.js";
import { registerSocketHandlers } from "./socketHandlers.js";

const PORT = 3001;

const app = express();

app.use(cors());

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*"
  }
});

const grid = createInitialGrid();

registerSocketHandlers(io, grid);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] initialized ${grid.blocks.length} blocks`);
});
