import type {
  Block,
  ClaimBlockResult,
  GridState,
  LeaderboardEntry,
  Player
} from "shared";

const GRID_COLUMNS = 40;
const GRID_ROWS = 25;
export const COOLDOWN_MS = 3000;

interface PlayerRegistrationResult {
  playerCount: number;
}

interface PlayerDisconnectResult {
  playerCount: number;
}

export interface GameManager {
  getGridState: () => GridState;
  registerPlayer: (player: Player) => PlayerRegistrationResult;
  disconnectPlayer: (playerId: string) => PlayerDisconnectResult;
  claimBlock: (playerId: string, blockId: string) => ClaimBlockResult;
  getPlayerCount: () => number;
  getLeaderboard: () => LeaderboardEntry[];
}

export function createInitialGrid(): GridState {
  const blocks: Block[] = [];

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLUMNS; x += 1) {
      blocks.push({
        id: `block-${y}-${x}`,
        x,
        y,
        ownerId: null,
        ownerColor: null,
        claimedAt: null
      });
    }
  }

  return {
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    blocks
  };
}

function createBlockIndex(blocks: Block[]): Map<string, Block> {
  return new Map(blocks.map((block) => [block.id, block]));
}

function isOnCooldown(lastClaimAt: number | undefined, now: number): boolean {
  if (lastClaimAt === undefined) {
    return false;
  }

  return now - lastClaimAt < COOLDOWN_MS;
}

function getRemainingCooldownMs(lastClaimAt: number, now: number): number {
  return Math.max(COOLDOWN_MS - (now - lastClaimAt), 0);
}

function updateBlockCount(
  blockCounts: Map<string, number>,
  playerId: string,
  delta: number
): void {
  const nextCount = Math.max((blockCounts.get(playerId) ?? 0) + delta, 0);
  blockCounts.set(playerId, nextCount);
}

function createLeaderboard(
  allPlayers: Map<string, Player>,
  blockCounts: Map<string, number>
): LeaderboardEntry[] {
  return Array.from(blockCounts.entries())
    .map(([playerId, blockCount]) => {
      const player = allPlayers.get(playerId);

      if (!player) {
        return null;
      }

      return {
        playerId,
        name: player.name,
        color: player.color,
        blockCount
      };
    })
    .filter(
      (entry): entry is LeaderboardEntry =>
        entry !== null && entry.blockCount > 0
    )
    .sort((left, right) => {
      if (right.blockCount !== left.blockCount) {
        return right.blockCount - left.blockCount;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 10);
}

export function createGameManager(): GameManager {
  const grid = createInitialGrid();
  const blocksById = createBlockIndex(grid.blocks);
  const activePlayers = new Map<string, Player>();
  const allPlayers = new Map<string, Player>();
  const playerCooldowns = new Map<string, number>();
  const blockCounts = new Map<string, number>();

  return {
    getGridState: () => grid,

    registerPlayer: (player) => {
      activePlayers.set(player.id, player);
      allPlayers.set(player.id, player);

      if (!blockCounts.has(player.id)) {
        blockCounts.set(player.id, 0);
      }

      return {
        playerCount: activePlayers.size
      };
    },

    disconnectPlayer: (playerId) => {
      activePlayers.delete(playerId);
      playerCooldowns.delete(playerId);

      return {
        playerCount: activePlayers.size
      };
    },

    claimBlock: (playerId, blockId) => {
      const block = blocksById.get(blockId);

      if (!block) {
        return {
          success: false,
          reason: "not_found"
        };
      }

      const player = activePlayers.get(playerId);

      if (!player) {
        return {
          success: false,
          reason: "not_connected"
        };
      }

      const now = Date.now();
      const lastClaimAt = playerCooldowns.get(playerId);

      if (isOnCooldown(lastClaimAt, now)) {
        return {
          success: false,
          reason: "on_cooldown",
          remainingMs: getRemainingCooldownMs(lastClaimAt!, now)
        };
      }

      if (block.ownerId === playerId) {
        return {
          success: false,
          reason: "already_yours"
        };
      }

      const previousOwnerId = block.ownerId;

      // This function validates and mutates in one synchronous step. In Node's
      // single-threaded event loop, no other claim can interleave mid-function,
      // so back-to-back claims for the same block are resolved by arrival order.
      block.ownerId = player.id;
      block.ownerColor = player.color;
      block.claimedAt = now;
      playerCooldowns.set(playerId, now);

      // Ownership counts are updated incrementally here, making each claim O(1)
      // instead of recounting the entire 1000-block grid on every mutation.
      updateBlockCount(blockCounts, player.id, 1);

      if (previousOwnerId) {
        updateBlockCount(blockCounts, previousOwnerId, -1);
      }

      return {
        success: true,
        block
      };
    },

    getPlayerCount: () => activePlayers.size,

    getLeaderboard: () => createLeaderboard(allPlayers, blockCounts)
  };
}
