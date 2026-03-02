import React, { useState, useMemo, useCallback } from 'react';
import {
  RotateCw, Square, Trash2, Play, RefreshCw, Search,
  ChevronDown, ChevronUp, AlertCircle, CheckSquare, Square as SquareIcon,
  Save, X, Loader2, PlayCircle, StopCircle,
} from 'lucide-react';
import { usePM2 } from '@/hooks/usePM2';
import { VirtualList } from '@/components/VirtualList';
import StatusBadge from '@/components/StatusBadge';
import { formatBytes, formatUptime } from '@/utils';
import type { PM2Process } from '@/types';

const ROW_HEIGHT = 56; // Height of each process row in pixels

export default function PM2Page() {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    processes,
    isLoading,
    refetch,
    selectedNames,
    selectedCount,
    hasSelection,
    isSelected,
    toggleSelection,
    clearSelection,
    selectAll,
    isPending,
    start,
    stop,
    restart,
    delete: deleteProcess,
    bulk,
    restartErrored,
    save,
  } = usePM2();

  const filtered = useMemo(() =>
    processes.filter(p => (p.name ?? '').toLowerCase().includes(search.toLowerCase())),
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

  const handleToggleAll = () => {
    if (selectedCount === filtered.length && filtered.length > 0) {
      clearSelection();
    } else {
      selectAll(filtered.map(p => p.name));
    }
  };

  const handleBulkStart = () => {
    if (selectedCount === 0) return;
    bulk.mutate({ action: 'start', names: selectedNames });
  };

  const handleBulkStop = () => {
    if (selectedCount === 0) return;
    bulk.mutate({ action: 'stop', names: selectedNames });
  };

  const handleBulkRestart = () => {
    if (selectedCount === 0) return;
    bulk.mutate({ action: 'restart', names: selectedNames });
  };

  const handleBulkDelete = () => {
    if (selectedCount === 0) return;
    if (confirm(`Delete ${selectedCount} processes?`)) {
      bulk.mutate({ action: 'delete', names: selectedNames });
    }
  };

  // Render function for virtual list
  const renderProcessRow = useCallback((p: PM2Process) => {
    const isSel = isSelected(p.name);
    const isPen = isPending(p.name);
    const isExpanded = expandedId === p.pm_id;

    return (
      <div
        className={`border-b border-dark-800 last:border-0 hover:bg-dark-800/30 cursor-pointer transition-colors ${isSel ? 'bg-primary-600/5' : ''} ${isPen ? 'opacity-70' : ''}`}
        style={{ height: ROW_HEIGHT }}
        onClick={() => setExpandedId(isExpanded ? null : p.pm_id)}
      >
        <div className="flex items-center h-full px-2">
          {/* Checkbox */}
          <div className="w-10 flex-shrink-0" onClick={e => { e.stopPropagation(); toggleSelection(p.name); }}>
            <button
              className={`transition-colors ${isSel ? 'text-primary-400' : 'text-dark-500 hover:text-dark-300'}`}
              disabled={isPen}
            >
              {isSel ? <CheckSquare size={14} /> : <SquareIcon size={14} />}
            </button>
          </div>

          {/* ID */}
          <div className="w-12 flex-shrink-0 text-dark-600 text-xs">{p.pm_id}</div>

          {/* Name */}
          <div className="w-40 flex-shrink-0 px-2">
            <span className="font-mono text-xs text-dark-200 flex items-center gap-2">
              {p.name}
              {isPen && <Loader2 size={12} className="animate-spin text-primary-400" />}
            </span>
          </div>

          {/* Status */}
          <div className="w-24 flex-shrink-0 px-2">
            <StatusBadge status={p.status} />
          </div>

          {/* CPU */}
          <div className="w-16 flex-shrink-0 hidden sm:block px-2 text-dark-400 text-xs">{p.monit?.cpu ?? 0}%</div>

          {/* Memory */}
          <div className="w-24 flex-shrink-0 hidden sm:block px-2 text-dark-400 text-xs">{formatBytes(p.monit?.memory ?? 0)}</div>

          {/* Restarts */}
          <div className="w-16 flex-shrink-0 hidden md:block px-2 text-dark-400 text-xs">{p.pm2_env?.restart_time ?? 0}</div>

          {/* Port */}
          <div className="w-16 flex-shrink-0 hidden md:block px-2 text-dark-400 text-xs font-mono">{p.pm2_env?.env?.PORT ?? '—'}</div>

          {/* Uptime */}
          <div className="w-24 flex-shrink-0 hidden lg:block px-2 text-dark-400 text-xs">{formatUptime((p.pm2_env?.pm_uptime ?? 0) / 1000)}</div>

          {/* Actions */}
          <div className="flex-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            {p.status !== 'online' && !isPen && (
              <button
                onClick={() => start.mutate(p.name)}
                disabled={start.isPending}
                className="p-1.5 rounded text-dark-400 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                title="Start"
              >
                <Play size={12} />
              </button>
            )}
            {!isPen && (
              <button
                onClick={() => restart.mutate(p.name)}
                disabled={restart.isPending}
                className="p-1.5 rounded text-dark-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                title="Restart"
              >
                <RotateCw size={12} />
              </button>
            )}
            {!isPen && (
              <button
                onClick={() => stop.mutate(p.name)}
                disabled={stop.isPending}
                className="p-1.5 rounded text-dark-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                title="Stop"
              >
                <Square size={12} />
              </button>
            )}
            {!isPen && (
              <button
                onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteProcess.mutate(p.name); }}
                disabled={deleteProcess.isPending}
                className="p-1.5 rounded text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            )}
            <span className="text-dark-700 ml-1">{isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</span>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="px-8 py-4 bg-dark-800/20 border-t border-dark-800" onClick={e => e.stopPropagation()}>
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
          </div>
        )}
      </div>
    );
  }, [isSelected, isPending, expandedId, start, restart, stop, deleteProcess, toggleSelection]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dark-100">Runtime Processes</h1>
          <p className="text-sm text-dark-400 mt-0.5">
            {online} online · {errored.length} errored · {processes.length} total PM2-managed processes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {errored.length > 0 && (
            <button
              onClick={() => restartErrored.mutate()}
              disabled={restartErrored.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
            >
              {restartErrored.isPending ? <Loader2 size={13} className="animate-spin" /> : <AlertCircle size={13} />}
              Restart {errored.length} errored
            </button>
          )}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="btn-secondary flex items-center gap-1.5 text-xs disabled:opacity-50"
          >
            {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
          <button
            onClick={() => refetch()}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          type="text"
          placeholder="Filter runtime processes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9 text-sm w-full max-w-md"
        />
      </div>

      {/* Table Header */}
      {isLoading ? (
        <div className="text-center py-12 text-dark-500">Loading runtime processes...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-900 px-4 py-8 text-center text-dark-500">
          No processes found
        </div>
      ) : (
        <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
          {/* Header Row */}
          <div className="flex items-center px-2 py-3 border-b border-dark-700 bg-dark-800/40 text-xs font-medium text-dark-500 flex-shrink-0">
            <div className="w-10 flex-shrink-0">
              <button
                onClick={handleToggleAll}
                className="text-dark-500 hover:text-dark-300 transition-colors"
              >
                {selectedCount === filtered.length && filtered.length > 0
                  ? <CheckSquare size={14} className="text-primary-400" />
                  : <SquareIcon size={14} />
                }
              </button>
            </div>
            <div className="w-12 flex-shrink-0">ID</div>
            <div className="w-40 flex-shrink-0 px-2">Name</div>
            <div className="w-24 flex-shrink-0 px-2">Status</div>
            <div className="w-16 flex-shrink-0 hidden sm:block px-2">CPU</div>
            <div className="w-24 flex-shrink-0 hidden sm:block px-2">Memory</div>
            <div className="w-16 flex-shrink-0 hidden md:block px-2">Restarts</div>
            <div className="w-16 flex-shrink-0 hidden md:block px-2">Port</div>
            <div className="w-24 flex-shrink-0 hidden lg:block px-2">Uptime</div>
            <div className="flex-1 text-right px-2">Actions</div>
          </div>

          {/* Virtual List */}
          <div className="flex-1 overflow-hidden">
            <VirtualList
              items={filtered}
              renderItem={renderProcessRow}
              estimateSize={ROW_HEIGHT}
              overscan={5}
            />
          </div>
        </div>
      )}

      {/* Floating Bulk Action Toolbar */}
      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-800 border border-dark-600 shadow-xl shadow-black/50">
            <div className="flex items-center gap-2 pr-3 border-r border-dark-600">
              <span className="text-sm font-medium text-dark-200">{selectedCount}</span>
              <span className="text-xs text-dark-400">selected</span>
              <button
                onClick={clearSelection}
                className="ml-2 p-1 rounded hover:bg-dark-700 text-dark-400 hover:text-dark-200 transition-colors"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Start Button */}
              <button
                onClick={handleBulkStart}
                disabled={bulk.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-colors disabled:opacity-50"
              >
                {bulk.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                Start
              </button>

              {/* Stop Button */}
              <button
                onClick={handleBulkStop}
                disabled={bulk.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 transition-colors disabled:opacity-50"
              >
                {bulk.isPending ? <Loader2 size={12} className="animate-spin" /> : <StopCircle size={12} />}
                Stop
              </button>

              {/* Restart Button */}
              <button
                onClick={handleBulkRestart}
                disabled={bulk.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors disabled:opacity-50"
              >
                {bulk.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                Restart
              </button>

              {/* Delete Button */}
              <button
                onClick={handleBulkDelete}
                disabled={bulk.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
              >
                {bulk.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
