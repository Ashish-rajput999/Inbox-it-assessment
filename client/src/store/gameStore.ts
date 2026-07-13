import type { Block, GridState, LeaderboardEntry, Player } from "shared";
import { create } from "zustand";

interface ConnectionState {
  isConnected: boolean;
  hasInitialized: boolean;
  player: Player | null;
  grid: GridState | null;
  playerCount: number;
  leaderboard: LeaderboardEntry[];
  setConnected: (isConnected: boolean) => void;
  initializeGame: (player: Player, grid: GridState) => void;
  updateBlock: (block: Block) => void;
  setPlayerCount: (playerCount: number) => void;
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
}

export const useGameStore = create<ConnectionState>((set) => ({
  isConnected: false,
  hasInitialized: false,
  player: null,
  grid: null,
  playerCount: 0,
  leaderboard: [],
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
  setPlayerCount: (playerCount) => {
    set({ playerCount });
  },
  setLeaderboard: (leaderboard) => {
    set({ leaderboard });
  }
}));
