import { useEffect } from 'react';

export default function Toast({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.duration || 3200);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  const variant =
    toast.variant === 'success'
      ? 'border-green-500/40 bg-green-500/15 text-green-100'
      : toast.variant === 'error'
      ? 'border-red-500/40 bg-red-500/15 text-red-100'
      : 'border-gray-700 bg-gray-900/90 text-gray-100';

  return (
    <div
      className={`pointer-events-auto px-4 py-2 rounded-lg border text-sm shadow-lg backdrop-blur ${variant}`}
    >
      {toast.text}
    </div>
  );
}
