import { useCallback, type CSSProperties } from "react";
import { SOCKET_EVENTS } from "shared";

import GridCanvas from "./components/GridCanvas";
import { useGameSocket } from "./hooks/useGameSocket";
import { socket } from "./socket";
import { useGameStore } from "./store/gameStore";

const pageStyle: CSSProperties = {
  position: "relative",
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  backgroundColor: "#0a0f1d",
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#e2e8f0"
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  top: "20px",
  left: "20px",
  width: "320px",
  maxHeight: "calc(100vh - 40px)",
  overflow: "auto",
  padding: "18px 20px",
  borderRadius: "18px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background:
    "linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(10, 15, 29, 0.78))",
  backdropFilter: "blur(16px)",
  boxShadow: "0 24px 80px rgba(2, 6, 23, 0.45)",
  boxSizing: "border-box",
  pointerEvents: "none"
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "12px"
};

const dotBaseStyle: CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "999px",
  display: "inline-block"
};

const titleStyle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "28px",
  lineHeight: 1.1
};

const mutedTextStyle: CSSProperties = {
  margin: "0 0 10px",
  color: "#cbd5e1",
  fontSize: "14px"
};

const leaderboardListStyle: CSSProperties = {
  listStyle: "none",
  margin: "12px 0 0",
  padding: 0,
  display: "grid",
  gap: "8px"
};

const leaderboardItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 12px",
  borderRadius: "12px",
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  border: "1px solid rgba(148, 163, 184, 0.12)"
};

const playerNameStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 10px",
  borderRadius: "999px",
  backgroundColor: "rgba(15, 23, 42, 0.78)",
  border: "1px solid rgba(148, 163, 184, 0.14)",
  fontSize: "13px"
};

export default function App() {
  useGameSocket();

  const hasInitialized = useGameStore((state) => state.hasInitialized);
  const isConnected = useGameStore((state) => state.isConnected);
  const leaderboard = useGameStore((state) => state.leaderboard);
  const player = useGameStore((state) => state.player);
  const playerCount = useGameStore((state) => state.playerCount);

  const handleBlockClick = useCallback((blockId: string) => {
    socket.emit(SOCKET_EVENTS.claimBlock, { blockId });
  }, []);

  return (
    <main style={pageStyle}>
      <GridCanvas onClaimBlock={handleBlockClick} />

      <section style={overlayStyle}>
        <h1 style={titleStyle}>BlockWars</h1>
        <div style={rowStyle}>
          <span
            style={{
              ...dotBaseStyle,
              backgroundColor: isConnected ? "#22c55e" : "#ef4444"
            }}
          />
          <span>
            {isConnected ? "Connected to server" : "Disconnected from server"}
          </span>
        </div>

        <p style={mutedTextStyle}>
          {hasInitialized
            ? "Canvas renderer active. Drag to pan, scroll to zoom, click to claim."
            : "Joining arena..."}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
          <span style={badgeStyle}>
            Player: {player ? player.name : "Waiting..."}
          </span>
          <span style={badgeStyle}>Online: {playerCount}</span>
          <span style={badgeStyle}>
            Color:{" "}
            {player ? (
              <span style={{ color: player.color }}>{player.color}</span>
            ) : (
              "Waiting..."
            )}
          </span>
        </div>

        <div>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
            Leaderboard
          </p>
          {leaderboard.length > 0 ? (
            <ul style={leaderboardListStyle}>
              {leaderboard.map((entry) => (
                <li key={entry.playerId} style={leaderboardItemStyle}>
                  <span style={{ ...playerNameStyle, color: entry.color }}>
                    {entry.name}
                  </span>
                  <span>{entry.blockCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ ...mutedTextStyle, marginTop: "12px" }}>No claims yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
