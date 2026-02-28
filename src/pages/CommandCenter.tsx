import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Activity, CheckCircle, XCircle, AlertCircle, Github, Container,
  HardDrive, Cpu, MemoryStick, Globe, Terminal, Rocket, RefreshCw, Play, Square,
  Trash2, Server, ChevronRight, Zap, Plus, Search, Bell, Settings
} from 'lucide-react';
import { pm2API, systemAPI, githubAPI, dockerAPI } from '@/api';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
import DeploymentLink from '@/components/DeploymentLink';
import { formatBytes, formatUptime, formatRelativeTime } from '@/utils';

// Quick Action Button Component
function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  disabled = false
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  disabled?: boolean;
}) {
  const variants = {
    default: 'bg-dark-800 hover:bg-dark-700 border-dark-700',
    danger: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400',
    success: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400',
    warning: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
      `}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

// Service Status Card
function ServiceCard({
  title,
  icon: Icon,
  status,
  count,
  subtext,
  onClick
}: {
  title: string;
  icon: React.ElementType;
  status: 'online' | 'warning' | 'error' | 'neutral';
  count: number | string;
  subtext: string;
  onClick?: () => void;
}) {
  const statusColors = {
    online: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    error: 'border-red-500/30 bg-red-500/5',
    neutral: 'border-dark-700 bg-dark-800/50',
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-xl border cursor-pointer transition-all duration-200
        hover:scale-[1.02] hover:shadow-lg
        ${statusColors[status]}
        ${onClick ? 'hover:border-opacity-50' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${status === 'online' ? 'bg-green-500/20 text-green-400' :
            status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
            status === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-dark-700 text-dark-400'}
        `}>
          <Icon size={20} />
        </div>
        <ChevronRight size={16} className="text-dark-500" />
      </div>
      <div className="text-2xl font-bold text-dark-100 mb-1">{count}</div>
      <div className="text-sm font-medium text-dark-300 mb-0.5">{title}</div>
      <div className="text-xs text-dark-500">{subtext}</div>
    </div>
  );
}

// Process Mini Card
function ProcessMiniCard({ process }: { process: any }) {
  const isOnline = process.status === 'online';

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all duration-200 group
        ${isOnline
          ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/40'
          : 'border-dark-700 bg-dark-800/50 hover:border-dark-600'
        }
      `}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`
          w-2 h-2 rounded-full
          ${isOnline ? 'bg-green-400' : 'bg-dark-600'}
        `} />
        <span className="font-mono text-xs text-dark-200 truncate">{process.name}</span>
      </div>

      {process.url && (
        <a
          href={isOnline ? process.url : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!isOnline) e.preventDefault();
          }}
          className={`
            text-xs font-mono truncate block
            ${isOnline ? 'text-green-400 hover:text-green-300' : 'text-dark-500'}
          `}
        >
          {process.url?.replace(/^https?:\/\//, '')}
        </a>
      )}

      <div className="flex items-center gap-3 mt-2 text-xs text-dark-500">
        <span>CPU {process.monit?.cpu ?? 0}%</span>
        <span>MEM {formatBytes(process.monit?.memory ?? 0)}</span>
      </div>
    </div>
  );
}

// Alert Banner
function AlertBanner({ type, message, action }: { type: 'info' | 'warning' | 'error'; message: string; action?: { label: string; onClick: () => void } }) {
  const colors = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  return (
    <div className={`p-3 rounded-lg border flex items-center gap-3 ${colors[type]}`}>
      <Bell size={16} />
      <span className="flex-1 text-sm">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-medium underline hover:no-underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default function CommandCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: pm2Data, refetch: refetchPM2 } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 5000,
  });

  const { data: sysData } = useQuery({
    queryKey: ['system-stats'],
    queryFn: systemAPI.getStats,
    refetchInterval: 10000,
  });

  const { data: reposData } = useQuery({
    queryKey: ['github-repos'],
    queryFn: githubAPI.getRepos,
    refetchInterval: 60000,
  });

  const { data: dockerData } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: dockerAPI.getContainers,
    refetchInterval: 10000,
  });

  const restartErroredMutation = useMutation({
    mutationFn: pm2API.restartErrored,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pm2-list'] }),
  });

  const processes = pm2Data?.data ?? [];
  const sys = sysData?.data;
  const repos = reposData?.data ?? [];
  const containers = dockerData?.data ?? [];

  // Stats
  const onlineCount = processes.filter(p => p.status === 'online').length;
  const erroredCount = processes.filter(p => p.status === 'errored').length;
  const runningContainers = containers.filter(c => c.status?.startsWith('Up')).length;

  // Filter processes based on search
  const filteredProcesses = useMemo(() => {
    if (!searchQuery) return processes.slice(0, 8);
    return processes.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [processes, searchQuery]);

  // Alerts
  const alerts = [];
  if (erroredCount > 0) {
    alerts.push({
      type: 'error' as const,
      message: `${erroredCount} PM2 process${erroredCount > 1 ? 'es' : ''} have errors`,
      action: { label: 'Fix Now', onClick: () => restartErroredMutation.mutate() }
    });
  }
  if ((sys?.memory?.percentage ?? 0) > 85) {
    alerts.push({
      type: 'warning' as const,
      message: `Memory usage is at ${sys?.memory?.percentage ?? 0}%`,
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <LayoutDashboard size={24} className="text-primary-400" />
            Command Center
          </h1>
          <p className="text-sm text-dark-400 mt-1">
            Manage all your deployments, services, and infrastructure from one place
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchPM2()}
            className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button onClick={() => navigate('/settings')} title="Settings" className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <AlertBanner key={i} {...alert} />
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <QuickActionButton
            icon={Rocket}
            label="Deploy New App"
            onClick={() => window.location.href = '/deploy'}
            variant="success"
          />
          <QuickActionButton
            icon={RefreshCw}
            label="Restart Errored"
            onClick={() => restartErroredMutation.mutate()}
            disabled={erroredCount === 0}
          />
          <QuickActionButton
            icon={Terminal}
            label="Open Terminal"
            onClick={() => window.location.href = '/terminal'}
          />
          <QuickActionButton
            icon={Github}
            label="GitHub"
            onClick={() => window.location.href = '/github'}
          />
          <QuickActionButton
            icon={Container}
            label="Docker"
            onClick={() => window.location.href = '/docker'}
          />
        </div>
      </section>

      {/* Service Overview Grid */}
      <section>
        <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">
          Services Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ServiceCard
            title="PM2 Processes"
            icon={Activity}
            status={erroredCount > 0 ? 'error' : onlineCount === processes.length ? 'online' : 'warning'}
            count={onlineCount}
            subtext={`${processes.length} total · ${erroredCount} errored`}
            onClick={() => window.location.href = '/pm2'}
          />

          <ServiceCard
            title="Docker Containers"
            icon={Container}
            status={runningContainers === containers.length ? 'online' : containers.length > 0 ? 'warning' : 'neutral'}
            count={runningContainers}
            subtext={`${containers.length} total containers`}
            onClick={() => window.location.href = '/docker'}
          />

          <ServiceCard
            title="GitHub Repos"
            icon={Github}
            status="neutral"
            count={repos.length}
            subtext={`${repos.filter(r => new Date(r.pushed_at) > new Date(Date.now() - 86400000)).length} updated today`}
            onClick={() => window.location.href = '/github'}
          />

          <ServiceCard
            title="System Health"
            icon={Server}
            status={(sys?.cpu?.usage ?? 0) > 80 ? 'error' : (sys?.memory?.percentage ?? 0) > 80 ? 'warning' : 'online'}
            count={`${sys?.cpu?.usage ?? 0}%`}
            subtext={`Memory ${sys?.memory?.percentage ?? 0}% · ${sys?.disk?.percentage ?? 0}% disk`}
            onClick={() => window.location.href = '/monitor'}
          />
        </div>
      </section>

      {/* Active Deployments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider">
            Active Deployments
          </h2>
          <a href="/pm2" className="text-xs text-primary-400 hover:text-primary-300">View All →</a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProcesses.map(p => (
            <ProcessMiniCard key={p.pm_id} process={p} />
          ))}
        </div>

        {filteredProcesses.length === 0 && searchQuery && (
          <p className="text-dark-500 text-sm text-center py-8">
            No processes matching "{searchQuery}"
          </p>
        )}
      </section>

      {/* Search Bar */}
      <section className="sticky bottom-6">
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={16} className="text-dark-500" />
          </div>
          <input
            type="text"
            placeholder="Search processes, containers, repos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-900 border border-dark-700 text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors"
          />
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <kbd className="px-2 py-1 rounded bg-dark-800 text-dark-500 text-xs">⌘K</kbd>
          </div>
        </div>
      </section>
    </div>
  );
}
