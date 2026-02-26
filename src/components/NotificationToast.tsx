import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Notification } from '@/hooks/useNotifications';

interface Props {
  notifications: Notification[];
  onDismiss: (id: string) => void;
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
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
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
