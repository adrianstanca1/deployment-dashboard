import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCw, Square, Trash2, Play, RefreshCw, Search,
  ChevronDown, ChevronUp, AlertCircle, CheckSquare, Square as SquareIcon,
  Save, Zap, Loader2,
} from 'lucide-react';
import { pm2API } from '@/api';
import StatusBadge from '@/components/StatusBadge';
import { formatBytes, formatUptime } from '@/utils';
import type { PM2Process } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';

export default function PM2Page() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { notify } = useNotifications();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 5000,
  });

  const mutOpts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pm2-list'] }),
    onError: (error: Error) => notify({ type: 'error', title: 'Error', message: error.message || 'Operation failed' }),
  };

  const restart = useMutation({ mutationFn: (name: string) => pm2API.restart(name), ...mutOpts });
  const stop    = useMutation({ mutationFn: (name: string) => pm2API.stop(name), ...mutOpts });
  const start   = useMutation({ mutationFn: (name: string) => pm2API.start(name), ...mutOpts });
  const del     = useMutation({ mutationFn: (name: string) => pm2API.delete(name), ...mutOpts });

  const bulk = useMutation({
    mutationFn: async ({ action, names }: { action: string; names: string[] }) => {
      const res = await fetch('/api/pm2/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, names }),
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pm2-list'] }); setSelected(new Set()); },
    onError: (error: Error) => notify({ type: 'error', title: 'Error', message: error.message || 'Bulk operation failed' }),
  });

  const restartErrored = useMutation({
    mutationFn: () => fetch('/api/pm2/restart-errored', { method: 'POST' }).then(r => r.json()),
    ...mutOpts,
  });

  const save = useMutation({
    mutationFn: () => pm2API.save(),
    onSuccess: () => {},
  });

  const processes: PM2Process[] = data?.data ?? [];

  const filtered = useMemo(() =>
    processes.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [processes, search]
  );

  const errored = useMemo(() =>
    processes.filter(p => p.status === 'errored'),
    [processes]
  );

  const online = useMemo(() =>
    processes.filter(p => p.status === 'online').length,
    [processes]
  );

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.name)));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dark-100">PM2 Processes</h1>
          <p className="text-sm text-dark-400 mt-0.5">
            {online} online · {errored.length} errored · {processes.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {errored.length > 0 && (
            <button
              onClick={() => restartErrored.mutate()}
              disabled={restartErrored.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
            >
              <AlertCircle size={13} />
              Restart {errored.length} errored
            </button>
          )}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <Save size={13} />
            Save
          </button>
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-1.5 text-xs">
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search + bulk toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            placeholder="Filter processes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-400">{selected.size} selected</span>
            <button onClick={() => bulk.mutate({ action: 'restart', names: [...selected] })} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
              <RotateCw size={12} /> Restart
            </button>
            <button onClick={() => bulk.mutate({ action: 'stop', names: [...selected] })} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors">
              <Square size={12} /> Stop
            </button>
            <button
              onClick={() => { if (confirm(`Delete ${selected.size} processes?`)) bulk.mutate({ action: 'delete', names: [...selected] }); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-dark-500">Loading processes...</div>
      ) : (
        <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 bg-dark-800/40">
                <th className="px-4 py-3 w-8">
                  <button onClick={toggleAll} className="text-dark-500 hover:text-dark-300">
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare size={14} className="text-primary-400" />
                      : <SquareIcon size={14} />
                    }
                  </button>
                </th>
                <th className="text-left text-xs text-dark-500 font-medium px-2 py-3">ID</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-3">Name</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-3">Status</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-3 hidden sm:table-cell">CPU</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-3 hidden sm:table-cell">Memory</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-3 hidden md:table-cell">Restarts</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-3 hidden md:table-cell">Port</th>
                <th className="text-left text-xs text-dark-500 font-medium px-4 py-3 hidden lg:table-cell">Uptime</th>
                <th className="text-right text-xs text-dark-500 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isSel = selected.has(p.name);
                return (
                  <React.Fragment key={p.pm_id}>
                    <tr
                      className={`border-b border-dark-800 last:border-0 hover:bg-dark-800/30 cursor-pointer transition-colors ${isSel ? 'bg-primary-600/5' : ''}`}
                      onClick={() => setExpandedId(expandedId === p.pm_id ? null : p.pm_id)}
                    >
                      <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(p.name); }}>
                        <button className={`text-dark-500 hover:text-primary-400 transition-colors ${isSel ? 'text-primary-400' : ''}`}>
                          {isSel ? <CheckSquare size={14} /> : <SquareIcon size={14} />}
                        </button>
                      </td>
                      <td className="px-2 py-3 text-dark-600 text-xs">{p.pm_id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-dark-200">{p.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-dark-400 hidden sm:table-cell text-xs">{p.monit?.cpu ?? 0}%</td>
                      <td className="px-4 py-3 text-dark-400 hidden sm:table-cell text-xs">{formatBytes(p.monit?.memory ?? 0)}</td>
                      <td className="px-4 py-3 text-dark-400 hidden md:table-cell text-xs">{p.pm2_env?.restart_time ?? 0}</td>
                      <td className="px-4 py-3 text-dark-400 hidden md:table-cell text-xs font-mono">{p.pm2_env?.env?.PORT ?? '—'}</td>
                      <td className="px-4 py-3 text-dark-400 hidden lg:table-cell text-xs">{formatUptime((p.pm2_env?.pm_uptime ?? 0) / 1000)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {p.status !== 'online' && (
                            <button onClick={() => start.mutate(p.name)} className="p-1.5 rounded text-dark-400 hover:text-green-400 hover:bg-green-500/10" title="Start"><Play size={12} /></button>
                          )}
                          <button onClick={() => restart.mutate(p.name)} className="p-1.5 rounded text-dark-400 hover:text-blue-400 hover:bg-blue-500/10" title="Restart"><RotateCw size={12} /></button>
                          <button onClick={() => stop.mutate(p.name)} className="p-1.5 rounded text-dark-400 hover:text-yellow-400 hover:bg-yellow-500/10" title="Stop"><Square size={12} /></button>
                          <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) del.mutate(p.name); }} className="p-1.5 rounded text-dark-400 hover:text-red-400 hover:bg-red-500/10" title="Delete"><Trash2 size={12} /></button>
                          <span className="text-dark-700">{expandedId === p.pm_id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</span>
                        </div>
                      </td>
                    </tr>
                    {expandedId === p.pm_id && (
                      <tr className="border-b border-dark-800 bg-dark-800/20">
                        <td colSpan={10} className="px-8 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            {[
                              ['PID', p.pid],
                              ['Mode', p.pm2_env?.exec_mode ?? 'fork'],
                              ['Node', p.pm2_env?.node_version ?? '—'],
                              ['PORT', p.pm2_env?.env?.PORT ?? '—'],
                              ['NODE_ENV', p.pm2_env?.env?.NODE_ENV ?? '—'],
                              ['Working Dir', p.pm2_env?.pm_cwd ?? '—'],
                              ['Restarts', p.pm2_env?.restart_time ?? 0],
                              ['Status', p.status],
                            ].map(([label, val]) => (
                              <div key={String(label)}>
                                <span className="text-dark-500">{label}</span>
                                <div className="text-dark-200 font-mono mt-0.5 break-all">{String(val)}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-dark-500">No processes found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
