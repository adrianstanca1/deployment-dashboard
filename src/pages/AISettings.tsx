import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key, Settings, Server, Bot, Check, X, RefreshCw, Save, Trash2,
  Plus, ChevronDown, ChevronUp, ExternalLink, AlertCircle, Info,
  Cpu, Database, GitBranch, FileCode, Activity, Terminal, Globe
} from 'lucide-react';

interface APIKeyStatus {
  configured: boolean;
  envVar: string;
  value?: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
}

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  defaultModel: string;
  models: string[];
  isActive: boolean;
}

interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export default function AISettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'providers' | 'agents' | 'tools' | 'keys'>('providers');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [delegateTask, setDelegateTask] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [delegateResult, setDelegateResult] = useState<string | null>(null);

  // Fetch API keys status
  const { data: keysData, refetch: refetchKeys } = useQuery({
    queryKey: ['ai-keys'],
    queryFn: async () => {
      const res = await fetch('/api/ai/keys', { credentials: 'include' });
      return res.json();
    }
  });

  // Fetch providers
  const { data: providersData } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      const res = await fetch('/api/ai/providers');
      return res.json();
    }
  });

  // Fetch agents
  const { data: agentsData, refetch: refetchAgents } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const res = await fetch('/api/ai/agents');
      return res.json();
    }
  });

  // Fetch tools
  const { data: toolsData } = useQuery({
    queryKey: ['ai-tools'],
    queryFn: async () => {
      const res = await fetch('/api/ai/tools');
      return res.json();
    }
  });

  const [keyError, setKeyError] = useState<string | null>(null);

  // Update key mutation
  const updateKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey, baseURL }: { provider: string; apiKey?: string; baseURL?: string }) => {
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, apiKey, baseURL })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save key');
      return data;
    },
    onSuccess: () => {
      setKeyError(null);
      queryClient.invalidateQueries({ queryKey: ['ai-keys'] });
      setEditingKey(null);
      setNewKeyValue('');
    },
    onError: (err: Error) => {
      setKeyError(err.message);
    }
  });

  // Switch provider mutation
  const switchProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await fetch(`/api/ai/providers/${providerId}`, {
        method: 'POST',
        credentials: 'include'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
    }
  });

  // Delegate task mutation
  const delegateMutation = useMutation({
    mutationFn: async ({ agentId, task }: { agentId: string; task: string }) => {
      const res = await fetch('/api/ai/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ agentId, task })
      });
      return res.json();
    },
    onSuccess: (data) => {
      setDelegateResult(data.response || data.error || 'Task completed');
    }
  });

  const handleSaveKey = (provider: string) => {
    if (provider === 'ollama') {
      updateKeyMutation.mutate({ provider, baseURL: newKeyValue });
    } else {
      updateKeyMutation.mutate({ provider, apiKey: newKeyValue });
    }
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

  const tabs = [
    { id: 'providers', label: 'Providers', icon: Globe },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'tools', label: 'Tools', icon: Terminal },
    { id: 'keys', label: 'API Keys', icon: Key },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-dark-800 bg-dark-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-3">
              <Settings className="text-cyan-400" size={28} />
              AI Settings
            </h1>
            <p className="text-dark-400 mt-1">Configure AI providers, agents, and tools</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-800 bg-dark-900 px-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-dark-400 hover:text-dark-200'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="space-y-4">
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-4">
              <h3 className="text-lg font-semibold text-dark-100 mb-4">AI Providers</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {providersData?.data?.map((provider: Provider) => (
                  <div
                    key={provider.id}
                    className={`p-4 rounded-lg border transition-all ${
                      provider.isActive
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-dark-700 bg-dark-800 hover:border-dark-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Globe size={18} className={provider.enabled ? 'text-green-400' : 'text-dark-500'} />
                        <span className="font-medium text-dark-100">{provider.name}</span>
                      </div>
                      {provider.isActive && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-400 mb-3">
                      {provider.id === 'local' ? 'Ollama running locally' :
                       provider.id === 'cloud' ? 'Dashboard-managed cloud AI' :
                       provider.enabled ? 'Ready to use' : 'Not configured'}
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm text-dark-200"
                        value={provider.defaultModel}
                        disabled={!provider.enabled}
                      >
                        {provider.models?.map((model: string) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => switchProviderMutation.mutate(provider.id)}
                        disabled={provider.isActive || !provider.enabled}
                        className={`px-3 py-1 text-sm rounded ${
                          provider.isActive
                            ? 'bg-dark-700 text-dark-400 cursor-not-allowed'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                        }`}
                      >
                        {provider.isActive ? 'Active' : 'Switch'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-dark-900 rounded-lg border border-dark-800 p-4">
              <h3 className="text-lg font-semibold text-dark-100 mb-4">Tool Support by Provider</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left py-2 px-3 text-dark-400 font-medium">Provider</th>
                      <th className="text-left py-2 px-3 text-dark-400 font-medium">Function Calling</th>
                      <th className="text-left py-2 px-3 text-dark-400 font-medium">Tools Available</th>
                      <th className="text-left py-2 px-3 text-dark-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-dark-800">
                      <td className="py-2 px-3 text-dark-200">Anthropic (Claude)</td>
                      <td className="py-2 px-3 text-green-400">✓ Full</td>
                      <td className="py-2 px-3 text-dark-300">24 tools</td>
                      <td className="py-2 px-3">
                        <span className="text-green-400">Ready</span>
                      </td>
                    </tr>
                    <tr className="border-b border-dark-800">
                      <td className="py-2 px-3 text-dark-200">OpenAI</td>
                      <td className="py-2 px-3 text-green-400">✓ Full</td>
                      <td className="py-2 px-3 text-dark-300">24 tools</td>
                      <td className="py-2 px-3">
                        {providersData?.data?.find((p: Provider) => p.id === 'openai')?.enabled ? (
                          <span className="text-green-400">Ready</span>
                        ) : (
                          <span className="text-yellow-400">Configure API Key</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-dark-800">
                      <td className="py-2 px-3 text-dark-200">Google (Gemini)</td>
                      <td className="py-2 px-3 text-yellow-400">⚠ Limited</td>
                      <td className="py-2 px-3 text-dark-300">-</td>
                      <td className="py-2 px-3">
                        <span className="text-yellow-400">Coming Soon</span>
                      </td>
                    </tr>
                    <tr className="border-b border-dark-800">
                      <td className="py-2 px-3 text-dark-200">Local (Ollama)</td>
                      <td className="py-2 px-3 text-red-400">✗ None</td>
                      <td className="py-2 px-3 text-dark-300">Rule-based only</td>
                      <td className="py-2 px-3">
                        <span className="text-dark-400">Fallback mode</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-4">
              <h3 className="text-lg font-semibold text-dark-100 mb-4">Available Agents</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agentsData?.agents?.map((agent: Agent) => (
                  <div
                    key={agent.id}
                    className="p-4 rounded-lg border border-dark-700 bg-dark-800"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 rounded-lg bg-dark-700 text-cyan-400">
                        {getAgentIcon(agent.id)}
                      </div>
                      <span className="font-medium text-dark-100">{agent.name}</span>
                    </div>
                    <p className="text-sm text-dark-400 mb-3">{agent.description}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.tools.slice(0, 3).map((tool: string) => (
                        <span key={tool} className="px-2 py-0.5 text-xs rounded bg-dark-700 text-dark-300">
                          {tool}
                        </span>
                      ))}
                      {agent.tools.length > 3 && (
                        <span className="px-2 py-0.5 text-xs rounded bg-dark-700 text-dark-400">
                          +{agent.tools.length - 3}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedAgent(agent.id)}
                      className="w-full py-2 text-sm rounded bg-dark-700 hover:bg-dark-600 text-dark-200 transition-colors"
                    >
                      Use Agent
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Delegate Task Panel */}
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-4">
              <h3 className="text-lg font-semibold text-dark-100 mb-4">Delegate Task to Agent</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-2">Select Agent</label>
                  <select
                    value={selectedAgent || ''}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-dark-200"
                  >
                    <option value="">Choose an agent...</option>
                    {agentsData?.agents?.map((agent: Agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-2">Task Description</label>
                  <textarea
                    value={delegateTask}
                    onChange={(e) => setDelegateTask(e.target.value)}
                    placeholder="Describe what you want the agent to do..."
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-dark-200 h-24 resize-none"
                  />
                </div>
                <button
                  onClick={() => delegateMutation.mutate({ agentId: selectedAgent!, task: delegateTask })}
                  disabled={!selectedAgent || !delegateTask || delegateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-dark-700 disabled:text-dark-400 text-white rounded-lg transition-colors"
                >
                  {delegateMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Bot size={16} />}
                  Execute Task
                </button>
                {delegateResult && (
                  <div className="mt-4 p-4 bg-dark-800 rounded-lg border border-dark-700">
                    <h4 className="text-sm font-medium text-dark-300 mb-2">Result</h4>
                    <pre className="text-sm text-dark-200 whitespace-pre-wrap">{delegateResult}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <div className="space-y-4">
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-dark-100">Available Tools</h3>
                <span className="text-sm text-dark-400">{toolsData?.tools?.length || 0} tools</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {toolsData?.tools?.map((tool: Tool) => (
                  <div
                    key={tool.name}
                    className="p-3 rounded-lg border border-dark-700 bg-dark-800 hover:border-dark-600 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Terminal size={14} className="text-cyan-400" />
                      <span className="font-medium text-dark-200 text-sm">{tool.name}</span>
                    </div>
                    <p className="text-xs text-dark-400">{tool.description}</p>
                    {tool.input_schema?.properties && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.keys(tool.input_schema.properties).slice(0, 4).map((param: string) => (
                          <span key={param} className="px-1.5 py-0.5 text-xs rounded bg-dark-700 text-dark-400">
                            {param}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="bg-dark-900 rounded-lg border border-dark-800 p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={18} className="text-yellow-400" />
                <h3 className="text-lg font-semibold text-dark-100">API Key Configuration</h3>
              </div>
              <p className="text-sm text-dark-400 mb-4">
                API keys configured here are persisted to the server's .env file and survive restarts.
              </p>
              {keyError && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-sm text-red-400">
                  <AlertCircle size={14} /> {keyError}
                </div>
              )}

              <div className="space-y-3">
                {keysData?.keys && Object.entries(keysData.keys).map(([provider, status]: [string, any]) => (
                  <div key={provider} className="flex items-center gap-4 p-3 bg-dark-800 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-dark-200 capitalize">{provider}</span>
                        {status.configured ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <Check size={12} /> Configured
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-yellow-400">
                            <X size={12} /> Not set
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-dark-500">ENV: {status.envVar}</span>
                    </div>

                    {editingKey === provider ? (
                      <div className="flex items-center gap-2">
                        <input
                          type={provider === 'ollama' ? 'text' : 'password'}
                          value={newKeyValue}
                          onChange={(e) => setNewKeyValue(e.target.value)}
                          placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'sk-...'}
                          className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm text-dark-200 w-48"
                        />
                        <button
                          onClick={() => handleSaveKey(provider)}
                          disabled={updateKeyMutation.isPending}
                          className="p-1.5 rounded bg-green-600 hover:bg-green-500 text-white"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => { setEditingKey(null); setNewKeyValue(''); }}
                          className="p-1.5 rounded bg-dark-600 hover:bg-dark-500 text-dark-300"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingKey(provider); setNewKeyValue(status.value || ''); }}
                        className="px-3 py-1 text-sm rounded bg-dark-700 hover:bg-dark-600 text-dark-300"
                      >
                        {status.configured ? 'Update' : 'Set Key'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-dark-900 rounded-lg border border-dark-800 p-4">
              <h3 className="text-lg font-semibold text-dark-100 mb-4">Environment Variables</h3>
              <div className="space-y-2 font-mono text-sm">
                <div className="flex items-center gap-2 p-2 bg-dark-800 rounded">
                  <span className="text-cyan-400">OPENAI_API_KEY</span>
                  <span className="text-dark-500">-</span>
                  <span className="text-dark-400">Your OpenAI API key</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-dark-800 rounded">
                  <span className="text-cyan-400">ANTHROPIC_API_KEY</span>
                  <span className="text-dark-500">-</span>
                  <span className="text-dark-400">Your Anthropic API key</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-dark-800 rounded">
                  <span className="text-cyan-400">GOOGLE_API_KEY</span>
                  <span className="text-dark-500">-</span>
                  <span className="text-dark-400">Your Google AI API key</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-dark-800 rounded">
                  <span className="text-cyan-400">OLLAMA_URL</span>
                  <span className="text-dark-500">-</span>
                  <span className="text-dark-400">Ollama server URL (default: http://localhost:11434)</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-dark-800 rounded">
                  <span className="text-cyan-400">DEFAULT_AI_PROVIDER</span>
                  <span className="text-dark-500">-</span>
                  <span className="text-dark-400">Default provider (anthropic/openai/local/cloud)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
