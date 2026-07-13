import { randomUUID } from "node:crypto";
import type {
  ClientToServerEvents,
  ClaimBlockPayload,
  Player,
  ServerToClientEvents
} from "shared";
import { SOCKET_EVENTS } from "shared";
import type { Server, Socket } from "socket.io";

import type { GameManager } from "./gridManager.js";

const NEON_COLORS = [
  "#FF2D55",
  "#FF6B00",
  "#FFD60A",
  "#A8FF04",
  "#32FF7E",
  "#00F5D4",
  "#00BBF9",
  "#3A86FF",
  "#8338EC",
  "#FF00C8",
  "#FB5607",
  "#F15BB5"
] as const;

const ADJECTIVES = [
  "Swift",
  "Neon",
  "Turbo",
  "Shadow",
  "Nova",
  "Blaze",
  "Pixel",
  "Rocket",
  "Cosmic",
  "Hyper",
  "Electric",
  "Solar"
] as const;

const ANIMALS = [
  "Falcon",
  "Tiger",
  "Otter",
  "Panther",
  "Raven",
  "Wolf",
  "Cobra",
  "Fox",
  "Lynx",
  "Viper",
  "Shark",
  "Puma"
] as const;

type NeonColor = (typeof NEON_COLORS)[number];

type BlockWarsServer = Server<
  ClientToServerEvents,
  ServerToClientEvents
>;

type BlockWarsSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents
>;

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createInitialColorCounts(): Map<NeonColor, number> {
  return new Map(NEON_COLORS.map((color) => [color, 0]));
}

function pickLeastUsedColor(colorCounts: Map<NeonColor, number>): NeonColor {
  let minimumUsage = Number.POSITIVE_INFINITY;

  for (const color of NEON_COLORS) {
    const usageCount = colorCounts.get(color) ?? 0;
    minimumUsage = Math.min(minimumUsage, usageCount);
  }

  const candidateColors = NEON_COLORS.filter(
    (color) => (colorCounts.get(color) ?? 0) === minimumUsage
  );

  return pickRandomItem(candidateColors);
}

function updateColorUsage(
  colorCounts: Map<NeonColor, number>,
  color: NeonColor,
  delta: number
): void {
  const nextCount = Math.max((colorCounts.get(color) ?? 0) + delta, 0);
  colorCounts.set(color, nextCount);
}

function createPlayer(color: NeonColor): Player {
  const suffix = Math.floor(10 + Math.random() * 90);

  return {
    id: randomUUID(),
    color,
    name: `${pickRandomItem(ADJECTIVES)}${pickRandomItem(ANIMALS)}${suffix}`
  };
}

export function registerSocketHandlers(
  io: BlockWarsServer,
  gameManager: GameManager
): void {
  const activeColorCounts = createInitialColorCounts();
  const playerLastCursorUpdate = new Map<string, number>();

  io.on(SOCKET_EVENTS.connect, (socket: BlockWarsSocket) => {
    const color = pickLeastUsedColor(activeColorCounts);
    const player = createPlayer(color);
    const { playerCount } = gameManager.registerPlayer(player);
    updateColorUsage(activeColorCounts, color, 1);

    console.log(
      `[socket] connected id=${socket.id} player=${player.name} color=${player.color}`
    );

    socket.emit(SOCKET_EVENTS.init, {
      player,
      grid: gameManager.getGridState()
    });
    socket.emit(SOCKET_EVENTS.leaderboardUpdated, gameManager.getLeaderboard());

    // Broadcast join event with metadata for toasts
    io.emit(SOCKET_EVENTS.playerCount, {
      count: playerCount,
      event: "join",
      playerName: player.name
    });

    socket.on(
      SOCKET_EVENTS.cursorMove,
      ({ x, y }) => {
        const now = Date.now();
        const lastUpdate = playerLastCursorUpdate.get(player.id) ?? 0;

        // Rate-limit inbound cursor events to 30ms to cap broadcast load.
        // We use world coordinates (grid space) so every client sees cursors
        // at the same logical position regardless of their local camera.
        if (now - lastUpdate < 30) {
          return;
        }

        playerLastCursorUpdate.set(player.id, now);

        socket.broadcast.emit(SOCKET_EVENTS.cursorUpdate, {
          playerId: player.id,
          name: player.name,
          color: player.color,
          x,
          y
        });
      }
    );

    socket.on(
      SOCKET_EVENTS.claimBlock,
      ({ blockId }: ClaimBlockPayload) => {
        const claimResult = gameManager.claimBlock(player.id, blockId);

        socket.emit(SOCKET_EVENTS.claimResult, claimResult);

        if (!claimResult.success) {
          return;
        }

        io.emit(SOCKET_EVENTS.blockUpdated, claimResult.block);
        io.emit(
          SOCKET_EVENTS.leaderboardUpdated,
          gameManager.getLeaderboard()
        );
      }
    );

    socket.on(SOCKET_EVENTS.disconnect, (reason) => {
      const { playerCount: nextPlayerCount } = gameManager.disconnectPlayer(
        player.id
      );
      updateColorUsage(activeColorCounts, player.color as NeonColor, -1);
      playerLastCursorUpdate.delete(player.id);

      console.log(
        `[socket] disconnected id=${socket.id} player=${player.name} reason=${reason}`
      );

      // Broadcast leave event with metadata for toasts
      io.emit(SOCKET_EVENTS.playerCount, {
        count: nextPlayerCount,
        event: "leave",
        playerName: player.name
      });

      // Notify clients to remove the cursor
      io.emit(SOCKET_EVENTS.cursorRemove, { playerId: player.id });
    });
  });
}
