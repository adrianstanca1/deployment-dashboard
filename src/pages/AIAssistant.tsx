import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bot,
  Cable,
  CircleSlash,
  ChevronRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Play,
  Power,
  RefreshCw,
  Send,
  Server,
  TerminalSquare,
  User,
  Wrench,
} from 'lucide-react';
import {
  openClawAPI,
  type OpenClawAgent,
  type OpenClawBinding,
  type OpenClawChannel,
  type OpenClawConfigHistoryEntry,
  type OpenClawJob,
  type OpenClawMessage,
  type OpenClawPlugin,
  type OpenClawSession,
} from '@/api';
import { wsUrl } from '@/utils';

interface OpenClawOverview {
  root: string;
  configPath: string;
  gateway: {
    mode?: string | null;
    bind?: string | null;
    port?: number | null;
    authMode?: string | null;
  };
  agents: OpenClawAgent[];
  channels: OpenClawChannel[];
  plugins?: OpenClawPlugin[];
  bindings?: OpenClawBinding[];
  risks?: {
    id: string;
    level: string;
    title: string;
    detail: string;
    action?: {
      type: string;
      channelId?: string;
      pluginId?: string;
      agentId?: string;
    };
  }[];
  recentSessions: OpenClawSession[];
  runningJobs?: OpenClawJob[];
  recentJobs?: OpenClawJob[];
  stats: {
    sessionCount: number;
    enabledChannelCount: number;
    runningJobCount?: number;
    enabledPluginCount?: number;
  };
}

const QUICK_DELEGATIONS = [
  { label: 'Investigate errors', prompt: 'Inspect recent failures, identify the root cause, and propose the next concrete fix.' },
  { label: 'Review deployment', prompt: 'Audit the current deployment state, highlight risks, and suggest the highest-value next actions.' },
  { label: 'Check Docker stack', prompt: 'Inspect the Docker environment, summarize unhealthy containers or wasted resources, and recommend fixes.' },
  { label: 'Plan next sprint', prompt: 'Break the current work into the next prioritized tasks with owner suggestions and execution order.' },
];

const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;
const OPERATION_FILTERS = ['all', 'tools', 'errors', 'chat'] as const;

function roleStyles(role: string) {
  if (role === 'user') return 'border-blue-500/20 bg-blue-500/10';
  if (role === 'assistant') return 'border-emerald-500/20 bg-emerald-500/10';
  if (role === 'toolResult') return 'border-amber-500/20 bg-amber-500/10';
  return 'border-dark-700 bg-dark-800/70';
}

function roleIcon(role: string) {
  if (role === 'user') return <User size={14} className="text-blue-300" />;
  if (role === 'assistant') return <Bot size={14} className="text-emerald-300" />;
  return <Activity size={14} className="text-amber-300" />;
}

function normalizeOperationText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return '';
}

function extractOperations(message: OpenClawMessage) {
  const rawContent = Array.isArray((message.raw as { content?: unknown[] } | undefined)?.content)
    ? ((message.raw as { content?: unknown[] }).content || [])
    : [];
  const toolName = typeof message.toolName === 'string' ? message.toolName : '';
  const isToolResult = message.role === 'toolResult';
  const isError = Boolean(message.isError) || /"status"\s*:\s*"error"|error/i.test(message.text || '');

  const operations = rawContent.flatMap((part) => {
    if (!part || typeof part !== 'object') return [];
    const item = part as {
      type?: string;
      name?: string;
      text?: string;
      arguments?: unknown;
    };

    if (item.type === 'toolCall') {
      return [{
        kind: 'tool-call',
        label: item.name || 'tool',
        detail: normalizeOperationText(item.arguments),
      }];
    }

    if (item.type === 'text' && item.text) {
      return [{
        kind: isToolResult ? (isError ? 'tool-error' : 'tool-result') : message.role,
        label: isToolResult ? (toolName || 'tool result') : message.role,
        detail: item.text,
      }];
    }

    return [];
  });

  if (operations.length) return operations;
  if (message.text) {
    return [{
      kind: isToolResult ? (isError ? 'tool-error' : 'tool-result') : message.role,
      label: isToolResult ? (toolName || 'tool result') : message.role,
      detail: message.text,
    }];
  }

  return [];
}

function operationTone(kind: string) {
  if (kind === 'tool-call') return 'border-primary-500/20 bg-primary-500/8 text-primary-300';
  if (kind === 'tool-result') return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300';
  if (kind === 'tool-error' || kind === 'stderr') return 'border-red-500/20 bg-red-500/8 text-red-300';
  if (kind === 'stdout') return 'border-cyan-500/20 bg-cyan-500/8 text-cyan-300';
  if (kind === 'assistant') return 'border-emerald-500/12 bg-emerald-500/5 text-emerald-200';
  if (kind === 'user') return 'border-blue-500/12 bg-blue-500/5 text-blue-200';
  return 'border-dark-700 bg-dark-800/80 text-dark-300';
}

function operationIcon(kind: string) {
  if (kind === 'tool-call') return <Wrench size={12} />;
  if (kind === 'tool-result') return <CheckCircle2 size={12} />;
  if (kind === 'tool-error' || kind === 'stderr') return <AlertTriangle size={12} />;
  if (kind === 'stdout') return <TerminalSquare size={12} />;
  if (kind === 'assistant') return <Bot size={12} />;
  if (kind === 'user') return <User size={12} />;
  return <Activity size={12} />;
}

function splitCommandOutput(value?: string) {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-20);
}

function riskActionLabel(type?: string) {
  if (type === 'bind-channel') return 'Prepare binding';
  if (type === 'enable-plugin') return 'Enable plugin';
  if (type === 'edit-agent') return 'Open agent';
  if (type === 'create-binding') return 'Add binding';
  if (type === 'review-gateway-auth') return 'Review auth';
  return 'Review';
}

function jobStatusTone(status?: OpenClawJob['status']) {
  if (status === 'running') return 'text-green-300';
  if (status === 'completed') return 'text-emerald-300';
  if (status === 'cancelled') return 'text-amber-300';
  return 'text-red-300';
}

export default function AIAssistant() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [sessionQuery, setSessionQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [newTaskAgentId, setNewTaskAgentId] = useState<string>('');
  const [newTaskDraft, setNewTaskDraft] = useState('');
  const [newTaskThinking, setNewTaskThinking] = useState<(typeof THINKING_LEVELS)[number]>('low');
  const [replyThinking, setReplyThinking] = useState<(typeof THINKING_LEVELS)[number]>('low');
  const [activeJobId, setActiveJobId] = useState<string>('');
  const [bindingAgentId, setBindingAgentId] = useState<string>('');
  const [bindingChannel, setBindingChannel] = useState<string>('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmoji, setNewAgentEmoji] = useState('');
  const [newAgentModel, setNewAgentModel] = useState('');
  const [editingAgentId, setEditingAgentId] = useState('');
  const [editingAgentName, setEditingAgentName] = useState('');
  const [editingAgentEmoji, setEditingAgentEmoji] = useState('');
  const [editingAgentModel, setEditingAgentModel] = useState('');
  const [followLiveJob, setFollowLiveJob] = useState(true);
  const [operationFilter, setOperationFilter] = useState<(typeof OPERATION_FILTERS)[number]>('all');
  const [mutationNotice, setMutationNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [liveSnapshot, setLiveSnapshot] = useState<{
    agents?: OpenClawAgent[];
    channels?: OpenClawChannel[];
    plugins?: OpenClawPlugin[];
    bindings?: OpenClawBinding[];
    sessions?: OpenClawSession[];
    runningJobs?: OpenClawJob[];
    recentJobs?: OpenClawJob[];
    messages?: OpenClawMessage[];
    activeJob?: OpenClawJob | null;
  } | null>(null);
  const activityEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const jobFromUrl = searchParams.get('job') || '';
    if (jobFromUrl && jobFromUrl !== activeJobId) {
      setFollowLiveJob(false);
      setActiveJobId(jobFromUrl);
    }
  }, [activeJobId, searchParams]);

  const overviewQuery = useQuery({
    queryKey: ['openclaw-overview'],
    queryFn: async () => {
      const response = await openClawAPI.getOverview();
      return response.data as OpenClawOverview;
    },
    refetchInterval: 10000,
  });

  const sessionsQuery = useQuery({
    queryKey: ['openclaw-sessions', agentFilter || 'all'],
    queryFn: async () => {
      const response = await openClawAPI.getSessions(agentFilter || undefined, 100);
      return response.data as OpenClawSession[];
    },
    refetchInterval: activeJobId ? 1500 : 5000,
  });

  const selectedSession = useMemo(() => {
    return (sessionsQuery.data || []).find(
      (session) => session.agentId === selectedAgentId && session.sessionId === selectedSessionId
    ) || null;
  }, [selectedAgentId, selectedSessionId, sessionsQuery.data]);

  const messagesQuery = useQuery({
    queryKey: ['openclaw-messages', selectedAgentId, selectedSessionId],
    queryFn: async () => {
      const response = await openClawAPI.getMessages(selectedAgentId, selectedSessionId, 300);
      return response.data as OpenClawMessage[];
    },
    enabled: Boolean(selectedAgentId && selectedSessionId),
    refetchInterval: activeJobId && selectedSession ? 1500 : 4000,
  });

  const gatewayStatusQuery = useQuery({
    queryKey: ['openclaw-gateway-status'],
    queryFn: async () => {
      const response = await openClawAPI.getGatewayStatus();
      return response.data as { raw?: string; parsed?: Record<string, unknown> | null };
    },
    refetchInterval: activeJobId ? 4000 : 15000,
    retry: false,
  });

  const configHistoryQuery = useQuery({
    queryKey: ['openclaw-config-history'],
    queryFn: async () => {
      const response = await openClawAPI.getConfigHistory();
      return response.data as OpenClawConfigHistoryEntry[];
    },
    refetchInterval: 5000,
  });

  const jobQuery = useQuery({
    queryKey: ['openclaw-job', activeJobId],
    queryFn: async () => {
      const response = await openClawAPI.getJob(activeJobId);
      return response.data as OpenClawJob;
    },
    enabled: Boolean(activeJobId),
    refetchInterval: (query) => {
      const job = query.state.data as OpenClawJob | undefined;
      return !job || job.status === 'running' ? 1200 : false;
    },
    retry: false,
  });

  useEffect(() => {
    const agents = overviewQuery.data?.agents || [];
    if (agents.length && !newTaskAgentId) {
      setNewTaskAgentId(agents[0].id);
    }
    if (agents.length && !bindingAgentId) {
      setBindingAgentId(agents[0].id);
    }
  }, [newTaskAgentId, overviewQuery.data?.agents]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl(`/ws/openclaw?agentId=${encodeURIComponent(agentFilter || selectedAgentId || '')}&sessionId=${encodeURIComponent(selectedSessionId || '')}&jobId=${encodeURIComponent(activeJobId || '')}`));

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'openclaw-snapshot') {
          setLiveSnapshot(payload.data);
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    };

    return () => {
      ws.close();
    };
  }, [activeJobId, agentFilter, selectedAgentId, selectedSessionId]);

  useEffect(() => {
    const runningJobs = overviewQuery.data?.runningJobs || [];
    if (!runningJobs.length) return;

    const newestRunningJob = [...runningJobs].sort((a, b) => b.startedAt - a.startedAt)[0];
    if (followLiveJob && newestRunningJob?.id && (!activeJobId || jobQuery.data?.status !== 'running')) {
      setActiveJobId(newestRunningJob.id);
    }
  }, [activeJobId, followLiveJob, jobQuery.data?.status, overviewQuery.data?.runningJobs]);

  useEffect(() => {
    const sessions = sessionsQuery.data || overviewQuery.data?.recentSessions || [];
    if (!sessions.length) return;

    if (!selectedAgentId || !selectedSessionId) {
      setSelectedAgentId(sessions[0].agentId);
      setSelectedSessionId(sessions[0].sessionId);
      return;
    }

    const stillExists = sessions.some(
      (session) => session.agentId === selectedAgentId && session.sessionId === selectedSessionId
    );

    if (!stillExists) {
      setSelectedAgentId(sessions[0].agentId);
      setSelectedSessionId(sessions[0].sessionId);
    }
  }, [overviewQuery.data?.recentSessions, selectedAgentId, selectedSessionId, sessionsQuery.data]);

  useEffect(() => {
    const job = jobQuery.data;
    if (!job || job.status === 'running') return;

    const agentId = typeof job.meta?.agentId === 'string' ? job.meta.agentId : '';
    const sessionId = typeof job.meta?.sessionId === 'string' ? job.meta.sessionId : '';
    if (agentId && sessionId) {
      setSelectedAgentId(agentId);
      setSelectedSessionId(sessionId);
    }

    queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
    queryClient.invalidateQueries({ queryKey: ['openclaw-sessions'] });
    if (agentId && sessionId) {
      queryClient.invalidateQueries({ queryKey: ['openclaw-messages', agentId, sessionId] });
    }
  }, [jobQuery.data, queryClient]);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!newTaskAgentId || !newTaskDraft.trim()) return null;
      return openClawAPI.startSession(newTaskAgentId, newTaskDraft.trim(), newTaskThinking);
    },
    onSuccess: (result) => {
      const jobId = result?.data?.job?.id as string | undefined;
      const agentId = result?.data?.agentId as string | undefined;
      const sessionId = result?.data?.sessionId as string | undefined;
      setNewTaskDraft('');
      if (agentId && sessionId) {
        setSelectedAgentId(agentId);
        setSelectedSessionId(sessionId);
      }
      if (jobId) {
        setActiveJobId(jobId);
      }
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId || !selectedSessionId || !draft.trim()) return null;
      return openClawAPI.sendMessage(selectedAgentId, selectedSessionId, draft.trim(), replyThinking);
    },
    onSuccess: (result) => {
      setDraft('');
      const jobId = result?.data?.job?.id as string | undefined;
      if (jobId) {
        setActiveJobId(jobId);
      }
    },
  });

  const gatewayControlMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop' | 'restart') => {
      return openClawAPI.controlGateway(action);
    },
    onSuccess: (result) => {
      const jobId = result?.data?.job?.id as string | undefined;
      if (jobId) {
        setActiveJobId(jobId);
      }
    },
  });

  const channelMutation = useMutation({
    mutationFn: async ({ channelId, enabled }: { channelId: string; enabled: boolean }) => {
      return openClawAPI.updateChannel(channelId, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      setMutationNotice({ tone: 'success', text: 'Channel configuration updated.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Channel update failed.' });
    },
  });

  const pluginMutation = useMutation({
    mutationFn: async ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) => {
      return openClawAPI.updatePlugin(pluginId, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      setMutationNotice({ tone: 'success', text: 'Plugin configuration updated.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Plugin update failed.' });
    },
  });

  const bindingMutation = useMutation({
    mutationFn: async () => {
      if (!bindingAgentId || !bindingChannel) return null;
      return openClawAPI.addBinding(bindingAgentId, bindingChannel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      setMutationNotice({ tone: 'success', text: 'Binding added.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Binding creation failed.' });
    },
  });

  const deleteBindingMutation = useMutation({
    mutationFn: async ({ agentId, channel }: { agentId: string; channel: string }) => {
      return openClawAPI.deleteBinding(agentId, channel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      setMutationNotice({ tone: 'success', text: 'Binding removed.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Binding removal failed.' });
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async () => {
      if (!newAgentName.trim()) return null;
      return openClawAPI.createAgent({
        name: newAgentName.trim(),
        emoji: newAgentEmoji.trim() || undefined,
        model: newAgentModel.trim() || undefined,
      });
    },
    onSuccess: () => {
      setNewAgentName('');
      setNewAgentEmoji('');
      setNewAgentModel('');
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      setMutationNotice({ tone: 'success', text: 'Agent created.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Agent creation failed.' });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: async () => {
      if (!editingAgentId) return null;
      return openClawAPI.updateAgent(editingAgentId, {
        name: editingAgentName.trim() || undefined,
        emoji: editingAgentEmoji,
        model: editingAgentModel.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      setMutationNotice({ tone: 'success', text: 'Agent updated.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Agent update failed.' });
    },
  });

  const revertConfigMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return openClawAPI.revertConfigHistory(entryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      queryClient.invalidateQueries({ queryKey: ['openclaw-config-history'] });
      setMutationNotice({ tone: 'success', text: 'Configuration reverted.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Revert failed.' });
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return openClawAPI.cancelJob(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['openclaw-overview'] });
      queryClient.invalidateQueries({ queryKey: ['openclaw-job', activeJobId] });
      setMutationNotice({ tone: 'success', text: 'Running job stop requested.' });
    },
    onError: (error: Error) => {
      setMutationNotice({ tone: 'error', text: error.message || 'Unable to stop job.' });
    },
  });

  const overview = overviewQuery.data;
  const agents = liveSnapshot?.agents || overview?.agents || [];
  const channels = liveSnapshot?.channels || overview?.channels || [];
  const plugins = liveSnapshot?.plugins || overview?.plugins || [];
  const bindings = liveSnapshot?.bindings || overview?.bindings || [];
  const risks = overview?.risks || [];
  const sessions = liveSnapshot?.sessions || sessionsQuery.data || [];
  const messages = liveSnapshot?.messages || messagesQuery.data || [];
  const currentJob = liveSnapshot?.activeJob || jobQuery.data || null;
  const runningJobs = liveSnapshot?.runningJobs || overview?.runningJobs || [];
  const recentJobs = liveSnapshot?.recentJobs || overview?.recentJobs || [];
  const configHistory = configHistoryQuery.data || [];
  const isBusy = createSessionMutation.isPending || sendMutation.isPending || currentJob?.status === 'running';
  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => {
      const haystack = [
        session.sessionKey,
        session.agentId,
        session.channel,
        session.model,
        session.lastMessage,
        session.target,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sessionQuery, sessions]);
  const liveOperations = useMemo(() => {
    const transcriptOperations = messages
      .slice(-12)
      .flatMap((message) =>
        extractOperations(message).map((operation, index) => ({
          id: `${message.id}-${index}`,
          source: 'transcript',
          timestamp: message.timestamp || null,
          ...operation,
        }))
      );

    const commandOperations = [
      ...splitCommandOutput(currentJob?.stdout).map((line, index) => ({
        id: `stdout-${index}-${line}`,
        source: 'stdout',
        timestamp: null,
        kind: 'stdout',
        label: 'stdout',
        detail: line,
      })),
      ...splitCommandOutput(currentJob?.stderr).map((line, index) => ({
        id: `stderr-${index}-${line}`,
        source: 'stderr',
        timestamp: null,
        kind: 'stderr',
        label: 'stderr',
        detail: line,
      })),
    ];

    return [...transcriptOperations, ...commandOperations].slice(-24);
  }, [currentJob?.stderr, currentJob?.stdout, messages]);
  const filteredOperations = useMemo(() => {
    if (operationFilter === 'all') return liveOperations;
    if (operationFilter === 'tools') {
      return liveOperations.filter((item) => item.kind === 'tool-call' || item.kind === 'tool-result' || item.kind === 'tool-error');
    }
    if (operationFilter === 'errors') {
      return liveOperations.filter((item) => item.kind === 'tool-error' || item.kind === 'stderr');
    }
    return liveOperations.filter((item) => item.kind === 'assistant' || item.kind === 'user');
  }, [liveOperations, operationFilter]);
  const operationSummary = useMemo(() => {
    return {
      toolCalls: liveOperations.filter((item) => item.kind === 'tool-call').length,
      toolResults: liveOperations.filter((item) => item.kind === 'tool-result').length,
      errors: liveOperations.filter((item) => item.kind === 'tool-error' || item.kind === 'stderr').length,
    };
  }, [liveOperations]);

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredOperations.length, currentJob?.status]);

  const latestMeaningfulOperation = filteredOperations[filteredOperations.length - 1] || null;

  const applyRiskAction = (risk: NonNullable<OpenClawOverview['risks']>[number]) => {
    const action = risk.action;
    if (!action) return;

    if (action.type === 'bind-channel') {
      if (action.channelId) setBindingChannel(action.channelId);
      return;
    }

    if (action.type === 'enable-plugin' && action.pluginId) {
      pluginMutation.mutate({ pluginId: action.pluginId, enabled: true });
      return;
    }

    if (action.type === 'edit-agent' && action.agentId) {
      const agent = agents.find((item) => item.id === action.agentId);
      if (!agent) return;
      setEditingAgentId(agent.id);
      setEditingAgentName(agent.name || '');
      setEditingAgentEmoji(agent.emoji || '');
      setEditingAgentModel(agent.model || '');
      return;
    }

    if (action.type === 'create-binding') {
      setBindingChannel(channels[0]?.id || '');
    }
  };

  return (
    <div className="flex h-full flex-col bg-dark-950 text-dark-100">
      <div className="border-b border-dark-800 bg-dark-900 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-400">
              <Cable size={12} />
              OpenClaw Gateway
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Control OpenClaw From The Dashboard</h1>
            <p className="mt-1 text-sm text-dark-400">
              Start agent tasks, watch live transcript growth, inspect running turns, and control the gateway.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                overviewQuery.refetch();
                sessionsQuery.refetch();
                messagesQuery.refetch();
                gatewayStatusQuery.refetch();
                jobQuery.refetch();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <button
              onClick={() => gatewayControlMutation.mutate('start')}
              disabled={gatewayControlMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 disabled:opacity-50"
            >
              <Play size={15} />
              Start
            </button>
            <button
              onClick={() => gatewayControlMutation.mutate('stop')}
              disabled={gatewayControlMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 disabled:opacity-50"
            >
              <Power size={15} />
              Stop
            </button>
            <button
              onClick={() => gatewayControlMutation.mutate('restart')}
              disabled={gatewayControlMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-2 text-sm text-primary-300 hover:bg-primary-500/20 disabled:opacity-50"
            >
              <Power size={15} />
              Restart Gateway
            </button>
          </div>
        </div>
        {mutationNotice && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              mutationNotice.tone === 'success'
                ? 'border-green-500/20 bg-green-500/8 text-green-200'
                : mutationNotice.tone === 'error'
                ? 'border-red-500/20 bg-red-500/8 text-red-200'
                : 'border-blue-500/20 bg-blue-500/8 text-blue-200'
            }`}
          >
            {mutationNotice.text}
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-dark-800 bg-dark-900/60">
          <div className="border-b border-dark-800 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-dark-800 bg-dark-900 p-3">
                <div className="text-xs uppercase tracking-wide text-dark-500">Gateway</div>
                <div className="mt-2 text-sm text-dark-100">
                  {overview?.gateway.mode || 'unknown'}:{' '}
                  {overview?.gateway.port || 'n/a'}
                </div>
                <div className="mt-1 text-xs text-dark-500">
                  {overview?.stats.runningJobCount || 0} live jobs
                </div>
              </div>
              <div className="rounded-xl border border-dark-800 bg-dark-900 p-3">
                <div className="text-xs uppercase tracking-wide text-dark-500">OpenClaw</div>
                <div className="mt-2 text-sm text-dark-100">{overview?.stats.enabledChannelCount || 0} channels</div>
                <div className="mt-1 text-xs text-dark-500">{overview?.stats.enabledPluginCount || 0} plugins on</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dark-800 bg-dark-900 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
                <Play size={12} />
                New Delegated Task
              </div>
              <select
                value={newTaskAgentId}
                onChange={(event) => setNewTaskAgentId(event.target.value)}
                className="mb-2 w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.emoji ? `${agent.emoji} ` : ''}{agent.name}
                  </option>
                ))}
              </select>
              <textarea
                value={newTaskDraft}
                onChange={(event) => setNewTaskDraft(event.target.value)}
                placeholder="Describe a new task and spawn it as a fresh OpenClaw session..."
                rows={4}
                className="w-full resize-none rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
              />
              <select
                value={newTaskThinking}
                onChange={(event) => setNewTaskThinking(event.target.value as (typeof THINKING_LEVELS)[number])}
                className="mt-2 w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
              >
                {THINKING_LEVELS.map((level) => (
                  <option key={level} value={level}>Thinking: {level}</option>
                ))}
              </select>
              <button
                onClick={() => createSessionMutation.mutate()}
                disabled={!newTaskAgentId || !newTaskDraft.trim() || createSessionMutation.isPending}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
              >
                {createSessionMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Spawn Session
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {QUICK_DELEGATIONS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setNewTaskDraft(item.prompt)}
                    className="rounded-lg border border-dark-700 bg-dark-800 px-2 py-2 text-left text-xs text-dark-300 hover:bg-dark-700 hover:text-dark-100"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-dark-500">Agent Filter</label>
              <select
                value={agentFilter}
                onChange={(event) => setAgentFilter(event.target.value)}
                className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
              >
                <option value="">All agents</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.emoji ? `${agent.emoji} ` : ''}{agent.name}
                  </option>
                ))}
              </select>
              <input
                value={sessionQuery}
                onChange={(event) => setSessionQuery(event.target.value)}
                placeholder="Search sessions, agents, models..."
                className="mt-2 w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <Activity size={12} />
              Posture
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2 text-xs text-dark-400">
                <div className="text-dark-500">Auth Mode</div>
                <div className="mt-1 text-dark-100">{overview?.gateway.authMode || 'unknown'}</div>
              </div>
              <div className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2 text-xs text-dark-400">
                <div className="text-dark-500">Bindings</div>
                <div className="mt-1 text-dark-100">{bindings.length}</div>
              </div>
              <div className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2 text-xs text-dark-400">
                <div className="text-dark-500">Agents</div>
                <div className="mt-1 text-dark-100">{agents.length}</div>
              </div>
              <div className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2 text-xs text-dark-400">
                <div className="text-dark-500">Plugins</div>
                <div className="mt-1 text-dark-100">{plugins.filter((plugin) => plugin.enabled).length} active</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {risks.map((risk) => (
                <div
                  key={risk.id}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    risk.level === 'high'
                      ? 'border-red-500/20 bg-red-500/8 text-red-200'
                      : risk.level === 'medium'
                      ? 'border-amber-500/20 bg-amber-500/8 text-amber-200'
                      : 'border-blue-500/20 bg-blue-500/8 text-blue-200'
                  }`}
                >
                  <div className="font-medium">{risk.title}</div>
                  <div className="mt-1 opacity-80">{risk.detail}</div>
                  {risk.action && (
                    <button
                      onClick={() => applyRiskAction(risk)}
                      className="mt-2 rounded-md bg-dark-950/40 px-2 py-1 text-[11px] text-dark-100 hover:bg-dark-950/60"
                    >
                      {riskActionLabel(risk.action.type)}
                    </button>
                  )}
                </div>
              ))}
              {!risks.length && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/8 px-3 py-2 text-xs text-green-200">
                  No obvious OpenClaw config risks detected from the current dashboard checks.
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <Server size={12} />
              Channels
            </div>
            <div className="space-y-2">
              {channels.map((channel) => (
                <div key={channel.id} className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-200">{channel.name || channel.id}</span>
                    <button
                      onClick={() => channelMutation.mutate({ channelId: channel.id, enabled: !channel.enabled })}
                      className={`rounded-md px-2 py-1 text-xs ${channel.enabled ? 'bg-green-500/15 text-green-300' : 'bg-dark-800 text-dark-400'}`}
                    >
                      {channel.enabled ? 'on' : 'off'}
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-dark-500">
                    {channel.streaming || 'no-stream'} · {channel.groupPolicy || 'default'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <Bot size={12} />
              Agents
            </div>
            <div className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setEditingAgentId(agent.id);
                    setEditingAgentName(agent.name || '');
                    setEditingAgentEmoji(agent.emoji || '');
                    setEditingAgentModel(agent.model || '');
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    editingAgentId === agent.id
                      ? 'border-primary-500/40 bg-primary-500/10'
                      : 'border-dark-800 bg-dark-900 hover:bg-dark-800'
                  }`}
                >
                  <div className="text-sm text-dark-100">{agent.emoji ? `${agent.emoji} ` : ''}{agent.name}</div>
                  <div className="mt-1 text-xs text-dark-500">{agent.id} · {agent.model || 'default model'}</div>
                  <div className="mt-1 text-[11px] text-dark-600">{agent.workspace || 'no workspace'}</div>
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-dark-800 bg-dark-900 p-3">
              <div className="mb-2 text-xs uppercase tracking-wide text-dark-500">Create Agent</div>
              <input
                value={newAgentName}
                onChange={(event) => setNewAgentName(event.target.value)}
                placeholder="Agent name"
                className="mb-2 w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newAgentEmoji}
                  onChange={(event) => setNewAgentEmoji(event.target.value)}
                  placeholder="Emoji"
                  className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                />
                <input
                  value={newAgentModel}
                  onChange={(event) => setNewAgentModel(event.target.value)}
                  placeholder="Model"
                  className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => createAgentMutation.mutate()}
                disabled={!newAgentName.trim() || createAgentMutation.isPending}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-500 disabled:opacity-50"
              >
                <Bot size={14} />
                Create
              </button>
            </div>

            {editingAgentId && (
              <div className="mt-3 rounded-xl border border-dark-800 bg-dark-900 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-dark-500">Edit Agent</div>
                <input
                  value={editingAgentName}
                  onChange={(event) => setEditingAgentName(event.target.value)}
                  placeholder="Agent display name"
                  className="mb-2 w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editingAgentEmoji}
                    onChange={(event) => setEditingAgentEmoji(event.target.value)}
                    placeholder="Emoji"
                    className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                  />
                  <input
                    value={editingAgentModel}
                    onChange={(event) => setEditingAgentModel(event.target.value)}
                    placeholder="Model"
                    className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => updateAgentMutation.mutate()}
                  disabled={updateAgentMutation.isPending}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-dark-800 px-3 py-2 text-sm text-dark-100 hover:bg-dark-700 disabled:opacity-50"
                >
                  <Wrench size={14} />
                  Save Agent
                </button>
              </div>
            )}
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <Wrench size={12} />
              Plugins
            </div>
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <div key={plugin.id} className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dark-200">{plugin.id}</span>
                    <button
                      onClick={() => pluginMutation.mutate({ pluginId: plugin.id, enabled: !plugin.enabled })}
                      className={`rounded-md px-2 py-1 text-xs ${plugin.enabled ? 'bg-green-500/15 text-green-300' : 'bg-dark-800 text-dark-400'}`}
                    >
                      {plugin.enabled ? 'enabled' : 'disabled'}
                    </button>
                  </div>
                </div>
              ))}
              {!plugins.length && (
                <div className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-4 text-sm text-dark-500">
                  No plugins reported.
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <Wrench size={12} />
              Runtime
            </div>
            <div className="rounded-xl border border-dark-800 bg-dark-900 p-3 text-xs text-dark-400">
              {gatewayStatusQuery.data?.raw
                ? <pre className="whitespace-pre-wrap font-mono">{gatewayStatusQuery.data.raw}</pre>
                : 'Gateway status unavailable.'}
            </div>
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <Activity size={12} />
              Job Queue
            </div>
            <div className="mb-2 text-[11px] text-dark-500">
              {runningJobs.length} live · {Math.max(recentJobs.length - runningJobs.length, 0)} recent
            </div>
            <div className="space-y-2">
              {runningJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => {
                    setFollowLiveJob(false);
                    setActiveJobId(job.id);
                  }}
                  className={`w-full rounded-xl border px-3 py-3 text-left ${
                    activeJobId === job.id
                      ? 'border-primary-500/40 bg-primary-500/10'
                      : 'border-dark-800 bg-dark-900 hover:bg-dark-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide">
                    <span className="text-primary-300">{job.type}</span>
                    <span className="flex items-center gap-1 text-green-300">
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      live
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-dark-200">
                    {typeof job.meta?.agentId === 'string' ? job.meta.agentId : 'gateway'}{typeof job.meta?.sessionId === 'string' ? ` · ${job.meta.sessionId}` : ''}
                  </div>
                  <div className="mt-1 text-[11px] text-dark-500">
                    started {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
                  </div>
                </button>
              ))}
              {!runningJobs.length && (
                <div className="rounded-xl border border-dark-800 bg-dark-900 px-3 py-5 text-center text-sm text-dark-500">
                  No active OpenClaw jobs.
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-dark-500">Recent Jobs</div>
              <div className="space-y-2">
                {recentJobs
                  .filter((job) => job.status !== 'running')
                  .slice(0, 8)
                  .map((job) => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setFollowLiveJob(false);
                        setActiveJobId(job.id);
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-left ${
                        activeJobId === job.id
                          ? 'border-primary-500/40 bg-primary-500/10'
                          : 'border-dark-800 bg-dark-900 hover:bg-dark-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide">
                        <span className="text-dark-200">{job.type}</span>
                        <span className={jobStatusTone(job.status)}>{job.status}</span>
                      </div>
                      <div className="mt-2 text-sm text-dark-300">
                        {typeof job.meta?.agentId === 'string' ? job.meta.agentId : 'gateway'}
                        {typeof job.meta?.sessionId === 'string' ? ` · ${job.meta.sessionId}` : ''}
                      </div>
                      <div className="mt-1 text-[11px] text-dark-500">
                        {job.endedAt
                          ? `ended ${formatDistanceToNow(new Date(job.endedAt), { addSuffix: true })}`
                          : `started ${formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}`}
                      </div>
                    </button>
                  ))}
                {!recentJobs.some((job) => job.status !== 'running') && (
                  <div className="rounded-xl border border-dark-800 bg-dark-900 px-3 py-5 text-center text-sm text-dark-500">
                    No completed or failed OpenClaw jobs yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <Cable size={12} />
              Bindings
            </div>
            <div className="space-y-2">
              {bindings.map((binding) => (
                <div key={binding.id} className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-dark-200">
                      {binding.channel || 'unknown'} → {binding.agentId || 'unknown'}
                    </div>
                    <button
                      onClick={() => {
                        if (binding.agentId && binding.channel) {
                          deleteBindingMutation.mutate({ agentId: binding.agentId, channel: binding.channel });
                        }
                      }}
                      className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300"
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={bindingChannel}
                onChange={(event) => setBindingChannel(event.target.value)}
                className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
              >
                <option value="">Channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>{channel.id}</option>
                ))}
              </select>
              <select
                value={bindingAgentId}
                onChange={(event) => setBindingAgentId(event.target.value)}
                className="rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => bindingMutation.mutate()}
              disabled={!bindingChannel || !bindingAgentId || bindingMutation.isPending}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-dark-800 px-3 py-2 text-sm text-dark-100 hover:bg-dark-700 disabled:opacity-50"
            >
              <Cable size={14} />
              Add Binding
            </button>
          </div>

          <div className="border-b border-dark-800 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <RefreshCw size={12} />
              Change History
            </div>
            <div className="space-y-2">
              {configHistory.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm text-dark-100">{String(entry.meta?.type || 'change')}</div>
                      <div className="mt-1 text-[11px] text-dark-500">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                    <button
                      onClick={() => revertConfigMutation.mutate(entry.id)}
                      disabled={revertConfigMutation.isPending}
                      className="rounded-md bg-dark-800 px-2 py-1 text-xs text-dark-200 hover:bg-dark-700 disabled:opacity-50"
                    >
                      revert
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] text-dark-500">
                    bindings {entry.summary?.before?.bindings ?? 0} {'->'} {entry.summary?.after?.bindings ?? 0} ·
                    plugins {entry.summary?.before?.plugins ?? 0} {'->'} {entry.summary?.after?.plugins ?? 0}
                  </div>
                </div>
              ))}
              {!configHistory.length && (
                <div className="rounded-lg border border-dark-800 bg-dark-900 px-3 py-4 text-sm text-dark-500">
                  No config changes recorded yet.
                </div>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-500">
              <MessageSquare size={12} />
              Sessions
            </div>
            <div className="space-y-2">
              {filteredSessions.map((session) => {
                const isActive =
                  session.agentId === selectedAgentId && session.sessionId === selectedSessionId;

                return (
                  <button
                    key={`${session.agentId}-${session.sessionId}`}
                    onClick={() => {
                      setSelectedAgentId(session.agentId);
                      setSelectedSessionId(session.sessionId);
                    }}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-primary-500/40 bg-primary-500/10'
                        : 'border-dark-800 bg-dark-900 hover:bg-dark-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-dark-100">{session.sessionKey}</div>
                        <div className="mt-1 text-xs text-dark-500">
                          {session.channel || 'unknown-channel'} · {session.model || 'unknown-model'}
                        </div>
                      </div>
                      <ChevronRight size={14} className="mt-1 text-dark-500" />
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-dark-400">
                      {session.lastMessage || 'No transcript text yet'}
                    </div>
                    <div className="mt-2 text-[11px] text-dark-500">
                      {session.updatedAt
                        ? formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })
                        : 'unknown'}
                    </div>
                  </button>
                );
              })}
              {!sessions.length && (
                <div className="rounded-xl border border-dark-800 bg-dark-900 px-3 py-6 text-center text-sm text-dark-500">
                  No OpenClaw sessions found.
                </div>
              )}
              {!!sessions.length && !filteredSessions.length && (
                <div className="rounded-xl border border-dark-800 bg-dark-900 px-3 py-6 text-center text-sm text-dark-500">
                  No sessions match the current search.
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <div className="border-b border-dark-800 bg-dark-900/80 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-dark-500">Active Session</div>
                <div className="mt-1 text-lg font-medium text-dark-100">
                  {selectedSession?.sessionKey || 'Select or create a session'}
                </div>
                <div className="mt-1 text-sm text-dark-400">
                  {selectedSession
                    ? `${selectedSession.agentId} · ${selectedSession.channel || 'unknown channel'} · ${selectedSession.target || 'no target'}`
                    : 'Choose an OpenClaw session from the left panel or spawn a new task.'}
                </div>
              </div>
              <div className="text-right text-xs text-dark-500">
                {selectedSession && <div>{selectedSession.modelProvider || 'provider unknown'}</div>}
                {selectedSession && <div>{selectedSession.model || 'model unknown'}</div>}
                {currentJob && (
                  <div className={currentJob.status === 'running' ? 'text-primary-300' : currentJob.status === 'completed' ? 'text-green-400' : currentJob.status === 'cancelled' ? 'text-amber-300' : 'text-red-400'}>
                    Job {currentJob.status}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-h-0 overflow-y-auto px-5 py-5">
            {currentJob && (
              <div className="mb-4 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-primary-300">
                  <TerminalSquare size={12} />
                  Live Turn
                  {currentJob.status === 'running' && <Loader2 size={12} className="animate-spin" />}
                </div>
                <div className="text-sm text-dark-200">
                  {currentJob.type} · started {formatDistanceToNow(new Date(currentJob.startedAt), { addSuffix: true })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFollowLiveJob((value) => !value)}
                    className={`rounded-lg px-3 py-1.5 text-xs ${followLiveJob ? 'bg-primary-500/15 text-primary-300' : 'bg-dark-800 text-dark-300'}`}
                  >
                    {followLiveJob ? 'Auto-follow latest on' : 'Auto-follow latest off'}
                  </button>
                  {currentJob.status === 'running' && (
                    <button
                      onClick={() => cancelJobMutation.mutate(currentJob.id)}
                      disabled={cancelJobMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-500/12 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50"
                    >
                      <CircleSlash size={12} />
                      Stop job
                    </button>
                  )}
                </div>
                {currentJob.error && (
                  <div className="mt-2 text-sm text-red-400">{currentJob.error}</div>
                )}
                {(currentJob.stdout || currentJob.stderr) && (
                  <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-dark-800 bg-dark-950 p-3 text-xs text-dark-300">
                    {[currentJob.stdout, currentJob.stderr].filter(Boolean).join('\n')}
                  </pre>
                )}
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl border p-4 ${roleStyles(message.role)}`}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-dark-400">
                    {roleIcon(message.role)}
                    <span>{message.role}</span>
                    {message.toolName && <span>· {message.toolName}</span>}
                    {message.timestamp && <span>· {new Date(message.timestamp).toLocaleString()}</span>}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-dark-100">
                    {message.text || '[non-text event]'}
                  </div>
                </div>
              ))}
            </div>

            {!selectedSession && (
              <div className="rounded-2xl border border-dashed border-dark-700 bg-dark-900/50 p-8 text-center text-dark-500">
                Spawn a delegated task or pick an existing OpenClaw session.
              </div>
            )}

            {selectedSession && !messages.length && !messagesQuery.isLoading && (
              <div className="rounded-2xl border border-dark-800 bg-dark-900/50 p-8 text-center text-dark-500">
                Transcript is empty for this session.
              </div>
            )}
          </div>

            <aside className="min-h-0 border-l border-dark-800 bg-dark-900/60">
              <div className="flex h-full flex-col">
                <div className="border-b border-dark-800 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-400">
                        <Activity size={12} />
                        Live Operations
                      </div>
                      <div className="mt-1 text-sm text-dark-300">
                        Exact OpenClaw activity while the current turn is running.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`h-2 w-2 rounded-full ${currentJob?.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-dark-600'}`} />
                      <span className={currentJob?.status === 'running' ? 'text-green-300' : 'text-dark-500'}>
                        {currentJob?.status === 'running' ? 'LIVE' : 'IDLE'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-lg border border-dark-800 bg-dark-900 px-2 py-2 text-center text-dark-400">
                      <div className="text-primary-300">{operationSummary.toolCalls}</div>
                      <div>calls</div>
                    </div>
                    <div className="rounded-lg border border-dark-800 bg-dark-900 px-2 py-2 text-center text-dark-400">
                      <div className="text-emerald-300">{operationSummary.toolResults}</div>
                      <div>results</div>
                    </div>
                    <div className="rounded-lg border border-dark-800 bg-dark-900 px-2 py-2 text-center text-dark-400">
                      <div className="text-red-300">{operationSummary.errors}</div>
                      <div>errors</div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-dark-800 bg-dark-900 px-3 py-2 text-xs text-dark-400">
                    <div className="text-dark-500">Latest signal</div>
                    <div className="mt-1 line-clamp-2 text-dark-100">
                      {latestMeaningfulOperation?.detail || 'Waiting for OpenClaw activity.'}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {OPERATION_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setOperationFilter(filter)}
                        className={`rounded-md px-2.5 py-1 text-[11px] uppercase tracking-wide ${
                          operationFilter === filter
                            ? 'bg-primary-500/15 text-primary-300'
                            : 'bg-dark-800 text-dark-400 hover:text-dark-200'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {filteredOperations.map((operation) => (
                    <div
                      key={operation.id}
                      className={`rounded-xl border p-3 ${operationTone(operation.kind)}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          {operationIcon(operation.kind)}
                          <span>{operation.label}</span>
                        </span>
                        <span className="text-dark-500">
                          {operation.timestamp ? new Date(operation.timestamp).toLocaleTimeString() : operation.source}
                        </span>
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-dark-100 font-mono">
                        {operation.detail}
                      </pre>
                    </div>
                  ))}

                  {!filteredOperations.length && (
                    <div className="rounded-xl border border-dark-800 bg-dark-900 px-4 py-6 text-center text-sm text-dark-500">
                      No matching live operations yet. Start a task or switch the filter.
                    </div>
                  )}
                  <div ref={activityEndRef} />
                </div>
              </div>
            </aside>
          </div>

          <div className="border-t border-dark-800 bg-dark-900 px-5 py-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-dark-500">
              <span>Send Into Selected Session</span>
              {(sendMutation.isError || createSessionMutation.isError || gatewayControlMutation.isError) && (
                <span className="text-red-400">
                  {((sendMutation.error || createSessionMutation.error || gatewayControlMutation.error) as Error)?.message || 'Action failed'}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={selectedSession ? 'Send another instruction into this OpenClaw session...' : 'Select a session first'}
                disabled={!selectedSession || isBusy}
                rows={3}
                className="min-h-[88px] flex-1 resize-none rounded-xl border border-dark-700 bg-dark-800 px-4 py-3 text-sm text-dark-100 placeholder-dark-500 focus:border-primary-500 focus:outline-none disabled:opacity-50"
              />
              <div className="flex flex-col gap-2">
                <select
                  value={replyThinking}
                  onChange={(event) => setReplyThinking(event.target.value as (typeof THINKING_LEVELS)[number])}
                  disabled={!selectedSession || isBusy}
                  className="rounded-xl border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-primary-500 focus:outline-none disabled:opacity-50"
                >
                  {THINKING_LEVELS.map((level) => (
                    <option key={level} value={level}>Thinking: {level}</option>
                  ))}
                </select>
                <button
                  onClick={() => sendMutation.mutate()}
                  disabled={!selectedSession || !draft.trim() || isBusy}
                  className="inline-flex h-fit items-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {isBusy ? 'Working' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
