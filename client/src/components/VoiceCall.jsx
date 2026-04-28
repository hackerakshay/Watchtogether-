import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';

export default function VoiceCall({ socket, partnerId, iAmInitiator }) {
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!partnerId) return;
      setError('');
      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = stream;
        }

        // Apply current mute state
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = !muted;
        });

        if (iAmInitiator) {
          // Initiator immediately creates the offering peer.
          createPeer({ initiator: true });
        }
        // The non-initiator waits for an incoming signal — created in onSignal.
      } catch (e) {
        setError(e.message || 'Microphone access denied');
      }
    }

    start();

    return () => {
      cancelled = true;
      destroyPeer();
      // Stop the mic when leaving / partner gone
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      setConnected(false);
    };
    // We intentionally re-run when partnerId changes so we re-establish the call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, iAmInitiator]);

  useEffect(() => {
    function onSignal({ from, signal }) {
      if (!partnerId || from !== partnerId) return;
      if (!peerRef.current) {
        // We are the answering side
        createPeer({ initiator: false });
      }
      try {
        peerRef.current.signal(signal);
      } catch (e) {
        console.error('voice-signal error', e);
      }
    }
    socket.on('voice-signal', onSignal);
    return () => socket.off('voice-signal', onSignal);
  }, [partnerId, socket]);

  function createPeer({ initiator }) {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: localStreamRef.current || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      if (!partnerId) return;
      socket.emit('voice-signal', { to: partnerId, signal });
    });

    peer.on('stream', (incoming) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = incoming;
        const p = remoteAudioRef.current.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    });

    peer.on('connect', () => setConnected(true));
    peer.on('close', () => setConnected(false));
    peer.on('error', (err) => {
      console.error('voice peer error', err);
      setError(err.message || 'Voice connection error');
    });

    peerRef.current = peer;
    return peer;
  }

  function destroyPeer() {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch {
        // ignore
      }
      peerRef.current = null;
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
    }
  }

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">Voice</span>
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-gray-500'
            }`}
            aria-label={connected ? 'voice connected' : 'voice not connected'}
          />
        </div>
        <span className="text-xs text-gray-500">
          {partnerId ? (connected ? 'Live' : 'Connecting…') : 'Waiting…'}
        </span>
      </div>

      <button
        className={muted ? 'btn-danger w-full' : 'btn-secondary w-full'}
        onClick={toggleMute}
        disabled={!partnerId}
      >
        {muted ? '🔇 Unmute' : '🎙️ Mute'}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      {/* Hidden audio element plays the partner's voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}
