# BlockWars

A high-performance, real-time multiplayer grid territory game inspired by r/place. Claim blocks, steal territory, and dominate the leaderboard in a neon-infused digital warzone.

🔗 **Live:** https://blockwars-xxxxvercelapp.vercel.app 
**Server:** https://blockwars-server.onrender.com

## 🚀 Features

- **Real-time Territory Claiming:** Atomic conflict resolution ensures only one player can claim a block at a time.
- **Stealing Mechanics:** Blocks can be stolen from other players, triggering vibrant "pop" and "ripple" animations.
- **Authoritative Server:** 3-second server-side cooldowns prevent spam and ensure fair play.
- **Live Multiplayer Presence:** Smooth, rate-limited cursor synchronization with Lerp interpolation.
- **Dynamic Leaderboard:** O(1) statistics tracking with a pinned "My Rank" view for competitive play.
- **Advanced Canvas Renderer:** Dirty-flag `requestAnimationFrame` loop with a custom camera system (zoom-to-cursor, panning, and viewport clamping).
- **Responsive HUD:** Glassmorphic UI with presence toasts and real-time agent status.

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Zustand, Vite, HTML5 Canvas |
| **Backend** | Node.js, Express, Socket.IO, TypeScript |
| **Shared** | TypeScript Monorepo (npm workspaces) |
| **Styling** | CSS Variables, Glassmorphism, Orbitron Display Font |

## 📐 Architecture

```text
[ Clients ] <---> [ Socket.IO ] <---> [ Authoritative Node Server ]
    |                |                         |
    | (Cursor Move)  | (Claim Block)           | (Grid State / Leaderboard)
    +----------------+------------------------->|
                     |<------------------------+
                     | (Block Updates / Presence)
```

### Socket Events

| Event | Direction | Payload | Purpose |
| :--- | :--- | :--- | :--- |
| `init` | S -> C | `{ player, grid }` | Initial state sync on connection. |
| `claim_block` | C -> S | `{ blockId }` | Request to claim a specific grid cell. |
| `claim_result` | S -> C | `{ success, reason, ... }` | Result of a claim attempt (includes cooldown info). |
| `block_updated` | S -> C | `Block` | Broadcast of a successful ownership change. |
| `player_count` | S -> C | `{ count, event, playerName }` | Real-time agent count and join/leave notifications. |
| `leaderboard_updated` | S -> C | `LeaderboardEntry[]` | Updated rankings based on block counts. |
| `cursor_move` | C -> S | `{ x, y }` | Throttled cursor position in world coordinates. |
| `cursor_update` | S -> C | `{ playerId, x, y, ... }` | Broadcast of other players' cursor positions. |
| `cursor_remove` | S -> C | `{ playerId }` | Cleanup event when a player disconnects. |

### Conflict Resolution & Performance

- **Atomic Mutations:** The server processes claims synchronously within Node's single-threaded event loop, making `validate + mutate` operations naturally race-free without complex locking.
- **Rate Limiting:** Cursor updates are throttled to 40ms on the client and 30ms on the server to maintain smoothness while capping network overhead.
- **Optimized Rendering:** The Canvas renderer uses a "dirty flag" system, only redrawing when state changes or animations are active, saving CPU/GPU cycles.

## 💻 Local Development

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run in Development Mode:**
   ```bash
   npm run dev
   ```
   This launches the server on `http://localhost:3001` and the client on `http://localhost:5173`.

3. **Build for Production:**
   ```bash
   npm run build
   ```

## 🌐 Deployment

### Backend (Render / Heroku)
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start --workspace server`
- **Environment Variables:**
  - `PORT`: Server port (default 3001)
  - `CLIENT_ORIGIN`: URL of your frontend for CORS restriction.

### Frontend (Vercel / Netlify)
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_SERVER_URL`: URL of your deployed backend.

## ⚖️ Trade-offs

- **In-Memory State:** Grid state is stored in memory for maximum performance. While this means the map resets on server restart, it avoids database latency for a company assessment context.
- **Broadcast Scale:** Current implementation broadcasts every claim to all clients. At a larger scale (e.g., millions of blocks), this would be refactored to use region-based subscriptions (spatial partitioning).
