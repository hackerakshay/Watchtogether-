# 🎬 WatchTogether

A real-time **screen share + voice call** web app for exactly two people. Built for couple watch-parties — share your MoviBox / Netflix / YouTube / anything tab and watch together with synchronized voice + text chat.

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express + Socket.io
- **Peer connections:** [`simple-peer`](https://www.npmjs.com/package/simple-peer) (WebRTC)
- **No database, no auth, no login.**

---

## Features

- **Create a room** → get a shareable link
- **Share Screen** (`getDisplayMedia`) — partner sees your screen as a live video stream
- **Voice call** (`getUserMedia` audio) running simultaneously, with mute/unmute
- **Text chat** sidebar
- **Mobile responsive** — chat collapses to a toggle button on small screens
- Dark indigo theme

---

## Project structure

```
watchtogether/
├── client/        # React + Vite frontend
└── server/        # Node + Express + Socket.io backend
```

---

## Run locally

You need **Node 18+**. Open two terminals.

### 1. Start the backend

```bash
cd server
npm install
npm run dev
# server listens on http://localhost:3001
```

### 2. Start the frontend

```bash
cd client
npm install
npm run dev
# Vite dev server on http://localhost:5173
```

By default the client connects to `http://localhost:3001`. Override with:

```bash
# client/.env.local
VITE_SERVER_URL=https://your-backend.example.com
```

### 3. Test with two browser tabs

1. Open http://localhost:5173 → click **Create Room**
2. Copy the URL from the address bar
3. Open the URL in a **second browser tab** (or a different browser / incognito window)
4. In tab 1 click **Share Screen** → pick a tab/screen
5. Tab 2 should see the live stream. Voice should auto-connect — allow microphone access in both tabs.

> Tip: Chrome and Edge work best for `getDisplayMedia`. On Safari you may need to enable WebRTC features manually.

---

## Deploy

### Backend → Render (free)

1. Push this repo to GitHub.
2. [render.com](https://render.com) → **New Web Service** → connect this repo.
3. **Root directory:** `server`
4. **Build command:** `npm install`
5. **Start command:** `node index.js`
6. Copy the public URL Render gives you (e.g. `https://watchtogether.onrender.com`).

### Frontend → Vercel (free)

1. [vercel.com](https://vercel.com) → **Import Project** → pick this repo.
2. **Root directory:** `client`
3. Add an env variable:
   - `VITE_SERVER_URL=https://watchtogether.onrender.com`
4. Deploy → you get a `*.vercel.app` URL.

Send the Vercel URL to your partner. You share your screen, they watch. Done. 🎬

---

## How to watch MoviBox / any site

1. Open MoviBox (or any streaming site) in a browser tab.
2. In WatchTogether → click **Share Screen**.
3. Pick the **specific tab** (recommended — uses less bandwidth than the whole screen and includes the page audio when supported).
4. Your partner sees the stream live.
5. You control playback, they watch.

No URL extraction. No CORS issues. Works for any site.

---

## Socket events (server ↔ client)

| Event | Direction | Payload |
|------|-----------|---------|
| `join-room` | client → server | `{ roomId }` (ack with `{ ok, partnerConnected, partnerId }`) |
| `partner-joined` | server → client | `{ partnerId }` (existing peer is the initiator) |
| `partner-present` | server → client | `{ partnerId }` (newly joined peer; partner initiates) |
| `partner-left` | server → client | `{ partnerId }` |
| `screen-signal` | both | `{ to, signal }` (relayed) |
| `voice-signal` | both | `{ to, signal }` (relayed) |
| `screen-share-stopped` | both | `{}` |
| `chat-message` | both | `{ text }` outbound; `{ id, from, text, ts }` inbound |

Rooms are an in-memory `Map<roomId, Set<socketId>>` capped at 2 users.

---

## License

MIT — built for personal use, hack on it freely.
