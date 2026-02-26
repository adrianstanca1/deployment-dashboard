import { useState, useEffect, useRef } from 'react';
import { wsUrl } from '@/utils';

export interface StatPoint {
  time: string;
  cpu: number;
  memory: number;
  disk: number;
  [key: string]: string | number;
}

export interface SystemStats {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; free: number; percentage: number };
  disk: { total: number; used: number; free: number; percentage: number };
  uptime: number;
  load: number[];
  timestamp: number;
}

export function useSystemHistory(maxPoints = 60) {
  const [history, setHistory] = useState<StatPoint[]>([]);
  const [current, setCurrent] = useState<SystemStats | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl('/ws/stats'));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onerror = (evt) => {
      console.error('[useSystemHistory] WebSocket error', evt);
      setConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stats' && msg.data) {
          const stats: SystemStats = msg.data;
          setCurrent(stats);
          setHistory(prev => {
            const now = new Date();
            const time = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            const point: StatPoint = {
              time,
              cpu: stats.cpu.usage,
              memory: stats.memory.percentage,
              disk: stats.disk.percentage,
            };
            return [...prev, point].slice(-maxPoints);
          });
        }
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          console.error('[useSystemHistory] Error processing message:', e);
        }
      }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [maxPoints]);

  return { history, current, connected };
}
