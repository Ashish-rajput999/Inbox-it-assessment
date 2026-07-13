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

export interface GridState {
  columns: number;
  rows: number;
  blocks: Block[];
}

export const SOCKET_EVENTS = {
  connect: "connect",
  disconnect: "disconnect",
  init: "init"
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface InitPayload {
  player: Player;
  grid: GridState;
}

export interface ServerToClientEvents {
  init: (payload: InitPayload) => void;
}

export interface ClientToServerEvents {}
