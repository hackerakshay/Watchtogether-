import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket } from '../socket.js';
import ScreenShare from '../components/ScreenShare.jsx';
import VoiceCall from '../components/VoiceCall.jsx';
import Chat from '../components/Chat.jsx';

export default function Room() {
  const { roomId } = useParams();
  const socket = useMemo(() => getSocket(), []);

  const [partnerId, setPartnerId] = useState(null);
  const [iAmInitiator, setIAmInitiator] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;

    function joinNow() {
      socket.emit('join-room', { roomId }, (resp) => {
        if (!resp?.ok) {
          alert(resp?.error === 'room-full' ? 'This room is full.' : 'Failed to join room');
          return;
        }
        if (resp.partnerConnected && resp.partnerId) {
          // We are the second person — partner is already there, so partner initiates.
          setPartnerId(resp.partnerId);
          setIAmInitiator(false);
        }
      });
    }

    if (socket.connected) joinNow();
    else socket.once('connect', joinNow);

    function onPartnerJoined({ partnerId: pid }) {
      // We were here first — we are the initiator.
      setPartnerId(pid);
      setIAmInitiator(true);
    }

    function onPartnerPresent({ partnerId: pid }) {
      // We just joined a room with someone already inside — partner initiates.
      setPartnerId(pid);
      setIAmInitiator(false);
    }

    function onPartnerLeft() {
      setPartnerId(null);
      setIAmInitiator(false);
    }

    socket.on('partner-joined', onPartnerJoined);
    socket.on('partner-present', onPartnerPresent);
    socket.on('partner-left', onPartnerLeft);

    return () => {
      socket.off('partner-joined', onPartnerJoined);
      socket.off('partner-present', onPartnerPresent);
      socket.off('partner-left', onPartnerLeft);
    };
  }, [roomId, socket]);

  function copyLink() {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg md:text-xl font-semibold whitespace-nowrap">
            🎬 WatchTogether
          </span>
          <span className="hidden md:inline text-gray-500">•</span>
          <span className="text-sm text-gray-400 truncate">
            Room: <span className="font-mono text-gray-200">{roomId}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <span className="flex items-center gap-2 text-sm text-gray-300">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                partnerId ? 'bg-green-500' : 'bg-gray-500'
              }`}
              aria-label={partnerId ? 'partner connected' : 'waiting for partner'}
            />
            <span className="hidden sm:inline">
              {partnerId ? 'Partner connected' : 'Waiting for partner…'}
            </span>
          </span>

          <button className="btn-secondary text-sm py-1.5" onClick={copyLink}>
            {copied ? 'Copied! ✓' : 'Copy Link'}
          </button>

          <button
            className="btn-secondary text-sm py-1.5 md:hidden"
            onClick={() => setChatOpen((v) => !v)}
          >
            {chatOpen ? 'Close chat' : 'Chat'}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6">
        {/* Video area */}
        <section className="flex-1 min-w-0 flex flex-col">
          <ScreenShare
            socket={socket}
            partnerId={partnerId}
            iAmInitiator={iAmInitiator}
          />
        </section>

        {/* Sidebar */}
        <aside
          className={`md:w-80 lg:w-96 md:flex md:flex-col gap-4 ${
            chatOpen ? 'flex flex-col' : 'hidden'
          }`}
        >
          <VoiceCall
            socket={socket}
            partnerId={partnerId}
            iAmInitiator={iAmInitiator}
          />
          <Chat socket={socket} />
        </aside>
      </main>
    </div>
  );
}
