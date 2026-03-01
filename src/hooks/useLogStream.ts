import { useState, useEffect, useRef, useCallback } from 'react';
import { wsUrl } from '@/utils';

export function useLogStream(processName: string | null) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!processName) { setLines([]); setConnected(false); return; }

    setLines([]);
    setError(null);

    const _logToken = localStorage.getItem('dashboard_token') ?? '';
    const ws = new WebSocket(wsUrl(`/ws/logs?process=${encodeURIComponent(processName)}&token=${encodeURIComponent(_logToken)}`));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'history' || msg.type === 'log') {
          const incoming = (msg.data as string).split('\n').filter(Boolean);
          setLines(prev => {
            const next = msg.type === 'history' ? [...incoming, ...prev] : [...prev, ...incoming];
            return next.slice(-2000);
          });
        } else if (msg.type === 'error') {
          setError(msg.data);
        }
      } catch (e) { /* ignore */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [processName]);

  const clear = useCallback(() => setLines([]), []);

  return { lines, connected, error, clear };
}
