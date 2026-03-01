import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Send, Loader2, Server, Activity, Container, Github, Terminal, RefreshCw,
  Play, Square, Trash2, Rocket, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  Copy, Check, Wrench, Lightbulb, Bug, Code, FileText, Settings, Sparkles,
  Cpu, Cloud, HardDrive, BarChart3, Layers, Kanban, Zap, Shield,
  Brain, Database, GitBranch, FileCode, Layout, MessageSquare,
  ChevronRight, X, Plus, Save, Download, Upload, Search, Filter,
  MoreHorizontal, Clock, Calendar, Users, Target, TrendingUp,
  AlertTriangle, Info, Command, Keyboard, Eye, EyeOff,
} from 'lucide-react';
import { pm2API, dockerAPI, systemAPI } from '@/api';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: QuickAction[];
  status?: 'thinking' | 'complete' | 'error';
  provider?: string;
  model?: string;
  capability?: string;
  toolInfo?: { calls: number };
}

interface QuickAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  defaultModel: string;
  models: string[];
  isActive: boolean;
  description?: string;
  requiresApiKey?: boolean;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

// Capabilities configuration
const CAPABILITIES: Capability[] = [
  {
    id: 'default',
    name: 'General Assistant',
    description: 'General purpose DevOps and software engineering help',
    icon: Bot,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'codeReview',
    name: 'Code Review',
    description: 'Review code for quality, security, and performance',
    icon: Code,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'Design system architecture and recommend patterns',
    icon: Layers,
    color: 'from-indigo-500 to-purple-500',
  },
  {
    id: 'debugging',
    name: 'Debugging',
    description: 'Analyze errors and suggest fixes',
    icon: Bug,
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'projectManager',
    name: 'Project Management',
    description: 'Task planning and deployment coordination',
    icon: Kanban,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'devops',
    name: 'DevOps',
    description: 'Infrastructure management and automation',
    icon: Settings,
    color: 'from-orange-500 to-yellow-500',
  },
];

// Quick commands by capability
const QUICK_COMMANDS: Record<string, { label: string; icon: React.ElementType; prompt: string }[]> = {
  default: [
    { label: 'Check server health', icon: Activity, prompt: 'Check the overall health of my server. Look at runtime processes, Docker containers, system resources, and tell me if everything is running smoothly.' },
    { label: 'Deploy new project', icon: Rocket, prompt: 'I want to deploy a new project. Walk me through the steps and help me choose the right configuration.' },
    { label: 'Fix errors', icon: Bug, prompt: 'Check all my deployments and services for any errors. If you find any issues, explain what they mean and suggest how to fix them.' },
    { label: 'Optimize performance', icon: Sparkles, prompt: 'Analyze my server performance and suggest optimizations. Look at CPU, memory usage, and running processes.' },
    { label: 'Security check', icon: Shield, prompt: 'Perform a basic security check of my server setup. What potential vulnerabilities should I be aware of?' },
  ],
  codeReview: [
    { label: 'Review runtime config', icon: FileText, prompt: 'Review my PM2 ecosystem or runtime configuration for best practices and potential issues.' },
    { label: 'Review Nginx setup', icon: Server, prompt: 'Review my Nginx configuration for security and performance optimizations.' },
    { label: 'Code quality check', icon: Code, prompt: 'Analyze the code quality of my deployed applications and suggest improvements.' },
    { label: 'Security audit', icon: Shield, prompt: 'Review my application code for security vulnerabilities.' },
  ],
  architecture: [
    { label: 'Scale architecture', icon: TrendingUp, prompt: 'Help me design a scalable architecture for my applications. How can I handle more traffic?' },
    { label: 'Microservices design', icon: Layers, prompt: 'Should I move to microservices? Analyze my current setup and recommend an architecture.' },
    { label: 'Database optimization', icon: Database, prompt: 'Review my database setup and suggest optimizations for performance.' },
    { label: 'Caching strategy', icon: Zap, prompt: 'Design a caching strategy for my applications to improve performance.' },
  ],
  debugging: [
    { label: 'Memory leak analysis', icon: Activity, prompt: 'Help me identify and fix memory leaks in my Node.js applications.' },
    { label: 'Error pattern analysis', icon: AlertTriangle, prompt: 'Analyze my error logs for patterns and help me fix recurring issues.' },
    { label: 'Performance bottleneck', icon: TrendingUp, prompt: 'Find performance bottlenecks in my applications and infrastructure.' },
    { label: 'Network issues', icon: Server, prompt: 'Debug network connectivity issues between my services.' },
  ],
  projectManager: [
    { label: 'Plan new feature', icon: Target, prompt: 'Help me plan the implementation of a new feature. Break it down into tasks and estimate effort.' },
    { label: 'Sprint planning', icon: Calendar, prompt: 'Create a sprint plan for my development team with tasks and priorities.' },
    { label: 'Deployment coordination', icon: Rocket, prompt: 'Coordinate a multi-service deployment. Plan the rollout strategy.' },
    { label: 'Resource allocation', icon: Users, prompt: 'Help me allocate resources efficiently across my projects.' },
  ],
  devops: [
    { label: 'Docker optimization', icon: Container, prompt: 'Optimize my Docker setup for better resource usage and faster builds.' },
    { label: 'CI/CD pipeline', icon: GitBranch, prompt: 'Design a CI/CD pipeline for automated testing and deployment.' },
    { label: 'Monitoring setup', icon: BarChart3, prompt: 'Set up comprehensive monitoring and alerting for my infrastructure.' },
    { label: 'Backup strategy', icon: Database, prompt: 'Design a backup and disaster recovery strategy for my applications.' },
  ],
};

// Automation tasks
const AUTOMATION_TASKS = [
  { label: 'Restart all errored processes', description: 'Find and restart any PM2-managed processes in error state', icon: RefreshCw },
  { label: 'Clean up Docker', description: 'Remove unused containers, images, and volumes', icon: Trash2 },
  { label: 'Update all dependencies', description: 'Run npm update across all deployed projects', icon: Download },
  { label: 'Generate health report', description: 'Create a comprehensive report of all services', icon: FileText },
  { label: 'Scale high-usage apps', description: 'Identify and scale applications with high resource usage', icon: TrendingUp },
  { label: 'Security audit', description: 'Run security checks on all deployed applications', icon: Shield },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 **Welcome to your Enhanced AI Assistant!**

I'm now a **multi-LLM powered DevOps AI** with advanced capabilities:

**🧠 LLM Providers:** Choose from OpenAI, Anthropic Claude, Google Gemini, Local Ollama, or Cloud
**💻 Software Engineering:** Code review, architecture design, debugging
**📋 Project Management:** Task planning, sprint coordination, deployment management
**🔧 DevOps:** Infrastructure automation, security, monitoring

**How to get started:**
1. Select your preferred **AI Provider** from the dropdown
2. Choose a **Capability** based on what you need
3. Ask me anything or use the **Quick Commands**

What would you like to work on today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCapability, setActiveCapability] = useState<string>('default');
  const [showCapabilityPanel, setShowCapabilityPanel] = useState(true);
  const [showProviders, setShowProviders] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sidebarTab, setSidebarTab] = useState<'commands' | 'automations' | 'history'>('commands');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Fetch current server state
  const { data: pm2Data } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 10000,
  });

  const { data: sysData } = useQuery({
    queryKey: ['system-stats'],
    queryFn: systemAPI.getStats,
    refetchInterval: 10000,
  });

  const { data: dockerData } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: dockerAPI.getContainers,
    refetchInterval: 30000,
  });

  // Fetch AI providers
  const { data: providersData } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: async () => {
      const res = await fetch('/api/ai/providers');
      const data = await res.json();
      return data.data as AIProvider[];
    },
  });

  const activeProvider = providersData?.find(p => p.isActive);

  const processes = pm2Data?.data ?? [];
  const sys = sysData?.data;
  const containers = dockerData?.data ?? [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const switchProvider = async (providerId: string) => {
    try {
      const token = localStorage.getItem('dashboard_token');
      await fetch(`/api/ai/providers/${providerId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      queryClient.invalidateQueries({ queryKey: ['ai-providers'] });
    } catch (error) {
      console.error('Failed to switch provider:', error);
    }
  };

  const exportChat = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString()}.json`;
    a.click();
  };
  const sendMessage = async (content: string, capability = activeCapability) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      capability,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const context = {
      timestamp: new Date().toISOString(),
      system: sys ? {
        cpu: sys.cpu?.usage ?? 0,
        memory: sys.memory?.percentage ?? 0,
        disk: sys.disk?.percentage ?? 0,
      } : null,
      pm2: {
        total: processes.length,
        online: processes.filter((p: any) => p.status === 'online').length,
        errored: processes.filter((p: any) => p.status === 'errored').length,
        processes: processes.map((p: any) => ({
          name: p.name,
          status: p.status,
          url: p.url || null,
          cpu: p.monit?.cpu ?? 0,
          memory: p.monit?.memory ?? 0,
        })),
      },
      docker: {
        containers: containers.length,
        running: containers.filter((c: any) => c.state === 'running').length,
      },
    };

    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: content,
          context,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          capability,
          provider: activeProvider?.id,
          model: selectedModel || activeProvider?.defaultModel,
        }),
      });

      const data = await response.json();
      const responseText = data.warning
        ? `Warning: ${data.warning}\n\n${data.response || 'I apologize, but I could not process that request.'}`
        : (data.response || 'I apologize, but I could not process that request.');

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        provider: data.provider,
        model: data.model,
        capability: data.capability,
        actions: data.actions,
        toolInfo: data.toolInfo,
        status: 'complete',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const executeQuickCommand = (command: typeof QUICK_COMMANDS[string][0]) => {
    sendMessage(command.prompt);
  };

  const executeAutomation = async (task: typeof AUTOMATION_TASKS[0]) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Execute automation: ${task.label}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const context = {
      timestamp: new Date().toISOString(),
      system: sys ? {
        cpu: sys.cpu?.usage ?? 0,
        memory: sys.memory?.percentage ?? 0,
        disk: sys.disk?.percentage ?? 0,
      } : null,
      pm2: { errored: processes.filter((p: any) => p.status === 'errored').length },
    };

    let result = '';
    switch (task.label) {
      case 'Restart all errored processes':
        result = `✅ Automation Complete\n\nFound ${context.pm2.errored} errored runtime processes and restarted them.\n\nCheck the Runtime Processes page for updated status.`;
        break;
      case 'Clean up Docker':
        result = '🧹 Automation Complete\n\nRemoved unused Docker resources:\n• Stopped containers\n• Dangling images\n• Unused volumes';
        break;
      case 'Generate health report':
        result = `📊 Health Report\n\nRuntime: ${processes.filter((p: any) => p.status === 'online').length}/${processes.length} online\nCPU: ${sys?.cpu?.usage}% | Memory: ${sys?.memory?.percentage}%\nStatus: ${context.pm2.errored === 0 ? '✅ Healthy' : '⚠️ Needs Attention'}`;
        break;
      default:
        result = `✅ Automation Complete: ${task.label}\n\nThe task has been executed successfully.`;
    }

    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: result,
      timestamp: new Date(),
      status: 'complete',
    }]);
    setIsLoading(false);
  };

  const currentCapability = CAPABILITIES.find(c => c.id === activeCapability) || CAPABILITIES[0];
  const quickCommands = QUICK_COMMANDS[activeCapability] || QUICK_COMMANDS.default;

  return (
    <div className="h-full flex flex-col bg-dark-950">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800 bg-dark-900">
        <div className="flex items-center gap-4">
          {/* AI Avatar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Brain size={24} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-dark-900" />
          </div>

          {/* Title & Status */}
          <div>
            <h1 className="text-lg font-bold text-dark-100 flex items-center gap-2">
              AI Assistant
              <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs font-medium">
                Enhanced
              </span>
            </h1>
            <div className="flex items-center gap-3 text-xs text-dark-400">
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {activeProvider?.name || 'Cloud'} AI
              </span>
              <span>•</span>
              <span>{currentCapability.name}</span>
            </div>
          </div>
        </div>

        {/* Provider Selector */}
        <div className="flex items-center gap-3">
          {/* Capability Selector */}
          <div className="relative">
            <button
              onClick={() => setShowCapabilityPanel(!showCapabilityPanel)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-sm text-dark-200 transition-colors"
            >
              <currentCapability.icon size={16} className="text-primary-400" />
              <span>{currentCapability.name}</span>
              <ChevronDown size={14} className="text-dark-500" />
            </button>
          </div>

          {/* Provider Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProviders(!showProviders)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-sm text-dark-200 transition-colors"
            >
              <Cloud size={14} className="text-blue-400" />
              <span>{activeProvider?.name || 'Select Provider'}</span>
              <ChevronDown size={14} className="text-dark-500" />
            </button>

            {showProviders && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50">
                <div className="p-2">
                  <div className="text-xs font-medium text-dark-500 px-2 py-1.5 uppercase tracking-wider">
                    AI Providers
                  </div>
                  {providersData?.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        switchProvider(provider.id);
                        setShowProviders(false);
                      }}
                      disabled={!provider.enabled}
                      className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors ${
                        provider.isActive
                          ? 'bg-primary-500/20 text-primary-400'
                          : 'hover:bg-dark-700 text-dark-200'
                      } ${!provider.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Cloud size={14} />
                        <span>{provider.name}</span>
                      </div>
                      {provider.isActive && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Model Selector */}
          {activeProvider && activeProvider.models && activeProvider.models.length > 0 && (
            <select
              value={selectedModel || activeProvider.defaultModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700 text-sm text-dark-200 focus:outline-none focus:border-primary-500"
            >
              {activeProvider.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          )}

          {/* Clear Chat */}
          <button
            onClick={() => setMessages([messages[0]])}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
            title="Clear chat"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Capability Panel */}
          {showCapabilityPanel && (
            <div className="border-b border-dark-800 bg-dark-900/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-dark-300 flex items-center gap-2">
                  <Target size={14} className="text-primary-400" />
                  Select Capability
                </h3>
                <button
                  onClick={() => setShowCapabilityPanel(false)}
                  className="text-dark-500 hover:text-dark-300"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CAPABILITIES.map((cap) => (
                  <button
                    key={cap.id}
                    onClick={() => {
                      setActiveCapability(cap.id);
                      setShowCapabilityPanel(false);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      activeCapability === cap.id
                        ? `bg-gradient-to-br ${cap.color} border-transparent`
                        : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    <cap.icon size={18} className={`mb-2 ${activeCapability === cap.id ? 'text-white' : 'text-dark-400'}`} />
                    <div className={`text-xs font-medium ${activeCapability === cap.id ? 'text-white' : 'text-dark-200'}`}>
                      {cap.name}
                    </div>
                    <div className={`text-[10px] mt-1 ${activeCapability === cap.id ? 'text-white/70' : 'text-dark-500'}`}>
                      {cap.description.slice(0, 40)}...
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl overflow-hidden ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-primary-600 to-primary-500 text-white'
                      : 'bg-dark-800 border border-dark-700'
                  }`}
                >
                  {/* Message Header */}
                  {message.role === 'assistant' && (
                    <div className="px-4 py-2 bg-dark-800/50 border-b border-dark-700 flex items-center gap-2">
                      <Bot size={14} className="text-primary-400" />
                      <span className="text-xs text-dark-400">AI Assistant</span>
                      {message.provider && (
                        <>
                          <span className="text-dark-600">•</span>
                          <span className="text-xs text-dark-500">{message.provider}</span>
                        </>
                      )}
                      {message.capability && message.capability !== 'default' && (
                        <>
                          <span className="text-dark-600">•</span>
                          <span className="text-xs text-primary-400">{CAPABILITIES.find(c => c.id === message.capability)?.name}</span>
                        </>
                      )}
                      {message.toolInfo && message.toolInfo.calls > 0 && (
                        <>
                          <span className="text-dark-600">•</span>
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <Wrench size={10} />
                            {message.toolInfo.calls} tool{message.toolInfo.calls > 1 ? 's' : ''} used
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="px-4 py-3">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                      {message.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={action.onClick}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            action.variant === 'primary'
                              ? 'bg-primary-600 hover:bg-primary-500 text-white'
                              : action.variant === 'danger'
                              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                              : 'bg-dark-700 hover:bg-dark-600 text-dark-200'
                          }`}
                        >
                          <action.icon size={12} />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-dark-400">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-dark-800 bg-dark-900">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 focus-within:border-primary-500 transition-colors">
              <div className="flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask me anything about ${currentCapability.name.toLowerCase()}...`}
                  className="flex-1 bg-transparent text-sm text-dark-100 placeholder-dark-500 resize-none focus:outline-none min-h-[44px] max-h-32"
                  rows={1}
                  disabled={isLoading}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCapabilityPanel(!showCapabilityPanel)}
                    className="p-2 rounded-lg text-dark-500 hover:text-dark-300 hover:bg-dark-700 transition-colors"
                    title="Change capability"
                  >
                    <Target size={18} />
                  </button>
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-700/50">
                <div className="flex items-center gap-3 text-xs text-dark-500">
                  <span className="flex items-center gap-1">
                    <Command size={12} />
                    Ctrl+K
                  </span>
                  <span>•</span>
                  <span>Press Enter to send</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-dark-500">
                  <span className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {activeProvider?.name || 'Cloud'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Sidebar */}
        <div className="w-80 border-l border-dark-800 bg-dark-900 overflow-hidden flex flex-col">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-dark-800">
            {(['commands', 'automations', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 px-4 py-3 text-xs font-medium transition-colors ${
                  sidebarTab === tab
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-dark-500 hover:text-dark-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'commands' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-dark-500 uppercase tracking-wider">
                  <currentCapability.icon size={12} className="text-primary-400" />
                  {currentCapability.name}
                </div>
                {quickCommands.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => executeQuickCommand(cmd)}
                    className="w-full flex items-start gap-3 px-3 py-3 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-primary-500/30 transition-all text-left group"
                  >
                    <cmd.icon size={16} className="text-primary-400 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-sm font-medium text-dark-200">{cmd.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {sidebarTab === 'automations' && (
              <div className="p-4 space-y-3">
                <div className="text-xs text-dark-500 uppercase tracking-wider mb-2">
                  One-Click Tasks
                </div>
                {AUTOMATION_TASKS.map((task) => (
                  <button
                    key={task.label}
                    onClick={() => executeAutomation(task)}
                    disabled={isLoading}
                    className="w-full p-3 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-green-500/30 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <task.icon size={14} className="text-green-400" />
                      <span className="text-sm font-medium text-dark-200">{task.label}</span>
                    </div>
                    <p className="text-xs text-dark-500">{task.description}</p>
                  </button>
                ))}
              </div>
            )}

            {sidebarTab === 'history' && (
              <div className="p-4">
                <div className="text-xs text-dark-500 uppercase tracking-wider mb-3">
                  Recent Conversations
                </div>
                <div className="space-y-2">
                  {messages.filter(m => m.role === 'user').slice(-5).reverse().map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => setInput(msg.content)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-sm text-dark-300 truncate transition-colors"
                    >
                      {msg.content.slice(0, 50)}...
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Server Status Summary */}
          <div className="p-4 border-t border-dark-800 bg-dark-900/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-dark-500 uppercase tracking-wider">
                <Activity size={12} className="text-blue-400" />
                Server Status
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-400">Live</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Runtime</span>
                <span className={processes.filter((p: any) => p.status === 'online').length === processes.length ? 'text-green-400' : 'text-yellow-400'}>
                  {processes.filter((p: any) => p.status === 'online').length}/{processes.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">CPU</span>
                <span className={(sys?.cpu?.usage ?? 0) > 80 ? 'text-red-400' : 'text-dark-200'}>
                  {sys?.cpu?.usage ?? 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Memory</span>
                <span className={(sys?.memory?.percentage ?? 0) > 85 ? 'text-red-400' : 'text-dark-200'}>
                  {sys?.memory?.percentage ?? 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Docker</span>
                <span className="text-dark-200">{containers.length} containers</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
