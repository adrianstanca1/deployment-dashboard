import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Cpu, ExternalLink, HardDrive, MemoryStick, Network, Wifi, Activity } from 'lucide-react';
import { useSystemHistory } from '@/hooks/useSystemHistory';
import { systemAPI } from '@/api';
import { formatBytes, formatUptime } from '@/utils';

// ── Chart component ──────────────────────────────────────────────────────────

function MiniChart({
  data,
  dataKey,
  color,
  label,
  value,
  sub,
}: {
  data: { time: string; [k: string]: number | string }[];
  dataKey: string;
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-dark-400">{label}</span>
        <span className="text-xl font-bold text-dark-100">{value}</span>
      </div>
      {sub && <div className="text-xs text-dark-500 mb-3">{sub}</div>}
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} interval="preserveStartEnd" tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} width={24} tickFormatter={v => `${v}%`} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v: number) => [`${v}%`, label]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${dataKey})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SystemMonitorPage() {
  const { history, current, connected } = useSystemHistory(60);

  const { data: portsData } = useQuery({
    queryKey: ['system-ports'],
    queryFn: systemAPI.getPorts,
    refetchInterval: 10000,
  });

  const { data: networkData } = useQuery({
    queryKey: ['system-network'],
    queryFn: systemAPI.getNetwork,
    refetchInterval: 30000,
  });

  const ports = portsData?.data ?? [];
  const ifaces = networkData?.data ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dark-100">System Monitor</h1>
          <p className="text-sm text-dark-400 mt-0.5">
            Live metrics — {connected ? '● updating every 2s' : '○ disconnected'}
          </p>
        </div>
        {current && (
          <div className="text-xs text-dark-500">
            Uptime: <span className="text-dark-300">{formatUptime(current.uptime)}</span>
            {' · '}Load: <span className="text-dark-300">{current.load.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Live charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MiniChart
          data={history}
          dataKey="cpu"
          color="#ef4444"
          label="CPU Usage"
          value={current ? `${current.cpu.usage}%` : '—'}
          sub={current ? `${current.cpu.cores} cores` : undefined}
        />
        <MiniChart
          data={history}
          dataKey="memory"
          color="#3b82f6"
          label="Memory"
          value={current ? `${current.memory.percentage}%` : '—'}
          sub={current ? `${formatBytes(current.memory.used)} / ${formatBytes(current.memory.total)}` : undefined}
        />
        <MiniChart
          data={history}
          dataKey="disk"
          color="#f59e0b"
          label="Disk"
          value={current ? `${current.disk.percentage}%` : '—'}
          sub={current ? `${formatBytes(current.disk.used)} / ${formatBytes(current.disk.total)}` : undefined}
        />
      </div>

      {/* Full-width combined chart */}
      {history.length > 5 && (
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-4">Combined (last {history.length} samples)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {[['cpu','#ef4444'],['memory','#3b82f6'],['disk','#f59e0b']].map(([k,c]) => (
                  <linearGradient key={k} id={`cg-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={c} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} interval={Math.max(1, Math.floor(history.length / 8))} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} width={24} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="cpu" stroke="#ef4444" strokeWidth={1.5} fill="url(#cg-cpu)" dot={false} name="CPU" />
              <Area type="monotone" dataKey="memory" stroke="#3b82f6" strokeWidth={1.5} fill="url(#cg-memory)" dot={false} name="Memory" />
              <Area type="monotone" dataKey="disk" stroke="#f59e0b" strokeWidth={1.5} fill="url(#cg-disk)" dot={false} name="Disk" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-dark-500">
            {[['CPU','#ef4444'],['Memory','#3b82f6'],['Disk','#f59e0b']].map(([k,c]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 rounded" style={{ background: c }} />
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Network interfaces */}
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network size={14} className="text-dark-400" />
            <h2 className="text-sm font-medium text-dark-300">Network Interfaces</h2>
          </div>
          <div className="space-y-2">
            {ifaces.map((iface, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-dark-400 font-mono">{iface.iface}</span>
                <span className="text-dark-200 font-mono">{iface.address}</span>
              </div>
            ))}
            {ifaces.length === 0 && <p className="text-dark-600 text-xs">Loading...</p>}
          </div>
        </div>

        {/* Container Ports */}
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wifi size={14} className="text-dark-400" />
            <h2 className="text-sm font-medium text-dark-300">Container Ports ({ports.length})</h2>
          </div>
          <div className="max-h-72 overflow-auto space-y-1">
            {ports.map((p: { container: string; image: string; port: number; publicPort?: number | null; protocol: string; status: string; url?: string | null; accessible?: boolean }, i: number) => (
              <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded transition-colors ${p.accessible ? 'hover:bg-dark-800' : 'opacity-60'}`}>
                <span className={`font-mono w-14 shrink-0 font-semibold ${p.accessible ? 'text-cyan-400' : 'text-dark-500'}`}>{p.port}</span>
                <span className="text-dark-500 w-8 shrink-0">{p.protocol}</span>
                <span className="text-dark-300 flex-1 truncate">{p.container}</span>
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shrink-0 font-mono text-[10px]"
                    title={p.url}
                  >
                    <ExternalLink size={10} />
                    {p.url.replace('https://', '').replace('http://', '').split('/')[0]}
                  </a>
                ) : (
                  <span className="text-dark-600 text-[10px] shrink-0">internal</span>
                )}
              </div>
            ))}
            {ports.length === 0 && <p className="text-dark-600 text-xs">Loading...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
