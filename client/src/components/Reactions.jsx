import { useEffect, useState } from 'react';

const QUICK = ['❤️', '😂', '😮', '🔥', '😍', '👏'];

export default function Reactions({ socket }) {
  const [floating, setFloating] = useState([]);

  useEffect(() => {
    function onReaction(r) {
      const item = { id: r.id, emoji: r.emoji, x: 20 + Math.random() * 60 };
      setFloating((prev) => [...prev, item]);
      setTimeout(() => {
        setFloating((prev) => prev.filter((p) => p.id !== item.id));
      }, 2400);
    }
    socket.on('reaction', onReaction);
    return () => socket.off('reaction', onReaction);
  }, [socket]);

  function send(emoji) {
    socket.emit('reaction', { emoji });
  }

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-3 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-200">Reactions</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK.map((e) => (
          <button
            key={e}
            type="button"
            className="text-xl px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            onClick={() => send(e)}
            aria-label={`Send ${e} reaction`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Floating reactions overlay */}
      <div className="pointer-events-none absolute inset-0">
        {floating.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-2 text-2xl animate-float-up"
            style={{ left: `${f.x}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
