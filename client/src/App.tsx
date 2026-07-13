import { useEffect, type CSSProperties } from "react";
import type { InitPayload } from "shared";
import { SOCKET_EVENTS } from "shared";

import { socket } from "./socket";
import { useGameStore } from "./store/gameStore";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "32px",
  fontFamily: "Inter, system-ui, sans-serif",
  backgroundColor: "#0f172a",
  color: "#e2e8f0"
};

const cardStyle: CSSProperties = {
  maxWidth: "720px",
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

export default function App() {
  const { grid, hasInitialized, isConnected, player, initializeGame, setConnected } =
    useGameStore();

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

    if (socket.connected) {
      setConnected(true);
    }

    socket.on(SOCKET_EVENTS.connect, handleConnect);
    socket.on(SOCKET_EVENTS.disconnect, handleDisconnect);
    socket.on(SOCKET_EVENTS.init, handleInit);

    return () => {
      socket.off(SOCKET_EVENTS.connect, handleConnect);
      socket.off(SOCKET_EVENTS.disconnect, handleDisconnect);
      socket.off(SOCKET_EVENTS.init, handleInit);
    };
  }, [initializeGame, setConnected]);

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
      </section>
    </main>
  );
}
