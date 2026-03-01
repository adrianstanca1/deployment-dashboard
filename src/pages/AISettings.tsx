import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertCircle, Bell, BellOff, Bot, Check, Cpu, Database, Eye, EyeOff,
  FileCode, GitBranch, Globe, Key, RefreshCw, Save, Server, Settings,
  Terminal, Trash2, Wrench, Zap
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { usePreferences } from '@/hooks/usePreferences';

interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
}

interface Tool {
  name: string;
  description: string;
  input_schema: {
    properties?: Record<string, unknown>;
  };
}

interface ProviderHealth {
  healthy: boolean;
  status: string;
  message: string;
  lastCheckedAt: number;
  lastFailureAt?: number | null;
  lastRecoveryAt?: number | null;
  lastHealthyAt?: number | null;
  consecutiveFailures?: number;
}

interface ProviderRecord {
  id: string;
  name: string;
  enabled: boolean;
  defaultModel: string;
  baseURL?: string | null;
  models: string[];
  isActive: boolean;
  health: ProviderHealth;
  credentialsMissing: string[];
}

interface ProviderKeyRecord {
  provider: string;
  name: string;
  configured: boolean;
  hasStoredSecret?: boolean;
  fields: {
    apiKey?: string;
    baseURL?: string;
    defaultModel?: string;
  };
  envVars: {
    apiKey?: string[];
    baseURL?: string[];
    defaultModel?: string[];
  };
  health: ProviderHealth;
  essentialFields: string[];
}

interface AIAlert {
  id: string;
  provider: string;
  level: 'info' | 'error';
  message: string;
  createdAt: number;
  details?: { message?: string };
}

interface AIAuditEvent {
  id: string;
  type: string;
  provider: string;
  actor: string;
  message: string;
  createdAt: number;
  details?: {
    changedFields?: string[];
    clearedFields?: string[];
    previousProvider?: string;
    nextProvider?: string;
    reason?: string;
    status?: string;
    providers?: Array<{
      provider?: string;
      healthy?: boolean;
      status?: string;
      message?: string;
    }>;
  };
}

type TabId = 'providers' | 'credentials' | 'agents' | 'tools';

function formatTime(value?: number | null) {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}

function healthTone(health?: ProviderHealth) {
  if (!health) return 'text-dark-500 border-dark-700 bg-dark-800';
  if (health.healthy) return 'text-green-400 border-green-500/30 bg-green-500/10';
  if (health.status === 'missing_credentials') return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  if (['configuration_error', 'invalid_base_url', 'rate_limited'].includes(health.status)) {
    return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  }
  if (['invalid_credentials', 'access_denied'].includes(health.status)) {
    return 'text-orange-300 border-orange-500/30 bg-orange-500/10';
  }
  return 'text-red-400 border-red-500/30 bg-red-500/10';
}

function healthLabel(health?: ProviderHealth) {
  if (!health) return 'Unknown';
  if (health.healthy) return 'Healthy';

  const labels: Record<string, string> = {
    missing_credentials: 'Missing credentials',
    configuration_error: 'Config error',
    invalid_credentials: 'Invalid credentials',
    access_denied: 'Access denied',
    invalid_base_url: 'Bad base URL',
    rate_limited: 'Rate limited',
    provider_unavailable: 'Provider unavailable',
    timeout: 'Timed out',
    unreachable: 'Unreachable',
  };

  return labels[health.status] || 'Failing';
}

function healthGuidance(health?: ProviderHealth) {
  if (!health || health.healthy) return '';

  const guidance: Record<string, string> = {
    missing_credentials: 'Add the missing credential fields before making this provider active.',
    configuration_error: 'Check the selected model name, API base URL, and any provider-specific gateway settings.',
    invalid_credentials: 'Replace the stored API key or token for this provider.',
    access_denied: 'Verify the key permissions, project restrictions, and enabled APIs for this provider.',
    invalid_base_url: 'Correct the provider base URL or reset it to the default endpoint.',
    rate_limited: 'Try again later or switch the active provider while this limit clears.',
    provider_unavailable: 'The upstream provider is returning server errors; use a fallback provider for now.',
    timeout: 'The provider is too slow to respond from this host; retry or use a fallback.',
    unreachable: 'The dashboard host cannot reach this provider endpoint; check networking or local service status.',
  };

  return guidance[health.status] || '';
}

export default function AISettings() {
  const queryClient = useQueryClient();
  const { notify } = useNotifications();
  const { prefs, update, toggleAgent } = usePreferences();
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [forms, setForms] = useState<Record<string, { apiKey: string; baseURL: string; defaultModel: string }>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [delegateTask, setDelegateTask] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [delegateResult, setDelegateResult] = useState<string | null>(null);
  const [pullModelName, setPullModelName] = useState('');
  const [pullProgress, setPullProgress] = useState<string | null>(null);

  const authHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const pullModel = async () => {
    if (!pullModelName.trim()) return;
    setPullProgress('Starting download...');
    try {
      const res = await fetch('/api/ai/ollama/pull', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: pullModelName.trim() }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.status) setPullProgress(obj.status + (obj.completed ? ` ${Math.round(obj.completed / 1e6)}MB` : ''));
            if (obj.error) setPullProgress(`Error: ${obj.error}`);
          } catch { /* ignore partial json */ }
        }
      }
      setPullProgress('Done');
      refetchOllamaModels();
      setPullModelName('');
      setTimeout(() => setPullProgress(null), 3000);
    } catch (err: unknown) {
      setPullProgress(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const downloadAuditLog = async () => {
    const res = await fetch('/api/ai/audit/export', { headers: authHeaders() });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-audit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const { data: providersResponse } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      const res = await fetch('/api/ai/providers', { headers: authHeaders() });
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: healthResponse } = useQuery({
    queryKey: ['ai-health'],
    queryFn: async () => {
      const res = await fetch('/api/ai/health', { headers: authHeaders() });
      return res.json();
    },
    refetchInterval: prefs.muteAIAlerts ? false : 10000,
  });

  const { data: keysResponse } = useQuery({
    queryKey: ['ai-keys'],
    queryFn: async () => {
      const res = await fetch('/api/ai/keys', { headers: authHeaders() });
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: auditResponse } = useQuery({
    queryKey: ['ai-audit'],
    queryFn: async () => {
      const res = await fetch('/api/ai/audit', { headers: authHeaders() });
      return res.json();
    },
    refetchInterval: prefs.muteAIAlerts ? false : 10000,
  });

  const { data: ollamaModelsResponse, refetch: refetchOllamaModels } = useQuery({
    queryKey: ['ollama-models'],
    queryFn: async () => {
      const res = await fetch('/api/ai/ollama/models', { headers: authHeaders() });
      return res.json();
    },
    staleTime: 30000,
  });

  const ollamaModels: Array<{ name: string; sizeGB: string; modified: string }> =
    ollamaModelsResponse?.data ?? [];

  const { data: agentsResponse } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const res = await fetch('/api/ai/agents', { headers: authHeaders() });
      return res.json();
    },
    retry: false,
    staleTime: 60000,
  });

  const { data: toolsResponse } = useQuery({
    queryKey: ['ai-tools'],
    queryFn: async () => {
      const res = await fetch('/api/ai/tools', { headers: authHeaders() });
      return res.json();
    },
    retry: false,
    staleTime: 60000,
  });

  const providers: ProviderRecord[] = providersResponse?.data ?? [];
  const providerKeys = (keysResponse?.data ?? {}) as Record<string, ProviderKeyRecord>;
  const alerts: AIAlert[] = healthResponse?.data?.alerts ?? [];
  const auditEvents: AIAuditEvent[] = auditResponse?.data ?? healthResponse?.data?.audit ?? [];
  const agents: Agent[] = agentsResponse?.agents ?? agentsResponse?.data ?? [];
  const tools: Tool[] = toolsResponse?.tools ?? toolsResponse?.data ?? [];

  useEffect(() => {
    if (!keysResponse?.data) return;
    setForms((current) => {
      const next = { ...current };
      for (const [provider, record] of Object.entries(providerKeys)) {
        if (!next[provider]) {
          next[provider] = {
            apiKey: '',
            baseURL: record.fields.baseURL ?? '',
            defaultModel: record.fields.defaultModel ?? '',
          };
        }
      }
      return next;
    });
  }, [keysResponse?.data]);

  const providerMap = useMemo(() => {
    return providers.reduce<Record<string, ProviderRecord>>((acc, provider) => {
      acc[provider.id] = provider;
      return acc;
    }, {});
  }, [providers]);

  const saveMutation = useMutation({
    mutationFn: async (provider: string) => {
      const providerForm = forms[provider] ?? {};
      const values: Record<string, string> = {
        baseURL: providerForm.baseURL ?? '',
        defaultModel: providerForm.defaultModel ?? '',
      };
      if ((providerForm.apiKey ?? '').trim()) {
        values.apiKey = providerForm.apiKey.trim();
      }
      const body = {
        provider,
        values,
      };
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save provider settings');
      return data;
    },
    onSuccess: (_data, provider) => {
      notify({ type: 'success', title: `${providerMap[provider]?.name || provider} settings saved` });
      setForms((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          apiKey: '',
        },
      }));
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Failed to save AI settings', message: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch(`/api/ai/keys/${provider}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to clear provider settings');
      return data;
    },
    onSuccess: (_data, provider) => {
      notify({ type: 'warning', title: `${providerMap[provider]?.name || provider} credentials cleared` });
      setForms((current) => ({
        ...current,
        [provider]: { apiKey: '', baseURL: '', defaultModel: '' },
      }));
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Failed to clear provider', message: error.message });
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch(`/api/ai/providers/${provider}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to switch provider');
      return data;
    },
    onSuccess: (data, provider) => {
      notify({
        type: data.data?.warning ? 'warning' : 'success',
        title: `${providerMap[provider]?.name || provider} is now active`,
        message: data.data?.warning,
      });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Failed to activate provider', message: error.message });
    },
  });

  const checkMutation = useMutation({
    mutationFn: async (provider?: string) => {
      const res = await fetch('/api/ai/health/check', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(provider ? { providers: [provider] } : {}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Health check failed');
      return data;
    },
    onSuccess: (_data, provider) => {
      notify({ type: 'info', title: provider ? `Checked ${providerMap[provider]?.name || provider}` : 'Checked all AI providers' });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
      queryClient.invalidateQueries({ queryKey: ['ai-health'] });
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      queryClient.invalidateQueries({ queryKey: ['ai-audit'] });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Provider health check failed', message: error.message });
    },
  });

  const delegateMutation = useMutation({
    mutationFn: async ({ agentId, task }: { agentId: string; task: string }) => {
      const res = await fetch('/api/ai/delegate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ agentId, task }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delegation failed');
      return data;
    },
    onSuccess: (data) => {
      setDelegateResult(data.response || data.data?.response || 'Task completed');
      notify({ type: 'success', title: 'Agent task completed' });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Agent task failed', message: error.message });
    },
  });

  const updateForm = (provider: string, field: 'apiKey' | 'baseURL' | 'defaultModel', value: string) => {
    setForms((current) => ({
      ...current,
      [provider]: {
        apiKey: current[provider]?.apiKey ?? '',
        baseURL: current[provider]?.baseURL ?? '',
        defaultModel: current[provider]?.defaultModel ?? '',
        [field]: value,
      },
    }));
  };

  const getAgentIcon = (agentId: string) => {
    if (agentId.includes('pm2')) return <Server size={16} />;
    if (agentId.includes('git')) return <GitBranch size={16} />;
    if (agentId.includes('docker')) return <Activity size={16} />;
    if (agentId.includes('file')) return <FileCode size={16} />;
    if (agentId.includes('system')) return <Cpu size={16} />;
    if (agentId.includes('db')) return <Database size={16} />;
    return <Bot size={16} />;
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'providers', label: 'Providers', icon: Globe },
    { id: 'credentials', label: 'Credentials', icon: Key },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'tools', label: 'Tools', icon: Terminal },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-dark-800 bg-dark-900 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
              <Settings className="text-cyan-400" size={28} />
              AI Settings
            </h1>
            <p className="text-dark-400 mt-1">Read and write provider credentials live, test them, and recover from failures during active sessions.</p>
          </div>
          <button
            onClick={() => checkMutation.mutate(undefined)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-200"
          >
            <RefreshCw size={16} className={checkMutation.isPending ? 'animate-spin' : ''} />
            Check All
          </button>
        </div>
      </div>

      <div className="border-b border-dark-800 bg-dark-900 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-dark-400 hover:text-dark-200'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="rounded-xl border border-dark-800 bg-dark-900 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-dark-200">
              <AlertCircle size={16} className="text-yellow-400" />
              Recent AI Alerts
            </div>
            <button
              onClick={() => update({ muteAIAlerts: !prefs.muteAIAlerts })}
              title={prefs.muteAIAlerts ? 'AI alerts muted — click to unmute' : 'Mute AI alerts'}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                prefs.muteAIAlerts
                  ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                  : 'border-dark-700 bg-dark-800 text-dark-400 hover:text-dark-200'
              }`}
            >
              {prefs.muteAIAlerts ? <BellOff size={12} /> : <Bell size={12} />}
              {prefs.muteAIAlerts ? 'Unmute alerts' : 'Mute alerts'}
            </button>
          </div>
          {prefs.muteAIAlerts ? (
            <p className="text-sm text-dark-500">AI alerts are muted.</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-dark-500">No recent AI provider alerts.</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className={`rounded-lg border px-3 py-2 text-sm ${alert.level === 'info' ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-xs opacity-80">{alert.details?.message || 'No extra detail'} · {formatTime(alert.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-dark-800 bg-dark-900 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-dark-200">
              <Key size={16} className="text-cyan-400" />
              Credential Audit Trail
            </div>
            <button
              onClick={downloadAuditLog}
              className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-1.5 text-xs text-dark-200 hover:bg-dark-700"
            >
              Export JSON
            </button>
          </div>
          {auditEvents.length === 0 ? (
            <p className="text-sm text-dark-500">No AI credential or provider changes have been recorded in this session.</p>
          ) : (
            <div className="space-y-2">
              {auditEvents.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm">
                  <div className="font-medium text-dark-100">{event.message}</div>
                  <div className="mt-1 text-xs text-dark-400">
                    {event.details?.changedFields?.length ? `Fields: ${event.details.changedFields.join(', ')} · ` : ''}
                    {event.details?.clearedFields?.length ? `Cleared: ${event.details.clearedFields.join(', ')} · ` : ''}
                    {event.details?.reason ? `${event.details.reason} · ` : ''}
                    {event.details?.status ? `${event.details.status} · ` : ''}
                    {formatTime(event.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'providers' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {providers.map((provider) => (
              <div key={provider.id} className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Globe size={18} className="text-cyan-400" />
                      <h2 className="text-lg font-semibold text-dark-100">{provider.name}</h2>
                      {provider.isActive && <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-400">Active</span>}
                    </div>
                    <p className="mt-1 text-sm text-dark-400">{provider.baseURL || 'Managed internally by the dashboard'}</p>
                  </div>
                  <div className={`rounded-lg border px-2 py-1 text-xs ${healthTone(provider.health)}`}>
                    {healthLabel(provider.health)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-dark-800 px-3 py-2">
                    <div className="text-dark-500">Model</div>
                    <div className="mt-1 text-dark-100">{provider.defaultModel || 'unset'}</div>
                  </div>
                  <div className="rounded-lg bg-dark-800 px-3 py-2">
                    <div className="text-dark-500">Last check</div>
                    <div className="mt-1 text-dark-100">{formatTime(provider.health?.lastCheckedAt)}</div>
                  </div>
                  <div className="rounded-lg bg-dark-800 px-3 py-2">
                    <div className="text-dark-500">Last success</div>
                    <div className="mt-1 text-dark-100">{formatTime(provider.health?.lastHealthyAt)}</div>
                  </div>
                  <div className="rounded-lg bg-dark-800 px-3 py-2">
                    <div className="text-dark-500">Last recovery</div>
                    <div className="mt-1 text-dark-100">{formatTime(provider.health?.lastRecoveryAt)}</div>
                  </div>
                </div>

                <div className="rounded-lg bg-dark-800 px-3 py-2 text-sm">
                  <div className="text-dark-500">Health detail</div>
                  <div className="mt-1 text-dark-100">{provider.health?.message || 'No data yet'}</div>
                  {healthGuidance(provider.health) && (
                    <div className="mt-2 text-xs text-dark-400">{healthGuidance(provider.health)}</div>
                  )}
                  {provider.credentialsMissing.length > 0 && (
                    <div className="mt-1 text-yellow-400 text-xs">Missing: {provider.credentialsMissing.join(', ')}</div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => switchMutation.mutate(provider.id)}
                    disabled={!provider.enabled || switchMutation.isPending}
                    className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-dark-700 disabled:text-dark-500"
                  >
                    {provider.isActive ? 'Active' : 'Make Active'}
                  </button>
                  <button
                    onClick={() => checkMutation.mutate(provider.id)}
                    disabled={checkMutation.isPending}
                    className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
                  >
                    Test Connection
                  </button>
                </div>

                {provider.id === 'local' && (
                  <div className="border-t border-dark-700 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-dark-400 uppercase tracking-wide">Installed Models</span>
                      <button onClick={() => refetchOllamaModels()} className="flex items-center gap-1 text-xs text-dark-500 hover:text-dark-300 transition-colors">
                        <RefreshCw size={11} /> Refresh
                      </button>
                    </div>
                    {ollamaModels.length === 0 ? (
                      <p className="text-xs text-dark-600 italic">No local models found</p>
                    ) : (
                      <div className="space-y-1.5">
                        {ollamaModels.map((m) => (
                          <div key={m.name} className="flex items-center justify-between rounded-lg bg-dark-800 px-3 py-2 text-xs">
                            <span className="font-mono text-dark-200">{m.name}</span>
                            <span className="text-dark-500">{m.sizeGB} GB</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={pullModelName}
                        onChange={(e) => setPullModelName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && pullModel()}
                        placeholder="e.g. gemma3:4b, llama3.2:3b"
                        className="flex-1 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-xs text-dark-200 placeholder-dark-600 focus:border-cyan-500 focus:outline-none"
                      />
                      <button
                        onClick={pullModel}
                        disabled={!pullModelName.trim()}
                        className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Pull
                      </button>
                    </div>
                    {pullProgress && (
                      <p className="text-xs font-mono text-cyan-400">{pullProgress}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'credentials' && (
          <div className="space-y-4">
            {Object.entries(providerKeys).map(([providerId, record]) => (
              <div key={providerId} className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-dark-100">{record.name}</h2>
                    <p className="text-sm text-dark-400">
                      Changes are written immediately to the backend runtime and persisted for future sessions.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-dark-500">
                      {[...(record.envVars.apiKey ?? []), ...(record.envVars.baseURL ?? []), ...(record.envVars.defaultModel ?? [])].map((envVar) => (
                        <span key={envVar} className="rounded bg-dark-800 px-2 py-0.5">{envVar}</span>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-lg border px-2 py-1 text-xs ${healthTone(record.health)}`}>
                    {healthLabel(record.health)}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-dark-500">API Credential</label>
                    <div className="flex gap-2">
                      <input
                        type={showSecrets[providerId] ? 'text' : 'password'}
                        value={forms[providerId]?.apiKey ?? ''}
                        onChange={(e) => updateForm(providerId, 'apiKey', e.target.value)}
                        placeholder={record.hasStoredSecret ? 'Enter a new key to replace the stored secret' : (record.essentialFields.includes('apiKey') ? 'Required' : 'Optional')}
                        className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100"
                        disabled={!record.envVars.apiKey?.length}
                      />
                      {record.envVars.apiKey?.length ? (
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
                    <label className="mb-1 block text-xs text-dark-500">Base URL / Gateway</label>
                    <input
                      type="text"
                      value={forms[providerId]?.baseURL ?? ''}
                      onChange={(e) => updateForm(providerId, 'baseURL', e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100"
                      disabled={!record.envVars.baseURL?.length}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-dark-500">Default Model</label>
                    <input
                      type="text"
                      value={forms[providerId]?.defaultModel ?? ''}
                      onChange={(e) => updateForm(providerId, 'defaultModel', e.target.value)}
                      placeholder="model name"
                      className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => saveMutation.mutate(providerId)}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500"
                  >
                    <Save size={14} />
                    Save / Replace
                  </button>
                  <button
                    onClick={() => checkMutation.mutate(providerId)}
                    disabled={checkMutation.isPending}
                    className="flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
                  >
                    <Zap size={14} />
                    Test
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(providerId)}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                </div>
                {healthGuidance(record.health) && (
                  <p className="text-xs text-dark-400">{healthGuidance(record.health)}</p>
                )}
                {record.hasStoredSecret && (
                  <p className="text-xs text-dark-500">
                    A secret is already stored for this provider. Leave the credential field empty to keep it unchanged, or click `Clear` to remove it.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => {
                const isDisabled = prefs.disabledAgents.includes(agent.id);
                return (
                  <div key={agent.id} className={`rounded-xl border bg-dark-900 p-4 transition-opacity ${isDisabled ? 'border-dark-800 opacity-50' : 'border-dark-800'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-lg bg-dark-800 p-2 ${isDisabled ? 'text-dark-600' : 'text-cyan-400'}`}>{getAgentIcon(agent.id)}</div>
                        <div>
                          <div className="font-medium text-dark-100">{agent.name}</div>
                          <div className="text-xs text-dark-500">{agent.tools.length} tools</div>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none" title={isDisabled ? 'Enable agent' : 'Disable agent'}>
                        <span className="text-xs text-dark-500">{isDisabled ? 'Off' : 'On'}</span>
                        <div
                          onClick={() => toggleAgent(agent.id)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${isDisabled ? 'bg-dark-700' : 'bg-cyan-600'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isDisabled ? 'left-0.5' : 'left-4'}`} />
                        </div>
                      </label>
                    </div>
                    <p className="mt-3 text-sm text-dark-400">{agent.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-4">
              <div className="flex items-center gap-2 text-dark-100">
                <Wrench size={16} className="text-cyan-400" />
                Delegate Task
              </div>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-dark-100"
              >
                <option value="">Choose an agent...</option>
                {agents.filter(a => !prefs.disabledAgents.includes(a.id)).map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
              <textarea
                value={delegateTask}
                onChange={(e) => setDelegateTask(e.target.value)}
                placeholder="Describe the task..."
                className="h-28 w-full resize-none rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-dark-100"
              />
              <button
                onClick={() => delegateMutation.mutate({ agentId: selectedAgent, task: delegateTask })}
                disabled={!selectedAgent || !delegateTask || delegateMutation.isPending}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-dark-700 disabled:text-dark-500"
              >
                {delegateMutation.isPending ? 'Working…' : 'Run Agent'}
              </button>
              {delegateResult && (
                <pre className="rounded-lg border border-dark-700 bg-dark-800 p-3 text-sm text-dark-100 whitespace-pre-wrap">{delegateResult}</pre>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="grid gap-3 md:grid-cols-2">
            {tools.map((tool) => (
              <div key={tool.name} className="rounded-xl border border-dark-800 bg-dark-900 p-4">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-cyan-400" />
                  <span className="font-medium text-dark-100">{tool.name}</span>
                </div>
                <p className="mt-2 text-sm text-dark-400">{tool.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {Object.keys(tool.input_schema?.properties ?? {}).slice(0, 5).map((param) => (
                    <span key={param} className="rounded bg-dark-800 px-2 py-0.5 text-xs text-dark-400">{param}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
