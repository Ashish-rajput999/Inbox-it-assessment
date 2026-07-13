import { useEffect, type CSSProperties } from "react";
import type {
  Block,
  ClaimBlockResult,
  InitPayload,
  LeaderboardEntry
} from "shared";
import { SOCKET_EVENTS } from "shared";

import { socket } from "./socket";
import { useGameStore } from "./store/gameStore";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "32px",
  fontFamily: "Inter, system-ui, sans-serif",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  boxSizing: "border-box"
};

const cardStyle: CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  borderRadius: "16px",
  border: "1px solid #1e293b",
  backgroundColor: "#111827"
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "16px"
};

const dotBaseStyle: CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "999px",
  display: "inline-block"
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(40, 18px)",
  gap: "2px",
  marginTop: "24px",
  marginBottom: "24px"
};

const blockStyle: CSSProperties = {
  width: "18px",
  height: "18px",
  backgroundColor: "#374151",
  border: "none",
  padding: 0,
  cursor: "pointer"
};

export default function App() {
  const {
    grid,
    hasInitialized,
    isConnected,
    leaderboard,
    player,
    playerCount,
    initializeGame,
    setConnected,
    setLeaderboard,
    setPlayerCount,
    updateBlock
  } = useGameStore();

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

    const handlePlayerCount = (count: number) => {
      setPlayerCount(count);
    };

    const handleLeaderboardUpdated = (nextLeaderboard: LeaderboardEntry[]) => {
      setLeaderboard(nextLeaderboard);
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

    return () => {
      socket.off(SOCKET_EVENTS.connect, handleConnect);
      socket.off(SOCKET_EVENTS.disconnect, handleDisconnect);
      socket.off(SOCKET_EVENTS.init, handleInit);
      socket.off(SOCKET_EVENTS.claimResult, handleClaimResult);
      socket.off(SOCKET_EVENTS.blockUpdated, handleBlockUpdated);
      socket.off(SOCKET_EVENTS.playerCount, handlePlayerCount);
      socket.off(SOCKET_EVENTS.leaderboardUpdated, handleLeaderboardUpdated);
    };
  }, [
    initializeGame,
    setConnected,
    setLeaderboard,
    setPlayerCount,
    updateBlock
  ]);

  const handleBlockClick = (blockId: string) => {
    socket.emit(SOCKET_EVENTS.claimBlock, { blockId });
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={{ marginTop: 0, marginBottom: "24px" }}>BlockWars</h1>

        <div style={rowStyle}>
          <span
            style={{
              ...dotBaseStyle,
              backgroundColor: isConnected ? "#22c55e" : "#ef4444"
            }}
          />
          <span>
            Connection status: {isConnected ? "connected" : "disconnected"}
          </span>
        </div>

        <p>
          Your player: {player ? player.name : "Waiting for init..."}
        </p>

        <p>
          Your color:{" "}
          {player ? (
            <span style={{ color: player.color }}>{player.color}</span>
          ) : (
            "Waiting for init..."
          )}
        </p>

        <p>
          {hasInitialized && grid
            ? `Grid loaded: ${grid.blocks.length} blocks`
            : "Grid loading..."}
        </p>

        <p>Player count: {playerCount}</p>

        <div>
          <p style={{ marginBottom: "8px" }}>Leaderboard:</p>
          {leaderboard.length > 0 ? (
            <ul style={{ marginTop: 0 }}>
              {leaderboard.map((entry) => (
                <li key={entry.playerId}>
                  {entry.name} ({entry.color}) - {entry.blockCount}
                </li>
              ))}
            </ul>
          ) : (
            <p>No claims yet.</p>
          )}
        </div>

        {grid ? (
          <div style={gridStyle}>
            {grid.blocks.map((block) => (
              <button
                key={block.id}
                type="button"
                aria-label={`Claim ${block.id}`}
                onClick={() => {
                  handleBlockClick(block.id);
                }}
                style={{
                  ...blockStyle,
                  backgroundColor: block.ownerColor ?? "#374151"
                }}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
