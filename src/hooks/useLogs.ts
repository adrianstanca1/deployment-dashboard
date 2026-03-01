import { useState, useEffect, useCallback } from 'react';
import { pm2API } from '@/api';

interface UseLogsOptions {
  processName: string | null;
  refreshInterval?: number;
  maxLines?: number;
}

export function useLogs({ processName, refreshInterval = 3000, maxLines = 500 }: UseLogsOptions) {
  const [rawLogs, setRawLogs] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!processName) {
      setRawLogs('');
      return;
    }
    try {
      setIsLoading(true);
      const response = await pm2API.getLogs(processName);
      if (response.success && response.data) {
        setRawLogs(response.data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  }, [processName, maxLines]);

  useEffect(() => {
    fetchLogs();
    if (processName && refreshInterval > 0) {
      const interval = setInterval(fetchLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [processName, refreshInterval, fetchLogs]);

  const lines = rawLogs.split('\n').filter(Boolean);
  const filteredLines = filter
    ? lines.filter(l => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  const downloadLogs = useCallback(() => {
    const blob = new Blob([rawLogs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${processName ?? 'logs'}-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rawLogs, processName]);

  return {
    lines: filteredLines,
    allLines: lines,
    isLoading,
    error,
    filter,
    setFilter,
    isAutoScroll,
    setIsAutoScroll,
    refreshLogs: fetchLogs,
    downloadLogs,
    totalLines: lines.length,
    filteredCount: filteredLines.length,
  };
}
