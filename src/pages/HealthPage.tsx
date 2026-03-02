import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, RefreshCw, Server, Database, Cloud, Terminal,
  Cpu, AlertCircle, CheckCircle, AlertTriangle, XCircle,
  Clock, Zap, ArrowLeft
} from 'lucide-react';
import { useHealthCheck, ServiceStatus, getStatusColor, getStatusIcon } from '@/hooks/useHealthCheck';
import { StatsCardSkeleton } from '@/components/skeletons';
import { formatDistanceToNow } from 'date-fns';

const serviceIcons: Record<string, React.ElementType> = {
  pm2: Server,
  docker: Database,
  ai: Cloud,
  terminal: Terminal,
  system: Cpu,
  nginx: Activity,
  database: Database,
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  const colors = {
    healthy: 'bg-green-500/10 text-green-500 border-green-500/30',
    degraded: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    unhealthy: 'bg-red-500/10 text-red-500 border-red-500/30',
    unknown: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  };

  const icons = {
    healthy: CheckCircle,
    degraded: AlertTriangle,
    unhealthy: XCircle,
    unknown: AlertCircle,
  };

  const Icon = icons[status] || AlertCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
      <Icon size={14} />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function ServiceCard({ service }: { service: import('@/hooks/useHealthCheck').HealthStatus }) {
  const Icon = serviceIcons[service.service] || Activity;
  const statusColor = getStatusColor(service.status);

  return (
    <div className={`bg-dark-800 rounded-lg p-4 border ${statusColor.split(' ')[2]} ${statusColor.split(' ')[1]}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${statusColor.split(' ')[1]}`}>
            <Icon size={20} className={statusColor.split(' ')[0]} />
          </div>
          <div>
            <h3 className="font-medium text-dark-100">{service.name}</h3>
            <p className="text-sm text-dark-400">{service.service}</p>
          </div>
        </div>
        <StatusBadge status={service.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2 text-sm text-dark-300">
          <Clock size={14} className="text-dark-400" />
          <span>{service.latency}ms</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-dark-300">
          <RefreshCw size={14} className="text-dark-400" />
          <span>{formatDistanceToNow(new Date(service.lastChecked), { addSuffix: true })}</span>
        </div>
      </div>

      {service.message && (
        <div className="mt-3 p-2 rounded bg-dark-900/50 text-sm text-dark-300">
          {service.message}
        </div>
      )}

      {service.details && Object.keys(service.details).length > 0 && (
        <div className="mt-3 space-y-1">
          {Object.entries(service.details).map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-dark-400">{key}:</span>
              <span className="text-dark-200 font-mono">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverallHealth({ status }: { status: ServiceStatus }) {
  const colors = {
    healthy: 'from-green-500/20 to-green-500/5 border-green-500/30',
    degraded: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
    unhealthy: 'from-red-500/20 to-red-500/5 border-red-500/30',
    unknown: 'from-gray-500/20 to-gray-500/5 border-gray-500/30',
  };

  const icons = {
    healthy: CheckCircle,
    degraded: AlertTriangle,
    unhealthy: XCircle,
    unknown: AlertCircle,
  };

  const Icon = icons[status] || AlertCircle;

  return (
    <div className={`rounded-lg p-6 border bg-gradient-to-br ${colors[status]}`}>
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-full bg-dark-900/50">
          <Icon size={32} className={status === 'healthy' ? 'text-green-500' : status === 'degraded' ? 'text-yellow-500' : 'text-red-500'} />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-dark-100">System {status === 'healthy' ? 'Healthy' : status === 'degraded' ? 'Degraded' : 'Unhealthy'}</h2>
          <p className="text-dark-400">
            {status === 'healthy'
              ? 'All services are running normally'
              : status === 'degraded'
              ? 'Some services are experiencing issues'
              : 'Critical services are down'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const navigate = useNavigate();
  const { data: health, isLoading, refetch, isRefetching } = useHealthCheck();
  const [autoRefresh, setAutoRefresh] = useState(true);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-dark-100">System Health</h1>
            <p className="text-dark-400 mt-1">Loading health status...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-dark-100 mb-2">Failed to load health status</h2>
          <p className="text-dark-400 mb-4">Unable to fetch system health information</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/command-center')}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-dark-100">System Health</h1>
            <p className="text-dark-400 mt-1">Monitor the status of all services</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-dark-600"
            />
            Auto-refresh
          </label>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <OverallHealth status={health.overall} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health.services.map((service) => (
          <ServiceCard key={service.service} service={service} />
        ))}
      </div>

      <div className="text-sm text-dark-400 text-center pt-4">
        Last updated: {formatDistanceToNow(new Date(health.timestamp), { addSuffix: true })}
      </div>
    </div>
  );
}
