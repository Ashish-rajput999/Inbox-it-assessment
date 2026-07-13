import { randomUUID } from "node:crypto";
import type { GridState, Player, ServerToClientEvents } from "shared";
import { SOCKET_EVENTS } from "shared";
import type { Server, Socket } from "socket.io";

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

type BlockWarsServer = Server<
  Record<string, never>,
  ServerToClientEvents
>;

type BlockWarsSocket = Socket<
  Record<string, never>,
  ServerToClientEvents
>;

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createPlayer(): Player {
  const suffix = Math.floor(10 + Math.random() * 90);

  return {
    id: randomUUID(),
    color: pickRandomItem(NEON_COLORS),
    name: `${pickRandomItem(ADJECTIVES)}${pickRandomItem(ANIMALS)}${suffix}`
  };
}

export function registerSocketHandlers(
  io: BlockWarsServer,
  grid: GridState
): void {
  io.on(SOCKET_EVENTS.connect, (socket: BlockWarsSocket) => {
    const player = createPlayer();

    console.log(
      `[socket] connected id=${socket.id} player=${player.name} color=${player.color}`
    );

    socket.emit(SOCKET_EVENTS.init, {
      player,
      grid
    });

    socket.on(SOCKET_EVENTS.disconnect, (reason) => {
      console.log(
        `[socket] disconnected id=${socket.id} player=${player.name} reason=${reason}`
      );
    });
  });
}
