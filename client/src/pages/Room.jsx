import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket } from '../socket.js';
import ScreenShare from '../components/ScreenShare.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import VoiceCall from '../components/VoiceCall.jsx';
import Chat from '../components/Chat.jsx';
import Reactions from '../components/Reactions.jsx';
import Toast from '../components/Toast.jsx';

// Module-level so StrictMode's cleanup-then-remount in dev doesn't
// trigger an unnecessary leave/rejoin cycle. The next mount cancels
// the pending leave timer.
let pendingLeaveTimer = null;

export default function Room() {
  const { roomId } = useParams();
  const socket = useMemo(() => getSocket(), []);

  const [partnerId, setPartnerId] = useState(null);
  const [iAmInitiator, setIAmInitiator] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mode, setMode] = useState('screen'); // 'screen' | 'url'
  const [toasts, setToasts] = useState([]);
  const joinedRef = useRef(false);
  const everConnectedRef = useRef(false);

  const pushToast = useCallback((toast) => {
    setToasts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...toast }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    // Listeners must (re)attach on every mount. Previously this whole effect
    // bailed out early on the second StrictMode mount, leaving the socket
    // singleton with NO partner-* listeners — so the live `partner-joined`
    // event from a second tab joining was silently dropped on the existing
    // tab. Only the `join-room` emit needs the once-guard.
    function onPartnerJoined({ partnerId: pid }) {
      setPartnerId(pid);
      setIAmInitiator(true);
      pushToast({
        text: everConnectedRef.current ? 'Partner reconnected!' : 'Partner joined!',
        variant: 'success',
      });
      everConnectedRef.current = true;
    }

    function onPartnerPresent({ partnerId: pid }) {
      setPartnerId(pid);
      setIAmInitiator(false);
      everConnectedRef.current = true;
    }

    function onPartnerLeft() {
      setPartnerId(null);
      setIAmInitiator(false);
      pushToast({ text: 'Partner left the room', variant: 'error' });
    }

    socket.on('partner-joined', onPartnerJoined);
    socket.on('partner-present', onPartnerPresent);
    socket.on('partner-left', onPartnerLeft);

    // Cancel any pending leave-room from a previous unmount. This
    // typically fires during StrictMode's cleanup→remount cycle in dev.
    if (pendingLeaveTimer) {
      clearTimeout(pendingLeaveTimer);
      pendingLeaveTimer = null;
    }

    function joinNow() {
      socket.emit('join-room', { roomId }, (resp) => {
        if (!resp?.ok) {
          pushToast({
            text: resp?.error === 'room-full' ? 'This room is full.' : 'Failed to join room',
            variant: 'error',
            duration: 4000,
          });
          return;
        }
        if (resp.partnerConnected && resp.partnerId) {
          setPartnerId(resp.partnerId);
          setIAmInitiator(false);
          everConnectedRef.current = true;
        }
      });
    }

    let pendingConnect = null;
    if (!joinedRef.current) {
      joinedRef.current = true;
      if (socket.connected) joinNow();
      else {
        pendingConnect = joinNow;
        socket.once('connect', joinNow);
      }
    }

    return () => {
      socket.off('partner-joined', onPartnerJoined);
      socket.off('partner-present', onPartnerPresent);
      socket.off('partner-left', onPartnerLeft);
      if (pendingConnect) socket.off('connect', pendingConnect);

      // Schedule a leave-room. If the component remounts within ~80ms
      // (StrictMode), the next mount cancels this and the leave never fires.
      // Real navigation away (router unmount, tab close) lets it fire so the
      // server doesn't keep us as a phantom member of a 2-person room.
      if (pendingLeaveTimer) clearTimeout(pendingLeaveTimer);
      pendingLeaveTimer = setTimeout(() => {
        pendingLeaveTimer = null;
        joinedRef.current = false;
        try {
          socket.emit('leave-room');
        } catch {
          // ignore
        }
      }, 80);
    };
  }, [pushToast, roomId, socket]);

  function copyLink() {
    const url = window.location.href;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <Toast toasts={toasts} onDismiss={dismissToast} />

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

      {/* Mode toggle */}
      <div className="px-4 md:px-6 pt-4">
        <div className="inline-flex rounded-xl bg-gray-900 border border-gray-800 p-1 text-sm">
          <button
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              mode === 'screen' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:text-white'
            }`}
            onClick={() => setMode('screen')}
          >
            Screen Share
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              mode === 'url' ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:text-white'
            }`}
            onClick={() => setMode('url')}
          >
            URL Mode
          </button>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6">
        {/* Video area */}
        <section className="flex-1 min-w-0 flex flex-col">
          {mode === 'screen' ? (
            <ScreenShare
              socket={socket}
              partnerId={partnerId}
              iAmInitiator={iAmInitiator}
            />
          ) : (
            <VideoPlayer socket={socket} partnerId={partnerId} />
          )}
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
          <Reactions socket={socket} />
          <Chat socket={socket} />
        </aside>
      </main>
    </div>
  );
}
