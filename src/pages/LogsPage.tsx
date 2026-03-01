import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { pm2API } from '@/api';
import { useLogStream } from '@/hooks/useLogStream';
import { Download, Search, ChevronDown, Wifi, WifiOff, Trash2 } from 'lucide-react';

function getLineColor(line: string): string {
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('err') || l.includes('fatal') || l.includes('critical')) return 'text-red-400';
  if (l.includes('warn') || l.includes('warning')) return 'text-yellow-400/90';
  if (l.includes('info') || l.includes('started') || l.includes('ready') || l.includes('listening')) return 'text-blue-400/90';
  if (l.includes('debug') || l.includes('verbose')) return 'text-dark-500';
  return 'text-dark-300';
}

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProcess, setSelectedProcess] = useState(searchParams.get('process') ?? '');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const { lines, connected, error, clear } = useLogStream(selectedProcess || null);

  const { data: processList } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 30000,
  });

  const processes = processList?.data ?? [];

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines.length, autoScroll]);

  const filtered = search
    ? lines.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  const handleProcessChange = (name: string) => {
    setSelectedProcess(name);
    setSearchParams(name ? { process: name } : {});
    clear();
  };

  const downloadLogs = () => {
    const blob = new Blob([filtered.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProcess || 'logs'}-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col p-6 h-full max-w-7xl mx-auto gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-dark-100">Live Logs</h1>
          <p className="text-sm text-dark-400 mt-0.5 flex items-center gap-2">
            {selectedProcess ? (
              <>
                {connected
                  ? <><Wifi size={11} className="text-green-400"/><span className="text-green-400">Streaming</span></>
                  : <><WifiOff size={11} className="text-red-400"/><span className="text-red-400">Disconnected</span></>
                }
                <span className="text-dark-600">·</span>
                <span>{filtered.length} lines</span>
              </>
            ) : (
              'Select a process to stream logs'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clear} disabled={!selectedProcess} className="btn-secondary flex items-center gap-2 text-sm">
            <Trash2 size={13} /> Clear
          </button>
          <button onClick={downloadLogs} disabled={!selectedProcess || filtered.length === 0} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={13} /> Download
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 shrink-0 flex-wrap">
        <div className="relative min-w-[240px]">
          <select
            value={selectedProcess}
            onChange={e => handleProcessChange(e.target.value)}
            className="input-field text-sm appearance-none pr-8"
          >
            <option value="">Select a process...</option>
            {processes.map(p => (
              <option key={p.pm_id} value={p.name}>{p.name}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-8 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer select-none">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="rounded" />
          Auto-scroll
        </label>
      </div>

      {/* Log output */}
      <div
        ref={logRef}
        className="flex-1 rounded-xl border border-dark-700 bg-dark-950 overflow-auto font-mono text-xs"
        style={{ minHeight: '400px' }}
      >
        {error && (
          <div className="flex items-center justify-center h-32 text-red-400">{error}</div>
        )}
        {!selectedProcess && !error && (
          <div className="flex items-center justify-center h-full text-dark-600">
            Select a process to stream logs
          </div>
        )}
        {selectedProcess && !error && filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-dark-600">
            {connected ? 'Waiting for logs...' : 'Connecting...'}
          </div>
        )}
        {filtered.map((line, i) => (
          <div key={i} className={`px-4 py-px hover:bg-dark-900/50 leading-5 ${getLineColor(line)}`}>
            <span className="text-dark-700 mr-4 select-none">{String(i + 1).padStart(5, ' ')}</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
