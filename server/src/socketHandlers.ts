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
    io.emit(SOCKET_EVENTS.playerCount, playerCount);

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

      console.log(
        `[socket] disconnected id=${socket.id} player=${player.name} reason=${reason}`
      );

      io.emit(SOCKET_EVENTS.playerCount, nextPlayerCount);
    });
  });
}
