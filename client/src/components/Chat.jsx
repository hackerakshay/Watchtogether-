import { useEffect, useRef, useState } from 'react';

export default function Chat({ socket }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    function onMessage(msg) {
      setMessages((prev) => [...prev, { ...msg, mine: msg.from === socket.id }]);
    }
    socket.on('chat-message', onMessage);
    return () => socket.off('chat-message', onMessage);
  }, [socket]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit('chat-message', { text: trimmed });
    setText('');
  }

  return (
    <div className="flex flex-col bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden flex-1 min-h-[260px]">
      <div className="px-4 py-3 border-b border-gray-800 text-sm font-medium text-gray-200">
        Chat
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
      >
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-6">
            Say something nice 💬
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words ${
                m.mine
                  ? 'bg-indigo-500 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={send}
        className="border-t border-gray-800 p-2 flex items-center gap-2"
      >
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-primary text-sm py-2 px-3">
          Send
        </button>
      </form>
    </div>
  );
}
