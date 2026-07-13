/**
 * NOTE: This is a deploy-time copy of the /shared package for standalone client builds (e.g. Vercel).
 * The server continues to use the root /shared workspace package.
 * BOTH MUST BE KEPT IN SYNC if types or socket events change.
 */

export interface Block {
  id: string;
  x: number;
  y: number;
  ownerId: string | null;
  ownerColor: string | null;
  claimedAt: number | null;
}

export interface Player {
  id: string;
  name: string;
  color: string;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  color: string;
  blockCount: number;
}

export interface GridState {
  columns: number;
  rows: number;
  blocks: Block[];
}

export const SOCKET_EVENTS = {
  connect: "connect",
  disconnect: "disconnect",
  init: "init",
  claimBlock: "claim_block",
  claimResult: "claim_result",
  blockUpdated: "block_updated",
  playerCount: "player_count",
  leaderboardUpdated: "leaderboard_updated",
  cursorMove: "cursor_move",
  cursorUpdate: "cursor_update",
  cursorRemove: "cursor_remove"
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface InitPayload {
  player: Player;
  grid: GridState;
}

export interface PlayerCountPayload {
  count: number;
  event?: "join" | "leave";
  playerName?: string;
}

export interface CursorMovePayload {
  x: number;
  y: number;
}

export interface CursorUpdatePayload {
  playerId: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface CursorRemovePayload {
  playerId: string;
}

export interface ClaimBlockPayload {
  blockId: string;
}

export type ClaimFailureReason =
  | "not_found"
  | "on_cooldown"
  | "already_yours"
  | "not_connected";

export interface ClaimBlockSuccess {
  success: true;
  block: Block;
}

export interface ClaimBlockFailure {
  success: false;
  reason: ClaimFailureReason;
  remainingMs?: number;
}

export type ClaimBlockResult = ClaimBlockSuccess | ClaimBlockFailure;

export interface ServerToClientEvents {
  init: (payload: InitPayload) => void;
  claim_result: (payload: ClaimBlockResult) => void;
  block_updated: (block: Block) => void;
  player_count: (payload: PlayerCountPayload) => void;
  leaderboard_updated: (entries: LeaderboardEntry[]) => void;
  cursor_update: (payload: CursorUpdatePayload) => void;
  cursor_remove: (payload: CursorRemovePayload) => void;
}

export interface ClientToServerEvents {
  claim_block: (payload: ClaimBlockPayload) => void;
  cursor_move: (payload: CursorMovePayload) => void;
}
