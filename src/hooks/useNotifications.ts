import { useState, useCallback, useRef } from 'react';

export function isMuted(): boolean {
  try {
    const p = JSON.parse(localStorage.getItem('dashboard_prefs') || '{}');
    return !!p.muteNotifications;
  } catch { return false; }
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications(n => n.filter(x => x.id !== id));
    const t = timeouts.current.get(id);
    if (t) { clearTimeout(t); timeouts.current.delete(id); }
  }, []);

  const notify = useCallback((notification: Omit<Notification, 'id'>) => {
    if (isMuted()) return '';
    const id = Math.random().toString(36).slice(2);
    const duration = notification.duration ?? 4500;
    setNotifications(n => [{ ...notification, id }, ...n].slice(0, 6));
    if (duration > 0) {
      const t = setTimeout(() => dismiss(id), duration);
      timeouts.current.set(id, t);
    }
    return id;
  }, [dismiss]);

  return { notifications, notify, dismiss };
}
