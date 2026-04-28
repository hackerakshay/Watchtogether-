import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';

export default function ScreenShare({ socket, partnerId, iAmInitiator }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState('');
  const [partnerSharing, setPartnerSharing] = useState(false);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Keep refs in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Attach local preview
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  // Attach remote video
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
      if (remoteStream) {
        // Ensure playback starts in browsers that require an explicit call
        const p = remoteVideoRef.current.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    }
  }, [remoteStream]);

  // Unmount cleanup: stop local tracks, destroy peer, notify partner.
  // Otherwise switching to URL Mode while sharing leaks the MediaStream
  // (browser keeps the recording indicator on with no UI to stop it).
  // IMPORTANT: only emit `screen-share-stopped` if we were ACTUALLY sharing
  // (localStreamRef set). Emitting unconditionally would tear down the
  // partner's outgoing share peer when we were merely a viewer.
  useEffect(() => {
    return () => {
      const wasSharing = !!localStreamRef.current;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch {
          // ignore
        }
        peerRef.current = null;
      }
      if (wasSharing) {
        try {
          socket.emit('screen-share-stopped');
        } catch {
          // ignore
        }
      }
    };
  }, [socket]);

  // Tear down when partner leaves
  useEffect(() => {
    if (!partnerId) {
      destroyPeer();
      setRemoteStream(null);
      setPartnerSharing(false);
    }
  }, [partnerId]);

  // Socket signal handler
  useEffect(() => {
    function onSignal({ from, signal }) {
      if (!partnerId || from !== partnerId) return;

      if (!peerRef.current) {
        // We are the receiver — create a non-initiator peer
        const peer = createPeer({ initiator: false, stream: localStreamRef.current });
        peerRef.current = peer;
      }
      try {
        peerRef.current.signal(signal);
      } catch (e) {
        console.error('screen-signal error', e);
      }
    }

    function onPartnerStopped() {
      setRemoteStream(null);
      setPartnerSharing(false);
      destroyPeer();
    }

    socket.on('screen-signal', onSignal);
    socket.on('screen-share-stopped', onPartnerStopped);
    return () => {
      socket.off('screen-signal', onSignal);
      socket.off('screen-share-stopped', onPartnerStopped);
    };
  }, [partnerId, socket]);

  function createPeer({ initiator, stream }) {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      if (!partnerId) return;
      socket.emit('screen-signal', { to: partnerId, signal });
    });

    peer.on('stream', (incoming) => {
      setRemoteStream(incoming);
      setPartnerSharing(true);
    });

    peer.on('error', (err) => {
      console.error('screen peer error', err);
      setError(err.message || 'Peer connection error');
    });

    peer.on('close', () => {
      // do not auto-destroy here; let outer logic decide
    });

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

  async function startSharing() {
    setError('');
    if (!partnerId) {
      setError('Wait for your partner to join before sharing.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
    } catch (e) {
      if (e?.name !== 'NotAllowedError') {
        setError(e.message || 'Could not start screen share');
      }
      return;
    }

    setLocalStream(stream);
    localStreamRef.current = stream;

    // End sharing if user stops via browser UI
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stopSharing();
      });
    });

    // Always (re)create peer as initiator with the new stream
    destroyPeer();
    const peer = createPeer({ initiator: true, stream });
    peerRef.current = peer;
  }

  function stopSharing() {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    localStreamRef.current = null;
    destroyPeer();
    if (partnerId) {
      socket.emit('screen-share-stopped');
    }
  }

  const isSharingLocally = !!localStream;
  const showRemote = !!remoteStream && !isSharingLocally;

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative flex-1 min-h-[260px] md:min-h-[420px] bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Remote stream */}
        <video
          ref={remoteVideoRef}
          className={`w-full h-full object-contain bg-black ${
            showRemote ? '' : 'hidden'
          }`}
          autoPlay
          playsInline
        />

        {/* Local preview */}
        <video
          ref={localVideoRef}
          className={`w-full h-full object-contain bg-black ${
            isSharingLocally ? '' : 'hidden'
          }`}
          autoPlay
          playsInline
          muted
        />

        {/* Placeholder */}
        {!showRemote && !isSharingLocally && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="text-6xl mb-4 animate-pulse-soft" aria-hidden>
              🎬
            </div>
            <p className="text-lg font-medium text-gray-200">
              {partnerId
                ? 'Waiting for screen share…'
                : 'Waiting for your partner to join…'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Click <span className="text-indigo-400">Share Screen</span> to start a watch party.
            </p>
          </div>
        )}

        {isSharingLocally && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 text-xs text-white border border-white/10">
            You are sharing
          </div>
        )}
        {showRemote && partnerSharing && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 text-xs text-white border border-white/10">
            Partner is sharing
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {!isSharingLocally ? (
          <button
            className="btn-primary"
            onClick={startSharing}
            disabled={!partnerId}
            title={!partnerId ? 'Wait for your partner to join' : undefined}
          >
            Share Screen
          </button>
        ) : (
          <button className="btn-danger" onClick={stopSharing}>
            Stop Sharing
          </button>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
