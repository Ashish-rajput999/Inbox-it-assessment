import type { GridState, Player } from "shared";
import { create } from "zustand";

interface ConnectionState {
  isConnected: boolean;
  hasInitialized: boolean;
  player: Player | null;
  grid: GridState | null;
  setConnected: (isConnected: boolean) => void;
  initializeGame: (player: Player, grid: GridState) => void;
}

export const useGameStore = create<ConnectionState>((set) => ({
  isConnected: false,
  hasInitialized: false,
  player: null,
  grid: null,
  setConnected: (isConnected) => {
    set({ isConnected });
  },
  initializeGame: (player, grid) => {
    set({
      hasInitialized: true,
      player,
      grid
    });
  }
}));
