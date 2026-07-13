import { useEffect } from "react";
import type {
  Block,
  ClaimBlockResult,
  CursorRemovePayload,
  CursorUpdatePayload,
  InitPayload,
  LeaderboardEntry,
  PlayerCountPayload
} from "../shared";
import { SOCKET_EVENTS } from "../shared";

import { socket } from "../socket";
import { useGameStore } from "../store/gameStore";

interface UseGameSocketOptions {
  onCursorUpdate?: (payload: CursorUpdatePayload) => void;
  onCursorRemove?: (payload: CursorRemovePayload) => void;
}

export function useGameSocket(options: UseGameSocketOptions = {}): void {
  const { onCursorUpdate, onCursorRemove } = options;
  const initializeGame = useGameStore((state) => state.initializeGame);
  const setConnected = useGameStore((state) => state.setConnected);
  const setLeaderboard = useGameStore((state) => state.setLeaderboard);
  const setPlayerCount = useGameStore((state) => state.setPlayerCount);
  const updateBlock = useGameStore((state) => state.updateBlock);

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleInit = ({
      player: nextPlayer,
      grid: nextGrid
    }: InitPayload) => {
      initializeGame(nextPlayer, nextGrid);
    };

    const handleClaimResult = (result: ClaimBlockResult) => {
      if (result.success) {
        return;
      }

      if (result.reason === "on_cooldown") {
        console.warn("claim_result", result.reason, result.remainingMs);
        return;
      }

      console.warn("claim_result", result.reason);
    };

    const handleBlockUpdated = (block: Block) => {
      updateBlock(block);
    };

    const handlePlayerCount = (payload: PlayerCountPayload) => {
      setPlayerCount(payload);
    };

    const handleLeaderboardUpdated = (entries: LeaderboardEntry[]) => {
      setLeaderboard(entries);
    };

    const handleCursorUpdate = (payload: CursorUpdatePayload) => {
      onCursorUpdate?.(payload);
    };

    const handleCursorRemove = (payload: CursorRemovePayload) => {
      onCursorRemove?.(payload);
    };

    if (socket.connected) {
      setConnected(true);
    }

    socket.on(SOCKET_EVENTS.connect, handleConnect);
    socket.on(SOCKET_EVENTS.disconnect, handleDisconnect);
    socket.on(SOCKET_EVENTS.init, handleInit);
    socket.on(SOCKET_EVENTS.claimResult, handleClaimResult);
    socket.on(SOCKET_EVENTS.blockUpdated, handleBlockUpdated);
    socket.on(SOCKET_EVENTS.playerCount, handlePlayerCount);
    socket.on(SOCKET_EVENTS.leaderboardUpdated, handleLeaderboardUpdated);
    socket.on(SOCKET_EVENTS.cursorUpdate, handleCursorUpdate);
    socket.on(SOCKET_EVENTS.cursorRemove, handleCursorRemove);

    return () => {
      socket.off(SOCKET_EVENTS.connect, handleConnect);
      socket.off(SOCKET_EVENTS.disconnect, handleDisconnect);
      socket.off(SOCKET_EVENTS.init, handleInit);
      socket.off(SOCKET_EVENTS.claimResult, handleClaimResult);
      socket.off(SOCKET_EVENTS.blockUpdated, handleBlockUpdated);
      socket.off(SOCKET_EVENTS.playerCount, handlePlayerCount);
      socket.off(SOCKET_EVENTS.leaderboardUpdated, handleLeaderboardUpdated);
      socket.off(SOCKET_EVENTS.cursorUpdate, handleCursorUpdate);
      socket.off(SOCKET_EVENTS.cursorRemove, handleCursorRemove);
    };
  }, [
    initializeGame,
    onCursorRemove,
    onCursorUpdate,
    setConnected,
    setLeaderboard,
    setPlayerCount,
    updateBlock
  ]);
}
