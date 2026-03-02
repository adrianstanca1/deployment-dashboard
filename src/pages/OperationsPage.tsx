import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, Search, Filter } from 'lucide-react';
import { operationsAPI, type UnifiedOperation } from '@/api';

const SOURCES = ['all', 'openclaw', 'deploy', 'docker', 'pm2'] as const;
const STATUSES = ['all', 'running', 'completed', 'cancelled', 'error'] as const;

export default function OperationsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCES)[number]>('all');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('all');

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['operations-page'],
    queryFn: async () => {
      const response = await operationsAPI.getRecent(100);
      return response.data as UnifiedOperation[];
    },
    refetchInterval: 4000,
  });

  const operations = data || [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return operations.filter((operation) => {
      const sourceOk = sourceFilter === 'all' || operation.source === sourceFilter;
      const statusOk = statusFilter === 'all' || operation.status === statusFilter;
      const text = [operation.source, operation.type, operation.detail]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const searchOk = !needle || text.includes(needle);
      return sourceOk && statusOk && searchOk;
    });
  }, [operations, query, sourceFilter, statusFilter]);

  const openOperation = (operation: UnifiedOperation) => {
    if (operation.source === 'openclaw') {
      navigate(`/ai-assistant?job=${encodeURIComponent(operation.id.replace(/^openclaw-/, ''))}`);
      return;
    }
    if (operation.source === 'deploy') {
      navigate(`/deploy?job=${encodeURIComponent(operation.id.replace(/^deploy-/, ''))}`);
      return;
    }
    if (operation.source === 'docker') {
      navigate(`/docker?job=${encodeURIComponent(operation.id.replace(/^docker-/, ''))}`);
      return;
    }
    if (operation.source === 'pm2') {
      navigate(`/pm2?job=${encodeURIComponent(operation.id.replace(/^pm2-/, ''))}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-dark-100">Operations</h1>
          <p className="text-sm text-dark-400 mt-0.5">Unified live activity across OpenClaw, Deploy, Docker, and PM2</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm">Refresh</button>
      </div>

      <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search operations, tools, targets..."
              className="input-field pl-9 text-sm w-full"
            />
          </div>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as (typeof SOURCES)[number])} className="input-field text-sm">
            {SOURCES.map((source) => <option key={source} value={source}>Source: {source}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as (typeof STATUSES)[number])} className="input-field text-sm">
            {STATUSES.map((status) => <option key={status} value={status}>Status: {status}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={14} />
          Failed to load unified operations
        </div>
      )}

      <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-800/40">
          <div className="flex items-center gap-2 text-sm font-medium text-dark-200">
            <Filter size={14} className="text-primary-400" />
            {filtered.length} operations
          </div>
          <div className="text-xs text-dark-500">{operations.filter((item) => item.status === 'running').length} live</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-center text-dark-500">Loading operations…</div>
        ) : !filtered.length ? (
          <div className="px-4 py-10 text-center text-dark-500">No operations match the current filters.</div>
        ) : (
          <div className="divide-y divide-dark-800">
            {filtered.map((operation) => (
              <button
                key={operation.id}
                onClick={() => openOperation(operation)}
                className="block w-full px-4 py-4 text-left transition-colors hover:bg-dark-800/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-dark-800 p-2">
                      <Activity size={14} className="text-primary-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                        <span className="text-primary-400">{operation.source}</span>
                        <span className="text-dark-500">{operation.type}</span>
                      </div>
                      <div className="mt-1 truncate text-sm text-dark-100">{operation.detail || 'No detail available'}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={
                      operation.status === 'running'
                        ? 'text-blue-400'
                        : operation.status === 'completed'
                        ? 'text-green-400'
                        : operation.status === 'cancelled'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }>
                      {operation.status}
                    </div>
                    <div className="mt-1 text-[11px] text-dark-500">
                      {formatDistanceToNow(new Date(operation.startedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
