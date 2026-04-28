import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../socket.js';

export default function Home() {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function createRoom() {
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create room');
      const { roomId } = await res.json();
      navigate(`/room/${roomId}`);
    } catch (e) {
      setError(e.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  }

  function joinRoom(e) {
    e.preventDefault();
    const id = joinId.trim();
    if (!id) return;
    // Accept either a full URL or a raw room id
    const match = id.match(/\/room\/([^/?#]+)/);
    const roomId = match ? match[1] : id;
    navigate(`/room/${roomId}`);
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-gray-900/70 border border-gray-800 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            WatchTogether <span aria-hidden>🎬</span>
          </h1>
          <p className="text-gray-400">
            Watch anything together, anywhere.
          </p>
        </div>

        <button
          className="btn-primary w-full text-base py-3"
          onClick={createRoom}
          disabled={creating}
        >
          {creating ? 'Creating room…' : 'Create Room'}
        </button>

        <div className="my-6 flex items-center gap-3 text-gray-500 text-sm">
          <div className="flex-1 h-px bg-gray-800" />
          <span>or join a room</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <form onSubmit={joinRoom} className="space-y-3">
          <input
            className="input"
            placeholder="Paste room link or ID"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
          />
          <button type="submit" className="btn-secondary w-full">
            Join Room
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}

        <p className="mt-8 text-xs text-gray-500 text-center">
          Built for two. Share your screen, talk, chat.
        </p>
      </div>
    </div>
  );
}
