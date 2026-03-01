import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Notification } from '@/hooks/useNotifications';

interface Props {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

function getMuted() {
  try { return !!JSON.parse(localStorage.getItem('dashboard_prefs') || '{}').muteNotifications; } catch { return false; }
}
function setMuted(v: boolean) {
  try {
    const p = JSON.parse(localStorage.getItem('dashboard_prefs') || '{}');
    localStorage.setItem('dashboard_prefs', JSON.stringify({ ...p, muteNotifications: v }));
  } catch {}
}

const icons = {
  success: <CheckCircle size={15} className="text-green-400 shrink-0" />,
  error:   <XCircle size={15} className="text-red-400 shrink-0" />,
  warning: <AlertTriangle size={15} className="text-yellow-400 shrink-0" />,
  info:    <Info size={15} className="text-blue-400 shrink-0" />,
};

const borders = {
  success: 'border-green-500/30',
  error:   'border-red-500/30',
  warning: 'border-yellow-500/30',
  info:    'border-blue-500/30',
};

export default function NotificationToast({ notifications, onDismiss }: Props) {
  const [muted, setMutedState] = useState(getMuted);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  // Sync if changed externally (e.g. from AISettings)
  useEffect(() => {
    const check = () => setMutedState(getMuted());
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  if (notifications.length === 0 && !muted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {/* Mute toggle — always visible when there are notifications or when muted */}
      <div className="flex justify-end pointer-events-auto">
        <button
          onClick={toggleMute}
          title={muted ? 'Notifications muted — click to unmute' : 'Mute notifications'}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow transition-colors ${
            muted
              ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
              : 'border-dark-700 bg-dark-900/90 text-dark-400 hover:text-dark-200 hover:bg-dark-800'
          }`}
        >
          {muted ? <BellOff size={12} /> : <Bell size={12} />}
          {muted ? 'Muted' : 'Mute'}
        </button>
      </div>
      {notifications.map(n => (
        <div
          key={n.id}
          className={`flex items-start gap-3 p-3 rounded-xl border bg-dark-900/95 backdrop-blur-sm shadow-2xl pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200 ${borders[n.type]}`}
          style={{ animation: 'slideIn 0.2s ease-out' }}
        >
          {icons[n.type]}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-dark-100">{n.title}</div>
            {n.message && <div className="text-xs text-dark-400 mt-0.5 line-clamp-2">{n.message}</div>}
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            className="text-dark-600 hover:text-dark-300 transition-colors shrink-0 mt-0.5"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
