import type {
  Block,
  GridState,
  LeaderboardEntry,
  Player,
  PlayerCountPayload
} from "shared";
import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
}

interface ConnectionState {
  isConnected: boolean;
  hasInitialized: boolean;
  player: Player | null;
  grid: GridState | null;
  playerCount: number;
  leaderboard: LeaderboardEntry[];
  toasts: Toast[];
  setConnected: (isConnected: boolean) => void;
  initializeGame: (player: Player, grid: GridState) => void;
  updateBlock: (block: Block) => void;
  setPlayerCount: (payload: PlayerCountPayload) => void;
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  addToast: (message: string) => void;
}

export const useGameStore = create<ConnectionState>((set) => ({
  isConnected: false,
  hasInitialized: false,
  player: null,
  grid: null,
  playerCount: 0,
  leaderboard: [],
  toasts: [],
  setConnected: (isConnected) => {
    set({ isConnected });
  },
  initializeGame: (player, grid) => {
    set({
      hasInitialized: true,
      player,
      grid
    });
  },
  updateBlock: (block) => {
    set((state) => {
      if (!state.grid) {
        return state;
      }

      return {
        grid: {
          ...state.grid,
          blocks: state.grid.blocks.map((currentBlock) =>
            currentBlock.id === block.id ? block : currentBlock
          )
        }
      };
    });
  },
  setPlayerCount: (payload) => {
    set((state) => {
      if (payload.event && payload.playerName) {
        const message = `${payload.playerName} ${
          payload.event === "join" ? "joined the war" : "left the war"
        }`;
        state.addToast(message);
      }
      return { playerCount: payload.count };
    });
  },
  setLeaderboard: (leaderboard) => {
    set({ leaderboard });
  },
  addToast: (message) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, message }]
    }));

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id)
      }));
    }, 3000);
  }
}));
