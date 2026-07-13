import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { SOCKET_EVENTS } from "shared";

import GridCanvas from "./components/GridCanvas";
import { useGameSocket } from "./hooks/useGameSocket";
import { socket } from "./socket";
import { useGameStore } from "./store/gameStore";

// --- Global UI Constants ---
const UI_PADDING = "24px";
const GLASS_BG = "rgba(10, 15, 28, 0.75)";
const GLASS_BORDER = "rgba(0, 242, 255, 0.15)";
const GLASS_BLUR = "16px";

// --- Main Layout Wrappers ---
const pageStyle: CSSProperties = {
  position: "relative",
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  color: "var(--text-primary)"
};

// 1. Top-Left: Logo & Player Info
const topLeftContainerStyle: CSSProperties = {
  position: "fixed",
  top: UI_PADDING,
  left: UI_PADDING,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  pointerEvents: "none",
  zIndex: 10
};

const logoStyle: CSSProperties = {
  margin: 0,
  fontSize: "32px",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  textShadow: "0 0 20px rgba(0, 242, 255, 0.4)",
  color: "#ffffff"
};

const statusDotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  boxShadow: "0 0 10px currentColor"
};

const playerCardStyle: CSSProperties = {
  background: GLASS_BG,
  backdropFilter: `blur(${GLASS_BLUR})`,
  WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: "16px",
  padding: "16px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  pointerEvents: "auto",
  animation: "slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1)"
};

// 2. Bottom-Left: Online Presence
const bottomLeftContainerStyle: CSSProperties = {
  position: "fixed",
  bottom: UI_PADDING,
  left: UI_PADDING,
  background: GLASS_BG,
  backdropFilter: `blur(${GLASS_BLUR})`,
  WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: "99px",
  padding: "8px 16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  pointerEvents: "auto",
  animation: "slideInBottom 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both"
};

// 3. Top-Right: Leaderboard
const leaderboardContainerStyle: CSSProperties = {
  position: "fixed",
  top: UI_PADDING,
  right: UI_PADDING,
  width: "280px",
  background: GLASS_BG,
  backdropFilter: `blur(${GLASS_BLUR})`,
  WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  pointerEvents: "auto",
  animation: "slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both"
};

const leaderboardTitleStyle: CSSProperties = {
  margin: "0 0 16px 0",
  fontSize: "14px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--text-secondary)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const leaderboardListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "8px"
};

// 4. Bottom-Right: Toasts
const toastContainerStyle: CSSProperties = {
  position: "fixed",
  bottom: UI_PADDING,
  right: UI_PADDING,
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  zIndex: 100,
  pointerEvents: "none"
};

const toastStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: "12px",
  background: GLASS_BG,
  backdropFilter: `blur(${GLASS_BLUR})`,
  WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
  border: `1px solid ${GLASS_BORDER}`,
  color: "var(--text-primary)",
  fontSize: "14px",
  fontWeight: 500,
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
  animation: "toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
};

// --- Cooldown SVG Component ---
function CooldownRing({
  color,
  cooldownMs,
  lastClaimTime
}: {
  color: string;
  cooldownMs: number;
  lastClaimTime: number | null;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!lastClaimTime) {
      setProgress(0);
      return;
    }

    let frameId: number;
    const update = () => {
      const elapsed = Date.now() - lastClaimTime;
      if (elapsed < cooldownMs) {
        setProgress(1 - elapsed / cooldownMs);
        frameId = requestAnimationFrame(update);
      } else {
        setProgress(0);
      }
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [lastClaimTime, cooldownMs]);

  const size = 48;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Inner Avatar */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: size - 12,
          height: size - 12,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 15px ${color}`,
          opacity: progress > 0 ? 0.5 : 1,
          transition: "opacity 0.2s"
        }}
      />
      {/* Cooldown Ring */}
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {progress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

export default function App() {
  useGameSocket();

  const hasInitialized = useGameStore((state) => state.hasInitialized);
  const isConnected = useGameStore((state) => state.isConnected);
  const leaderboard = useGameStore((state) => state.leaderboard);
  const player = useGameStore((state) => state.player);
  const playerCount = useGameStore((state) => state.playerCount);
  const toasts = useGameStore((state) => state.toasts);

  const [lastClaimTime, setLastClaimTime] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // We find the player's own block count from the leaderboard
  const myEntry = leaderboard.find((entry) => entry.playerId === player?.id);
  const myBlockCount = myEntry ? myEntry.blockCount : 0;

  const handleBlockClick = useCallback((blockId: string) => {
    // Optimistically start local cooldown visual
    setLastClaimTime(Date.now());
    setCooldownRemaining(3000); // 3s defined in server
    socket.emit(SOCKET_EVENTS.claimBlock, { blockId });
  }, []);

  // Listen to claim results to sync actual cooldowns if rejected
  useEffect(() => {
    const handleResult = (result: any) => {
      if (!result.success && result.reason === "on_cooldown" && result.remainingMs) {
        setCooldownRemaining(result.remainingMs);
        setLastClaimTime(Date.now() - (3000 - result.remainingMs));
      }
    };
    socket.on(SOCKET_EVENTS.claimResult, handleResult);
    return () => {
      socket.off(SOCKET_EVENTS.claimResult, handleResult);
    };
  }, []);

  return (
    <main style={pageStyle}>
      <div className="bg-glow" />
      <style>
        {`
          @keyframes slideInLeft {
            from { transform: translateX(-40px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideInRight {
            from { transform: translateX(40px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideInBottom {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes toastIn {
            from { transform: translateX(100%) scale(0.9); opacity: 0; }
            to { transform: translateX(0) scale(1); opacity: 1; }
          }
          .leaderboard-row {
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        `}
      </style>

      <GridCanvas onClaimBlock={handleBlockClick} />

      {/* Top Left: Logo & Player Info */}
      <section style={topLeftContainerStyle}>
        <h1 style={logoStyle}>
          <div
            style={{
              ...statusDotStyle,
              backgroundColor: isConnected ? "var(--accent-color)" : "#ef4444",
              color: isConnected ? "var(--accent-color)" : "#ef4444"
            }}
          />
          BlockWars
        </h1>

        {hasInitialized && player && (
          <div style={playerCardStyle}>
            <CooldownRing
              color={player.color}
              cooldownMs={cooldownRemaining}
              lastClaimTime={lastClaimTime}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                AGENT
              </span>
              <span style={{ fontSize: "18px", fontWeight: 600, color: player.color }}>
                {player.name}
              </span>
            </div>
            <div
              style={{
                marginLeft: "auto",
                paddingLeft: "16px",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end"
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                TERRITORY
              </span>
              <span style={{ fontSize: "24px", fontWeight: 700, fontFamily: "var(--font-display)" }}>
                {myBlockCount}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Bottom Left: Online Presence */}
      {hasInitialized && (
        <section style={bottomLeftContainerStyle}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Fake dots for aesthetic - in a real app these would be the actual player colors */}
            {leaderboard.slice(0, 3).map((entry, i) => (
              <div
                key={entry.playerId}
                title={entry.name}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: entry.color,
                  marginLeft: i > 0 ? -6 : 0,
                  border: "2px solid #0a0f1c",
                  position: "relative",
                  zIndex: 3 - i
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>{playerCount}</strong> AGENTS ONLINE
          </span>
        </section>
      )}

      {/* Top Right: Leaderboard */}
      {hasInitialized && (
        <section style={leaderboardContainerStyle}>
          <h2 style={leaderboardTitleStyle}>
            Global Ranking
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>
            </svg>
          </h2>
          
          {leaderboard.length > 0 ? (
            <ul style={leaderboardListStyle}>
              {leaderboard.map((entry, index) => {
                const isMe = entry.playerId === player?.id;
                return (
                  <li
                    key={entry.playerId}
                    className="leaderboard-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      background: isMe ? "rgba(255,255,255,0.05)" : "transparent",
                      border: isMe ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                    }}
                  >
                    <span style={{ 
                      fontSize: "12px", 
                      fontWeight: 700, 
                      color: "var(--text-secondary)",
                      width: "16px"
                    }}>
                      {index + 1}
                    </span>
                    <div style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: entry.color,
                      boxShadow: `0 0 8px ${entry.color}`
                    }} />
                    <span style={{ 
                      flex: 1, 
                      fontSize: "14px", 
                      fontWeight: isMe ? 600 : 500,
                      color: isMe ? "#fff" : "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>
                      {entry.name}
                    </span>
                    <span style={{ 
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      color: entry.color
                    }}>
                      {entry.blockCount}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", textAlign: "center", margin: "20px 0" }}>
              Awaiting first blood...
            </p>
          )}
        </section>
      )}

      {/* Bottom Right: Toasts */}
      <div style={toastContainerStyle}>
        {toasts.map((toast) => (
          <div key={toast.id} style={toastStyle}>
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
