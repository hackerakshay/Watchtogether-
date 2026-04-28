import { useEffect, useRef, useState } from 'react';

const SEEK_THRESHOLD = 0.4; // seconds — ignore tiny drift

export default function VideoPlayer({ socket, partnerId }) {
  const [url, setUrl] = useState('');
  const [pendingUrl, setPendingUrl] = useState('');
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  // Set to true while applying a remote action so our own play/pause/seek
  // listeners do NOT echo the event back to the partner.
  const isRemoteActionRef = useRef(false);

  // Receive sync events from partner
  useEffect(() => {
    function onSync({ from, type, currentTime, url: incomingUrl }) {
      if (partnerId && from !== partnerId) return;
      const v = videoRef.current;

      if (type === 'url-changed' && incomingUrl) {
        setError('');
        setUrl(incomingUrl);
        setPendingUrl(incomingUrl);
        return;
      }

      if (!v) return;
      isRemoteActionRef.current = true;
      try {
        if (typeof currentTime === 'number' && Math.abs(v.currentTime - currentTime) > SEEK_THRESHOLD) {
          v.currentTime = currentTime;
        }
        if (type === 'play') {
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } else if (type === 'pause') {
          v.pause();
        }
      } finally {
        // Allow a short window for the browser to fire the resulting
        // play/pause event before we re-enable emitting.
        setTimeout(() => {
          isRemoteActionRef.current = false;
        }, 80);
      }
    }

    socket.on('sync-event', onSync);
    return () => socket.off('sync-event', onSync);
  }, [partnerId, socket]);

  function emit(type, extra = {}) {
    if (isRemoteActionRef.current) return;
    const v = videoRef.current;
    socket.emit('sync-event', {
      type,
      currentTime: v ? v.currentTime : 0,
      ...extra,
    });
  }

  function loadUrl(e) {
    e.preventDefault();
    const next = pendingUrl.trim();
    if (!next) return;
    setError('');
    setUrl(next);
    socket.emit('sync-event', { type: 'url-changed', url: next, currentTime: 0 });
  }

  return (
    <div className="flex-1 flex flex-col">
      <form onSubmit={loadUrl} className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          className="input flex-1"
          placeholder="Paste a direct video URL (.mp4, .m3u8, .webm)"
          value={pendingUrl}
          onChange={(e) => setPendingUrl(e.target.value)}
        />
        <button type="submit" className="btn-primary sm:w-auto" disabled={!pendingUrl.trim()}>
          Load video
        </button>
      </form>

      <div className="relative flex-1 min-h-[260px] md:min-h-[420px] bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {url ? (
          <video
            ref={videoRef}
            src={url}
            className="w-full h-full object-contain bg-black"
            controls
            playsInline
            onPlay={() => emit('play')}
            onPause={() => emit('pause')}
            onSeeked={() => emit('seek')}
            onError={() => setError('Could not load video. Try a direct .mp4 link or check CORS.')}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="text-6xl mb-4 animate-pulse-soft" aria-hidden>
              🎞️
            </div>
            <p className="text-lg font-medium text-gray-200">
              Paste a direct video URL above
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Both of you will load the same video. Play / pause / seek stays in sync.
            </p>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {!partnerId && url && (
        <p className="mt-3 text-xs text-amber-400">
          Waiting for partner to join — sync starts when they're connected.
        </p>
      )}
    </div>
  );
}
