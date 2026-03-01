import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Activity, CheckCircle, XCircle, AlertCircle, Github, Container,
  HardDrive, Cpu, MemoryStick, Globe, Terminal, Rocket, RefreshCw, Play, Square,
  Trash2, Server, ChevronRight, Zap, Plus, Search, Bell, Settings, Eye, EyeOff, Save, Key, Bot
} from 'lucide-react';
import { pm2API, systemAPI, githubAPI, dockerAPI } from '@/api';
import AIFailureStatusCard, { type AIFailingProvider } from '@/components/AIFailureStatusCard';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
import DeploymentLink from '@/components/DeploymentLink';
import { useNotifications } from '@/hooks/useNotifications';
import { formatBytes, formatUptime, formatRelativeTime } from '@/utils';

type AIAuditEvent = {
  id: string;
  type: string;
  provider: string;
  message: string;
  createdAt: number;
  details?: {
    changedFields?: string[];
    clearedFields?: string[];
    status?: string;
  };
};

const AI_PROVIDER_DEFAULT_FIELDS: Record<string, { baseURL?: string; defaultModel?: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4-turbo-preview' },
  anthropic: { baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-sonnet-20240229' },
  google: { baseURL: 'https://generativelanguage.googleapis.com/v1', defaultModel: 'gemini-1.5-pro' },
  local: { baseURL: 'http://localhost:11434', defaultModel: 'codellama:34b' },
  cloud: { defaultModel: 'auto' },
};

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
  const [switchingToCloud, setSwitchingToCloud] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [aiForms, setAiForms] = useState<Record<string, { apiKey: string; baseURL: string; defaultModel: string }>>({});
  const [confirmClearProvider, setConfirmClearProvider] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useNotifications();

  const authHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

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

  const { data: aiHealthData } = useQuery({
    queryKey: ['ai-health-command-center'],
    queryFn: async () => {
      const res = await fetch('/api/ai/health', { headers: authHeaders() });
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: aiKeysData } = useQuery({
    queryKey: ['ai-keys-command-center'],
    queryFn: async () => {
      const res = await fetch('/api/ai/keys', { headers: authHeaders() });
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: aiAuditData } = useQuery({
    queryKey: ['ai-audit-command-center'],
    queryFn: async () => {
      const res = await fetch('/api/ai/audit', { headers: authHeaders() });
      return res.json();
    },
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
  const aiProviders = aiHealthData?.data?.providers ?? [];
  const aiKeyRecords = aiKeysData?.data ?? {};
  const aiAuditEvents: AIAuditEvent[] = aiAuditData?.data ?? [];
  const failingAiProviders: AIFailingProvider[] = aiProviders
    .filter((provider: any) => !provider.health?.healthy && provider.health?.status !== 'missing_credentials')
    .map((provider: any) => ({
      id: provider.id,
      name: provider.name,
      status: provider.health?.status,
      message: provider.health?.message,
    }));

  React.useEffect(() => {
    if (!aiKeysData?.data) return;
    setAiForms((current) => {
      const next = { ...current };
      for (const [providerId, record] of Object.entries(aiKeyRecords as Record<string, any>)) {
        if (!next[providerId]) {
          next[providerId] = {
            apiKey: '',
            baseURL: (record as any).fields?.baseURL ?? '',
            defaultModel: (record as any).fields?.defaultModel ?? '',
          };
        }
      }
      return next;
    });
  }, [aiKeysData?.data]);

  // Stats
  const onlineCount = processes.filter(p => p.status === 'online').length;
  const erroredCount = processes.filter(p => p.status === 'errored').length;
  const runningContainers = containers.filter(c => c.status?.startsWith('Up')).length;

  const switchToCloud = async () => {
    const token = localStorage.getItem('dashboard_token');
    if (!token) return;

    try {
      setSwitchingToCloud(true);
      const res = await fetch('/api/ai/providers/cloud', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to switch to Cloud');
      queryClient.invalidateQueries({ queryKey: ['ai-health-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
    } finally {
      setSwitchingToCloud(false);
    }
  };

  const saveAIProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const form = aiForms[providerId] ?? { apiKey: '', baseURL: '', defaultModel: '' };
      const values: Record<string, string> = {
        baseURL: form.baseURL ?? '',
        defaultModel: form.defaultModel ?? '',
      };
      if ((form.apiKey ?? '').trim()) values.apiKey = form.apiKey.trim();

      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ provider: providerId, values }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save provider settings');
      return data;
    },
    onSuccess: (_data, providerId) => {
      setAiForms((current) => ({
        ...current,
        [providerId]: {
          ...current[providerId],
          apiKey: '',
        },
      }));
      notify({ type: 'success', title: `${providerId} settings updated` });
      queryClient.invalidateQueries({ queryKey: ['ai-health-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Failed to update AI provider', message: error.message });
    },
  });

  const clearAIProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/ai/keys/${providerId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to clear provider');
      return data;
    },
    onSuccess: (_data, providerId) => {
      setAiForms((current) => ({
        ...current,
        [providerId]: { apiKey: '', baseURL: '', defaultModel: '' },
      }));
      setConfirmClearProvider(null);
      notify({ type: 'warning', title: `${providerId} credentials cleared` });
      queryClient.invalidateQueries({ queryKey: ['ai-health-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Failed to clear AI provider', message: error.message });
    },
  });

  const testAIProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch('/api/ai/health/check', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ providers: [providerId] }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Health check failed');
      return data;
    },
    onSuccess: (_data, providerId) => {
      notify({ type: 'info', title: `Checked ${providerId}` });
      queryClient.invalidateQueries({ queryKey: ['ai-health-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Provider test failed', message: error.message });
    },
  });

  const activateAIProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/ai/providers/${providerId}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to activate provider');
      return data;
    },
    onSuccess: (_data, providerId) => {
      notify({ type: 'success', title: `${providerId} is now active` });
      queryClient.invalidateQueries({ queryKey: ['ai-health-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Provider activation failed', message: error.message });
    },
  });

  const resetAIFieldMutation = useMutation({
    mutationFn: async ({ providerId, field }: { providerId: string; field: 'baseURL' | 'defaultModel' }) => {
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ provider: providerId, removeFields: [field] }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || `Failed to reset ${field}`);
      return { providerId, field };
    },
    onSuccess: ({ providerId, field }) => {
      const defaults = AI_PROVIDER_DEFAULT_FIELDS[providerId] || {};
      setAiForms((current) => ({
        ...current,
        [providerId]: {
          apiKey: current[providerId]?.apiKey ?? '',
          baseURL: field === 'baseURL' ? (defaults.baseURL ?? '') : (current[providerId]?.baseURL ?? ''),
          defaultModel: field === 'defaultModel' ? (defaults.defaultModel ?? '') : (current[providerId]?.defaultModel ?? ''),
        },
      }));
      notify({ type: 'info', title: `${providerId} ${field} reset` });
      queryClient.invalidateQueries({ queryKey: ['ai-health-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit-command-center'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Field reset failed', message: error.message });
    },
  });

  const updateAIForm = (providerId: string, field: 'apiKey' | 'baseURL' | 'defaultModel', value: string) => {
    setAiForms((current) => ({
      ...current,
      [providerId]: {
        apiKey: current[providerId]?.apiKey ?? '',
        baseURL: current[providerId]?.baseURL ?? '',
        defaultModel: current[providerId]?.defaultModel ?? '',
        [field]: value,
      },
    }));
  };

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
      message: `${erroredCount} runtime process${erroredCount > 1 ? 'es' : ''} have errors`,
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

      {failingAiProviders.length > 0 && (
        <AIFailureStatusCard
          providers={failingAiProviders}
          switchingToCloud={switchingToCloud}
          onOpenSettings={() => navigate('/ai-settings')}
          onSwitchToCloud={switchToCloud}
          compact
        />
      )}

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Key size={16} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-dark-100">AI Credential Activity</h2>
          </div>
          {aiAuditEvents.length === 0 ? (
            <p className="text-sm text-dark-500">No AI credential activity recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {aiAuditEvents.slice(0, 8).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-dark-100">
                      <span className="font-medium">{entry.provider}</span>
                      <span className="text-dark-500"> · {entry.type}</span>
                    </div>
                    <span className={`text-xs ${
                      entry.type === 'provider-switch' || entry.type === 'credential-replaced'
                        ? 'text-green-400'
                        : entry.type === 'credentials-cleared'
                          ? 'text-yellow-400'
                          : entry.type === 'health-check'
                            ? 'text-blue-400'
                            : 'text-red-400'
                    }`}>
                      {entry.details?.status || entry.type}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-dark-400">{entry.message}</div>
                  <div className="mt-1 text-[11px] text-dark-500">{formatRelativeTime(entry.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-dark-100">Session Safety</h2>
          </div>
          <div className="space-y-2 text-sm text-dark-400">
            <p>`Save / Replace` updates credentials live and persists them for future sessions.</p>
            <p>`Clear` now requires confirmation before removing stored keys or provider settings.</p>
            <p>`Test` checks the provider immediately so users can verify replacements during the session.</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3 gap-3">
          <div>
            <h2 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1">
              AI Credentials
            </h2>
            <p className="text-sm text-dark-400">
              Change, replace, test, activate, or clear AI keys and provider settings live during the session.
            </p>
          </div>
          <button
            onClick={() => navigate('/ai-settings')}
            className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
          >
            Full AI Settings
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(aiKeyRecords as Record<string, any>).map(([providerId, record]) => {
            const providerHealth = aiProviders.find((provider: any) => provider.id === providerId)?.health;
            const isActive = aiProviders.find((provider: any) => provider.id === providerId)?.isActive;
            return (
              <div key={providerId} className="rounded-xl border border-dark-700 bg-dark-900 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bot size={16} className="text-cyan-400" />
                      <h3 className="text-base font-semibold text-dark-100">{record.name}</h3>
                      {isActive ? <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">Active</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-dark-500">
                      {(record.envVars?.apiKey ?? []).concat(record.envVars?.baseURL ?? [], record.envVars?.defaultModel ?? []).join(' · ') || 'No editable env vars'}
                    </p>
                  </div>
                  <div className={`rounded-lg border px-2 py-1 text-xs ${
                    providerHealth?.healthy
                      ? 'border-green-500/30 bg-green-500/10 text-green-300'
                      : providerHealth?.status === 'missing_credentials'
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                        : 'border-red-500/30 bg-red-500/10 text-red-300'
                  }`}>
                    {providerHealth?.healthy ? 'Healthy' : providerHealth?.status || 'Unknown'}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-dark-500">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type={showSecrets[providerId] ? 'text' : 'password'}
                        value={aiForms[providerId]?.apiKey ?? ''}
                        onChange={(e) => updateAIForm(providerId, 'apiKey', e.target.value)}
                        placeholder={record.hasStoredSecret ? 'Enter new key to replace stored secret' : 'Enter key'}
                        className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100"
                        disabled={!record.envVars?.apiKey?.length}
                      />
                      {record.envVars?.apiKey?.length ? (
                        <button
                          onClick={() => setShowSecrets((current) => ({ ...current, [providerId]: !current[providerId] }))}
                          className="rounded-lg border border-dark-700 bg-dark-800 px-3 text-dark-300 hover:bg-dark-700"
                        >
                          {showSecrets[providerId] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-dark-500">Base URL</label>
                    <input
                      type="text"
                      value={aiForms[providerId]?.baseURL ?? ''}
                      onChange={(e) => updateAIForm(providerId, 'baseURL', e.target.value)}
                      className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100"
                      disabled={!record.envVars?.baseURL?.length}
                    />
                    {record.envVars?.baseURL?.length ? (
                      <button
                        onClick={() => resetAIFieldMutation.mutate({ providerId, field: 'baseURL' })}
                        disabled={resetAIFieldMutation.isPending}
                        className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        Reset base URL
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-dark-500">Default Model</label>
                    <input
                      type="text"
                      value={aiForms[providerId]?.defaultModel ?? ''}
                      onChange={(e) => updateAIForm(providerId, 'defaultModel', e.target.value)}
                      className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100"
                    />
                    <button
                      onClick={() => resetAIFieldMutation.mutate({ providerId, field: 'defaultModel' })}
                      disabled={resetAIFieldMutation.isPending}
                      className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Reset model
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-dark-800 px-3 py-2 text-xs text-dark-400">
                  {providerHealth?.message || 'No provider health detail available yet.'}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => saveAIProviderMutation.mutate(providerId)}
                    disabled={saveAIProviderMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500"
                  >
                    <Save size={14} />
                    Save / Replace
                  </button>
                  <button
                    onClick={() => testAIProviderMutation.mutate(providerId)}
                    disabled={testAIProviderMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
                  >
                    <RefreshCw size={14} className={testAIProviderMutation.isPending ? 'animate-spin' : ''} />
                    Test
                  </button>
                  <button
                    onClick={() => activateAIProviderMutation.mutate(providerId)}
                    disabled={activateAIProviderMutation.isPending || isActive}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    <Key size={14} />
                    {isActive ? 'Active' : 'Make Active'}
                  </button>
                  <button
                    onClick={() => setConfirmClearProvider(providerId)}
                    disabled={clearAIProviderMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                </div>
                {confirmClearProvider === providerId && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3">
                    <div className="text-sm font-medium text-red-200">Clear stored credentials for {record.name}?</div>
                    <div className="mt-1 text-xs text-red-200/80">
                      This removes the saved key and editable provider settings from the active session and persisted config.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => clearAIProviderMutation.mutate(providerId)}
                        disabled={clearAIProviderMutation.isPending}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-60"
                      >
                        {clearAIProviderMutation.isPending ? 'Clearing…' : 'Yes, clear it'}
                      </button>
                      <button
                        onClick={() => setConfirmClearProvider(null)}
                        className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

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
            title="Runtime Processes"
            icon={Activity}
            status={processes.length === 0 ? 'neutral' : erroredCount > 0 ? 'error' : onlineCount === processes.length ? 'online' : 'warning'}
            count={onlineCount}
            subtext={processes.length === 0 ? 'No PM2-managed apps detected' : `${processes.length} total · ${erroredCount} errored`}
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
            Runtime Deployments
          </h2>
          <a href="/pm2" className="text-xs text-primary-400 hover:text-primary-300">View Runtime →</a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProcesses.map(p => (
            <ProcessMiniCard key={p.pm_id} process={p} />
          ))}
        </div>

        {filteredProcesses.length === 0 && searchQuery && (
          <p className="text-dark-500 text-sm text-center py-8">
            No runtime processes matching "{searchQuery}"
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
            placeholder="Search services, containers, repos..."
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
