const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'watchtogether-server' });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/rooms', (_req, res) => {
  const roomId = nanoid(8);
  res.json({ roomId });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

// Map<roomId, Set<socketId>>
const rooms = new Map();
const MAX_PER_ROOM = 2;

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function otherSocketId(room, selfId) {
  for (const id of room) if (id !== selfId) return id;
  return null;
}

io.on('connection', (socket) => {
  let joinedRoom = null;

  socket.on('join-room', ({ roomId }, ack) => {
    if (!roomId || typeof roomId !== 'string') {
      ack && ack({ ok: false, error: 'invalid-room' });
      return;
    }
    const room = getRoom(roomId);
    if (room.size >= MAX_PER_ROOM && !room.has(socket.id)) {
      ack && ack({ ok: false, error: 'room-full' });
      return;
    }
    // If the same socket is switching rooms, evict it from the old one first.
    // Otherwise the old room's Set keeps a phantom member and falsely fills up.
    if (joinedRoom && joinedRoom !== roomId) {
      const oldRoom = rooms.get(joinedRoom);
      if (oldRoom) {
        oldRoom.delete(socket.id);
        socket.to(joinedRoom).emit('partner-left', { partnerId: socket.id });
        if (oldRoom.size === 0) rooms.delete(joinedRoom);
      }
      socket.leave(joinedRoom);
    }
    room.add(socket.id);
    joinedRoom = roomId;
    socket.join(roomId);

    const partnerId = otherSocketId(room, socket.id);
    ack && ack({ ok: true, roomId, partnerConnected: !!partnerId, partnerId });

    if (partnerId) {
      // notify both sides — the new joiner is NOT the initiator (the existing peer is)
      socket.to(partnerId).emit('partner-joined', { partnerId: socket.id });
      socket.emit('partner-present', { partnerId });
    }
  });

  socket.on('screen-signal', ({ to, signal }) => {
    if (!to) return;
    io.to(to).emit('screen-signal', { from: socket.id, signal });
  });

  socket.on('voice-signal', ({ to, signal }) => {
    if (!to) return;
    io.to(to).emit('voice-signal', { from: socket.id, signal });
  });

  socket.on('chat-message', ({ text }) => {
    if (!joinedRoom || typeof text !== 'string' || !text.trim()) return;
    const message = {
      id: nanoid(6),
      from: socket.id,
      text: text.slice(0, 2000),
      ts: Date.now(),
    };
    io.to(joinedRoom).emit('chat-message', message);
  });

  socket.on('screen-share-stopped', () => {
    if (!joinedRoom) return;
    socket.to(joinedRoom).emit('screen-share-stopped', { from: socket.id });
  });

  socket.on('disconnect', () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;
    room.delete(socket.id);
    socket.to(joinedRoom).emit('partner-left', { partnerId: socket.id });
    if (room.size === 0) rooms.delete(joinedRoom);
  });
});

server.listen(PORT, () => {
  console.log(`watchtogether server listening on :${PORT}`);
});
