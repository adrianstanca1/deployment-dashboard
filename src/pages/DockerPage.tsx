import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { wsUrl, formatBytes } from '@/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Container, Play, Square, RotateCw, Trash2, Search, Plus, Terminal,
  Download, HardDrive, Network, Info, X, ChevronRight, Layers,
  AlertTriangle, CheckCircle, Cpu, MemoryStick, Wifi, WifiOff,
  RefreshCw, Package, Settings, Zap
} from 'lucide-react';
import { dockerAPI } from '@/api';
import StatusBadge from '@/components/StatusBadge';
import type { DockerContainer, DockerImage, DockerVolume, DockerNetwork } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripAnsi(str: string) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[mGKH]/g, '');
}

// ── Container Logs Modal ──────────────────────────────────────────────────────

function ContainerLogsModal({ container, onClose }: { container: DockerContainer; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const ws = new WebSocket(wsUrl(`/ws/docker?id=${container.id}`));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = (evt) => { console.error('[ContainerLogsModal] WS error', evt); setConnected(false); };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'history' || msg.type === 'log') {
          const text = stripAnsi(msg.data || '');
          const newLines = text.split('\n').filter((l: string) => l.trim());
          setLines(prev => [...prev, ...newLines].slice(-2000));
        }
      } catch { /* ignore */ }
    };

    return () => {
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
    };
  }, [container.id]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-dark-900 rounded-xl border border-dark-700 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-2">
            <Container size={14} className="text-blue-400" />
            <span className="font-mono text-sm text-dark-100">{container.name}</span>
            <span className="text-dark-500 text-xs">— logs</span>
            {connected
              ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={10} /> live</span>
              : <span className="flex items-center gap-1 text-dark-500 text-xs"><WifiOff size={10} /> disconnected</span>
            }
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(a => !a)}
              className={`text-xs px-2 py-1 rounded ${autoScroll ? 'bg-primary-600/30 text-primary-400' : 'text-dark-500 hover:text-dark-300'}`}
            >
              Auto-scroll
            </button>
            <button onClick={() => setLines([])} className="text-xs text-dark-500 hover:text-dark-300 px-2 py-1 rounded">
              Clear
            </button>
            <button onClick={onClose} className="p-1.5 text-dark-500 hover:text-dark-200 hover:bg-dark-700 rounded">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-dark-300 bg-dark-950">
          {lines.length === 0 && <p className="text-dark-600 italic">Waiting for logs…</p>}
          {lines.map((line, i) => (
            <div key={i} className={`leading-5 ${line.includes('error') || line.includes('Error') || line.includes('ERR') ? 'text-red-400' : line.includes('WARN') || line.includes('warn') ? 'text-yellow-400' : ''}`}>
              {line}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ── Container Inspect Drawer ──────────────────────────────────────────────────

function InspectDrawer({ container, onClose }: { container: DockerContainer; onClose: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'env' | 'mounts' | 'network'>('overview');

  const { data: inspectData, isLoading } = useQuery({
    queryKey: ['docker-inspect', container.id],
    queryFn: () => dockerAPI.inspectContainer(container.id),
  });

  const { data: statsData } = useQuery({
    queryKey: ['docker-stats', container.id],
    queryFn: () => dockerAPI.getContainerStats(container.id),
    refetchInterval: 3000,
    enabled: container.status?.startsWith('Up'),
  });

  const inspect = inspectData?.data as Record<string, unknown> | undefined;
  const stats = statsData?.data;

  const config = inspect?.Config as Record<string, unknown> | undefined;
  const hostConfig = inspect?.HostConfig as Record<string, unknown> | undefined;
  const networkSettings = inspect?.NetworkSettings as Record<string, unknown> | undefined;
  const state = inspect?.State as Record<string, unknown> | undefined;
  const mounts = inspect?.Mounts as Array<Record<string, unknown>> | undefined;
  const envVars: string[] = Array.isArray(config?.Env) ? (config.Env as string[]) : [];
  const restartPolicy = (hostConfig?.RestartPolicy as Record<string, unknown> | undefined)?.Name as string | undefined;
  const ipAddress = (networkSettings?.IPAddress as string) || '—';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'env', label: `Env (${envVars.length})`, icon: Settings },
    { id: 'mounts', label: `Mounts (${mounts?.length ?? 0})`, icon: HardDrive },
    { id: 'network', label: 'Network', icon: Network },
  ] as const;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[480px] bg-dark-900 border-l border-dark-700 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 shrink-0">
        <div>
          <div className="font-mono text-sm text-dark-100">{container.name}</div>
          <div className="text-xs text-dark-500 mt-0.5 font-mono">{container.id.slice(0, 12)}</div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-dark-800 rounded text-dark-500 hover:text-dark-200">
          <X size={14} />
        </button>
      </div>

      {/* Stats bar */}
      {stats && container.status?.startsWith('Up') && (
        <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-dark-800 bg-dark-950/50">
          <div className="text-center">
            <div className="text-xs text-dark-500 flex items-center justify-center gap-1"><Cpu size={10} /> CPU</div>
            <div className="text-sm font-mono text-primary-400">{stats.CPUPerc}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-dark-500 flex items-center justify-center gap-1"><MemoryStick size={10} /> MEM</div>
            <div className="text-sm font-mono text-blue-400">{stats.MemPerc}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-dark-500">NET I/O</div>
            <div className="text-xs font-mono text-dark-300">{stats.NetIO}</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 px-4 py-2 border-b border-dark-800">
        <button
          onClick={() => navigate(`/terminal?docker=${container.name}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 rounded text-xs font-medium"
        >
          <Terminal size={12} /> Exec Shell
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700 shrink-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.id ? 'text-primary-400 border-b-2 border-primary-400' : 'text-dark-500 hover:text-dark-300'
            }`}
          >
            <t.icon size={11} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {isLoading && <div className="text-dark-500 text-center py-8">Loading...</div>}

        {tab === 'overview' && inspect && (
          <div className="space-y-3">
            <Row label="Image" value={container.image} mono />
            <Row label="Status" value={container.status} />
            <Row label="PID" value={String((state?.Pid as number) ?? '—')} mono />
            <Row label="Restart Policy" value={restartPolicy || '—'} />
            <Row label="Ports" value={container.ports || '—'} mono />
            <Row label="Started" value={String(state?.StartedAt ?? '—')} />
            <Row label="Image ID" value={container.id.slice(0, 12)} mono />
          </div>
        )}

        {tab === 'env' && (
          <div className="space-y-1">
            {envVars.length === 0 && <p className="text-dark-600 italic text-xs">No environment variables</p>}
            {envVars.map((e, i) => {
              const [key, ...rest] = e.split('=');
              const val = rest.join('=');
              return (
                <div key={i} className="flex gap-2 font-mono text-xs py-1 border-b border-dark-800/50 last:border-0">
                  <span className="text-primary-400 shrink-0">{key}</span>
                  <span className="text-dark-500">=</span>
                  <span className="text-dark-300 break-all">{val || <em className="text-dark-600">empty</em>}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'mounts' && (
          <div className="space-y-2">
            {(!mounts || mounts.length === 0) && <p className="text-dark-600 italic text-xs">No mounts</p>}
            {mounts?.map((m, i) => (
              <div key={i} className="rounded-lg bg-dark-800 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${m.Type === 'volume' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {String(m.Type)}
                  </span>
                  <span className="text-dark-400 font-medium">{String(m.Mode || 'rw')}</span>
                </div>
                <div className="font-mono text-dark-300 break-all">{String(m.Source)} → {String(m.Destination)}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'network' && inspect && (
          <div className="space-y-3">
            <Row label="IP Address" value={ipAddress} mono />
            <Row label="Gateway" value={String((networkSettings?.Gateway as string) || '—')} mono />
            {networkSettings?.Ports != null && (
              <div>
                <div className="text-xs text-dark-500 mb-2 font-medium uppercase tracking-wider">Port Bindings</div>
                {Object.entries(networkSettings.Ports as Record<string, unknown>).map(([port, bindings]) => (
                  <div key={port} className="flex justify-between font-mono text-xs py-1 border-b border-dark-800/50">
                    <span className="text-primary-400">{port}</span>
                    <span className="text-dark-400">
                      {Array.isArray(bindings)
                        ? bindings.map((b: Record<string, string>) => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`).join(', ')
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-dark-800/50 text-xs last:border-0">
      <span className="text-dark-500 shrink-0">{label}</span>
      <span className={`text-dark-200 text-right break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ── Run Container Modal ───────────────────────────────────────────────────────

function RunContainerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [ports, setPorts] = useState('');
  const [env, setEnv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    if (!image.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await dockerAPI.run({
        image: image.trim(),
        name: name.trim() || undefined,
        ports: ports.trim() ? ports.split(',').map(p => p.trim()).filter(Boolean) : undefined,
        env: env.trim() ? env.split('\n').map(e => e.trim()).filter(Boolean) : undefined,
        detach: true,
      });
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to run container');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-dark-900 rounded-xl border border-dark-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-dark-100">Run Container</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-800 rounded text-dark-500"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Image *" value={image} onChange={setImage} placeholder="nginx:latest" />
          <Field label="Name" value={name} onChange={setName} placeholder="my-container" />
          <Field label="Port mappings" value={ports} onChange={setPorts} placeholder="8080:80, 443:443" />
          <div>
            <label className="block text-xs text-dark-500 mb-1">Environment variables</label>
            <textarea
              value={env}
              onChange={e => setEnv(e.target.value)}
              placeholder="KEY=value (one per line)"
              rows={3}
              className="input-field text-xs font-mono resize-none w-full"
            />
          </div>
        </div>
        {error && <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleRun} disabled={!image || loading} className="btn-primary text-sm disabled:opacity-50">
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-dark-500 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="input-field text-sm w-full" />
    </div>
  );
}

// ── Pull Image Modal ──────────────────────────────────────────────────────────

function PullImageModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [image, setImage] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [pulling, setPulling] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handlePull = async () => {
    if (!image.trim()) return;
    setPulling(true);
    setLines([]);
    setDone(false);

    try {
      const response = await fetch('/api/docker/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: image.trim() }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) return;

      const processChunk = (chunk: string) => {
        buffer += chunk;
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.trim()) continue;
          const lines_in = part.split('\n');
          let event = '';
          for (const line of lines_in) {
            if (line.startsWith('event: ')) event = line.slice(7);
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (event === 'output') setLines(prev => [...prev, data.text.trim()].filter(Boolean));
                if (event === 'done') {
                  setDone(true);
                  if (data.success) onSuccess();
                }
              } catch { /* ignore */ }
            }
          }
        }
      };

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        processChunk(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pull failed';
      setLines(prev => [...prev, `\x1b[31mError: ${message}\x1b[0m`]);
    } finally {
      setPulling(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-dark-900 rounded-xl border border-dark-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-dark-100">Pull Image</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-800 rounded text-dark-500"><X size={14} /></button>
        </div>
        <div className="flex gap-2">
          <input
            type="text" value={image} onChange={e => setImage(e.target.value)}
            placeholder="nginx:latest or ubuntu:22.04"
            className="input-field text-sm flex-1"
            onKeyDown={e => e.key === 'Enter' && !pulling && handlePull()}
          />
          <button onClick={handlePull} disabled={!image || pulling} className="btn-primary text-sm disabled:opacity-50">
            {pulling ? 'Pulling…' : 'Pull'}
          </button>
        </div>
        {lines.length > 0 && (
          <div className="bg-dark-950 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-dark-300 space-y-0.5">
            {lines.map((l, i) => <div key={i}>{l}</div>)}
            {done && <div className="text-green-400 font-medium">✓ Pull complete</div>}
            <div ref={bottomRef} />
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">{done ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main DockerPage ───────────────────────────────────────────────────────────

type DockerTab = 'containers' | 'images' | 'volumes' | 'networks';

export default function DockerPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<DockerTab>('containers');
  const [search, setSearch] = useState('');
  const [logsContainer, setLogsContainer] = useState<DockerContainer | null>(null);
  const [inspectContainer, setInspectContainer] = useState<DockerContainer | null>(null);
  const [showRun, setShowRun] = useState(false);
  const [showPull, setShowPull] = useState(false);
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all');

  const { data: containersData, isLoading: cLoading } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: dockerAPI.getContainers,
    refetchInterval: 8000,
  });
  const { data: imagesData, isLoading: iLoading } = useQuery({
    queryKey: ['docker-images'],
    queryFn: dockerAPI.getImages,
    refetchInterval: 30000,
  });
  const { data: volumesData } = useQuery({
    queryKey: ['docker-volumes'],
    queryFn: dockerAPI.getVolumes,
    refetchInterval: 30000,
  });
  const { data: networksData } = useQuery({
    queryKey: ['docker-networks'],
    queryFn: dockerAPI.getNetworks,
    refetchInterval: 60000,
  });
  const { data: dfData } = useQuery({
    queryKey: ['docker-df'],
    queryFn: dockerAPI.getSystemDf,
    refetchInterval: 60000,
  });

  const actionMut = useMutation({
    mutationFn: ({ act, id }: { act: string; id: string }) => dockerAPI.containerAction(act, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docker-containers'] }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => dockerAPI.removeContainer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docker-containers'] }),
  });

  const removeImageMut = useMutation({
    mutationFn: (id: string) => dockerAPI.removeImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docker-images'] }),
  });

  const removeVolumeMut = useMutation({
    mutationFn: (name: string) => dockerAPI.removeVolume(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docker-volumes'] }),
  });

  const pruneMut = useMutation({
    mutationFn: (type: 'containers' | 'images' | 'volumes' | 'all') => dockerAPI.prune(type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docker-containers'] });
      qc.invalidateQueries({ queryKey: ['docker-images'] });
      qc.invalidateQueries({ queryKey: ['docker-volumes'] });
      qc.invalidateQueries({ queryKey: ['docker-df'] });
    },
  });

  const containers = containersData?.data ?? [];
  const images = imagesData?.data ?? [];
  const volumes = volumesData?.data ?? [];
  const networks = networksData?.data ?? [];
  const df = dfData?.data ?? [];

  const running = useMemo(() => containers.filter(c => c.status?.startsWith('Up')).length, [containers]);
  const stopped = useMemo(() => containers.length - running, [containers, running]);

  const filteredContainers = useMemo(() => containers.filter(c => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.image?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'running' && c.status?.startsWith('Up')) ||
      (filter === 'stopped' && !c.status?.startsWith('Up'));
    return matchSearch && matchFilter;
  }), [containers, search, filter]);

  const filteredImages = useMemo(() => images.filter(img =>
    `${img.repository}:${img.tag}`.toLowerCase().includes(search.toLowerCase())
  ), [images, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['docker-containers'] });
    qc.invalidateQueries({ queryKey: ['docker-images'] });
  };

  const tabs: Array<{ id: DockerTab; label: string; icon: React.ElementType; count?: number }> = [
    { id: 'containers', label: 'Containers', icon: Container, count: containers.length },
    { id: 'images', label: 'Images', icon: Layers, count: images.length },
    { id: 'volumes', label: 'Volumes', icon: HardDrive, count: volumes.length },
    { id: 'networks', label: 'Networks', icon: Network, count: networks.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-dark-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-dark-100">Docker</h1>
            <p className="text-sm text-dark-400 mt-0.5">
              {running} running · {stopped} stopped · {images.length} images
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPull(true)}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <Download size={13} /> Pull Image
            </button>
            <button
              onClick={() => setShowRun(true)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <Plus size={13} /> Run Container
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard icon={Container} label="Running" value={String(running)} color="text-green-400" />
          <StatCard icon={Square} label="Stopped" value={String(stopped)} color="text-dark-500" />
          <StatCard icon={Layers} label="Images" value={String(images.length)} color="text-blue-400" />
          <StatCard
            icon={HardDrive}
            label="Disk Used"
            value={df.find(d => d.Type === 'Images')?.Size || '—'}
            color="text-yellow-400"
          />
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-primary-600/20 text-primary-400' : 'text-dark-500 hover:text-dark-300 hover:bg-dark-800'
              }`}
            >
              <t.icon size={12} />
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-primary-600/30' : 'bg-dark-800'}`}>
                {t.count ?? 0}
              </span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {tab === 'containers' && (
              <div className="flex gap-1">
                {(['all', 'running', 'stopped'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 rounded text-xs ${filter === f ? 'bg-dark-700 text-dark-100' : 'text-dark-500 hover:text-dark-300'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="input-field pl-8 text-xs py-1.5 w-48"
              />
            </div>
            <button
              onClick={() => invalidate()}
              className="p-1.5 text-dark-500 hover:text-dark-200 hover:bg-dark-800 rounded"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Containers tab */}
        {tab === 'containers' && (
          <div className="space-y-2">
            {cLoading && <div className="text-center py-10 text-dark-500">Loading containers…</div>}
            {!cLoading && filteredContainers.length === 0 && (
              <div className="text-center py-10 text-dark-500">No containers found</div>
            )}
            {filteredContainers.map(c => {
              const isRunning = c.status?.startsWith('Up');
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-800 bg-dark-900 hover:border-dark-700 transition-colors group"
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-green-400' : 'bg-dark-600'}`} />

                  {/* Name + image */}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-dark-100 truncate">{c.name}</div>
                    <div className="text-xs text-dark-500 truncate">{c.image}</div>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block w-28">
                    <StatusBadge status={isRunning ? 'running' : 'stopped'} />
                  </div>

                  {/* Ports */}
                  <div className="hidden md:block w-36 text-xs text-dark-400 font-mono truncate">
                    {c.ports || <span className="text-dark-700">—</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    {isRunning ? (
                      <ActionBtn title="Stop" color="yellow" onClick={() => actionMut.mutate({ act: 'stop', id: c.id })}>
                        <Square size={12} />
                      </ActionBtn>
                    ) : (
                      <ActionBtn title="Start" color="green" onClick={() => actionMut.mutate({ act: 'start', id: c.id })}>
                        <Play size={12} />
                      </ActionBtn>
                    )}
                    <ActionBtn title="Restart" color="blue" onClick={() => actionMut.mutate({ act: 'restart', id: c.id })}>
                      <RotateCw size={12} />
                    </ActionBtn>
                    <ActionBtn title="Logs" color="purple" onClick={() => setLogsContainer(c)}>
                      <Zap size={12} />
                    </ActionBtn>
                    <ActionBtn title="Inspect" color="default" onClick={() => setInspectContainer(c)}>
                      <Info size={12} />
                    </ActionBtn>
                    <ActionBtn
                      title="Remove"
                      color="red"
                      onClick={() => {
                        if (confirm(`Remove container "${c.name}"?`)) removeMut.mutate(c.id);
                      }}
                    >
                      <Trash2 size={12} />
                    </ActionBtn>
                  </div>
                </div>
              );
            })}

            {/* Prune stopped */}
            {stopped > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => { if (confirm('Remove all stopped containers?')) pruneMut.mutate('containers'); }}
                  className="text-xs text-dark-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={11} /> Prune {stopped} stopped container{stopped > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Images tab */}
        {tab === 'images' && (
          <div className="space-y-2">
            {iLoading && <div className="text-center py-10 text-dark-500">Loading images…</div>}
            {filteredImages.map(img => (
              <div key={img.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-800 bg-dark-900 hover:border-dark-700 group">
                <Package size={14} className="text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-dark-100">
                    {img.repository}
                    <span className="text-dark-500">:{img.tag}</span>
                  </div>
                  <div className="text-xs text-dark-500 font-mono">{img.id.slice(0, 12)}</div>
                </div>
                <div className="text-xs text-dark-400">{img.size}</div>
                <div className="flex gap-1 opacity-70 group-hover:opacity-100">
                  <ActionBtn
                    title="Remove image"
                    color="red"
                    onClick={() => { if (confirm(`Remove image ${img.repository}:${img.tag}?`)) removeImageMut.mutate(img.id); }}
                  >
                    <Trash2 size={12} />
                  </ActionBtn>
                </div>
              </div>
            ))}
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => pruneMut.mutate('images')}
                className="text-xs text-dark-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={11} /> Prune dangling images
              </button>
              <button
                onClick={() => pruneMut.mutate('all')}
                className="text-xs text-dark-500 hover:text-red-400 flex items-center gap-1.5 transition-colors ml-4"
              >
                <AlertTriangle size={11} /> System prune (all unused)
              </button>
            </div>
          </div>
        )}

        {/* Volumes tab */}
        {tab === 'volumes' && (
          <div className="space-y-2">
            {volumes.length === 0 && <div className="text-center py-10 text-dark-500">No volumes</div>}
            {volumes.map(v => (
              <div key={v.name} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-800 bg-dark-900 hover:border-dark-700 group">
                <HardDrive size={14} className="text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-dark-100 truncate">{v.name}</div>
                  <div className="text-xs text-dark-500 truncate">{v.mountpoint}</div>
                </div>
                <span className="text-xs text-dark-500 bg-dark-800 px-2 py-0.5 rounded">{v.driver}</span>
                <div className="flex gap-1 opacity-70 group-hover:opacity-100">
                  <ActionBtn
                    title="Remove volume"
                    color="red"
                    onClick={() => { if (confirm(`Remove volume "${v.name}"? This is irreversible!`)) removeVolumeMut.mutate(v.name); }}
                  >
                    <Trash2 size={12} />
                  </ActionBtn>
                </div>
              </div>
            ))}
            {volumes.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => { if (confirm('Remove all unused volumes?')) pruneMut.mutate('volumes'); }}
                  className="text-xs text-dark-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={11} /> Prune unused volumes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Networks tab */}
        {tab === 'networks' && (
          <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-800/40">
                  <th className="text-left text-xs text-dark-500 font-medium px-4 py-3">Name</th>
                  <th className="text-left text-xs text-dark-500 font-medium px-4 py-3">Driver</th>
                  <th className="text-left text-xs text-dark-500 font-medium px-4 py-3">Scope</th>
                  <th className="text-left text-xs text-dark-500 font-medium px-4 py-3 hidden md:table-cell">ID</th>
                </tr>
              </thead>
              <tbody>
                {networks.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-dark-500">No networks</td></tr>
                )}
                {networks.map(n => (
                  <tr key={n.id} className="border-b border-dark-800 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-dark-100">{n.name}</td>
                    <td className="px-4 py-3 text-xs text-dark-400">{n.driver}</td>
                    <td className="px-4 py-3 text-xs text-dark-400">{n.scope}</td>
                    <td className="px-4 py-3 text-xs text-dark-500 font-mono hidden md:table-cell">{n.id.slice(0, 12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals + Drawers */}
      {logsContainer && <ContainerLogsModal container={logsContainer} onClose={() => setLogsContainer(null)} />}
      {inspectContainer && <InspectDrawer container={inspectContainer} onClose={() => setInspectContainer(null)} />}
      {showRun && <RunContainerModal onClose={() => setShowRun(false)} onSuccess={invalidate} />}
      {showPull && <PullImageModal onClose={() => setShowPull(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['docker-images'] })} />}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-dark-800 bg-dark-900 px-4 py-3 flex items-center gap-3">
      <Icon size={18} className={color} />
      <div>
        <div className="text-xs text-dark-500">{label}</div>
        <div className={`text-lg font-bold ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function ActionBtn({
  children, title, color, onClick,
}: {
  children: React.ReactNode; title: string; color: 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'default'; onClick: () => void;
}) {
  const colorMap = {
    red: 'hover:text-red-400 hover:bg-red-500/10',
    green: 'hover:text-green-400 hover:bg-green-500/10',
    yellow: 'hover:text-yellow-400 hover:bg-yellow-500/10',
    blue: 'hover:text-blue-400 hover:bg-blue-500/10',
    purple: 'hover:text-purple-400 hover:bg-purple-500/10',
    default: 'hover:text-dark-100 hover:bg-dark-700',
  };
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded text-dark-500 transition-colors ${colorMap[color]}`}
    >
      {children}
    </button>
  );
}
