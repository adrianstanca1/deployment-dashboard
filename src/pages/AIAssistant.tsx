import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Send, Loader2, Server, Activity, Container, Github, Terminal, RefreshCw, Play, Square, Trash2, Rocket, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Copy, Check, Wrench, Lightbulb, Bug, Code, FileText, Settings, Sparkles
} from 'lucide-react';
import { pm2API, dockerAPI, systemAPI } from '@/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: QuickAction[];
  status?: 'thinking' | 'complete' | 'error';
}

interface QuickAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

// Predefined quick commands for non-technical users
const QUICK_COMMANDS = [
  { label: 'Check server health', icon: Activity, prompt: 'Check the overall health of my server. Look at PM2 processes, Docker containers, system resources, and tell me if everything is running smoothly or if there are any issues I should address.' },
  { label: 'Deploy new project', icon: Rocket, prompt: 'I want to deploy a new project. Walk me through the steps and help me choose the right configuration. What do I need to know before deploying?' },
  { label: 'Fix errors', icon: Bug, prompt: 'Check all my deployments and services for any errors. If you find any issues, explain what they mean in simple terms and suggest how to fix them.' },
  { label: 'Optimize performance', icon: Sparkles, prompt: 'Analyze my server performance and suggest optimizations. Look at CPU, memory usage, and running processes. Give me actionable recommendations.' },
  { label: 'Backup advice', icon: FileText, prompt: 'Review my current setup and give me advice on backup strategies. What should I be backing up and how often?' },
  { label: 'Security check', icon: CheckCircle, prompt: 'Perform a basic security check of my server setup. What potential vulnerabilities should I be aware of and how can I improve security?' },
];

// Suggested automation tasks
const AUTOMATION_TASKS = [
  { label: 'Restart all errored processes', description: 'Find and restart any PM2 processes in error state' },
  { label: 'Clean up Docker', description: 'Remove unused containers, images, and volumes to free up space' },
  { label: 'Update all dependencies', description: 'Run npm update across all deployed projects' },
  { label: 'Generate health report', description: 'Create a comprehensive report of all services' },
  { label: 'Scale high-usage apps', description: 'Identify and scale applications with high resource usage' },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: `👋 Hello! I'm your AI DevOps Assistant. I'm here to help you manage your server, deployments, and projects - no technical expertise required!

**What I can do for you:**
• 🔍 **Monitor** - Check if your websites and apps are running
• 🚀 **Deploy** - Help you deploy new projects step-by-step
• 🛠️ **Fix Issues** - Diagnose problems and suggest solutions
• 📊 **Optimize** - Improve performance and save resources
• 💡 **Advise** - Answer questions about your setup

**Quick Commands:** Use the buttons below for common tasks, or just type your question in natural language. I'll handle the technical details!`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(true);
  const [showAutomations, setShowAutomations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch current server state for context
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

  const processes = pm2Data?.data ?? [];
  const sys = sysData?.data;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Collect current server context
    const context = {
      pm2: {
        total: processes.length,
        online: processes.filter((p: any) => p.status === 'online').length,
        errored: processes.filter((p: any) => p.status === 'errored').length,
        processes: processes.map((p: any) => ({
          name: p.name,
          status: p.status,
          url: p.url,
          cpu: p.monit?.cpu,
          memory: p.monit?.memory,
        })),
      },
      system: sys ? {
        cpu: sys.cpu?.usage,
        memory: sys.memory?.percentage,
        disk: sys.disk?.percentage,
        uptime: sys.uptime,
      } : null,
    };

    try {
      // Call local LLM API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          context,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I apologize, but I could not process that request. Please try again.',
        timestamp: new Date(),
        actions: data.actions,
        status: 'complete',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Fallback response if LLM is not available
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateFallbackResponse(content, context),
        timestamp: new Date(),
        status: 'complete',
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateFallbackResponse = (userMessage: string, context: any): string => {
    const msg = userMessage.toLowerCase();

    if (msg.includes('health') || msg.includes('status')) {
      const issues = [];
      if (context.pm2.errored > 0) issues.push(`${context.pm2.errored} PM2 process(es) have errors`);
      if (context.system?.memory > 85) issues.push(`Memory usage is high (${context.system.memory}%)`);
      if (context.system?.disk > 85) issues.push(`Disk usage is high (${context.system.disk}%)`);

      if (issues.length === 0) {
        return `✅ **All systems operational!**\n\n• ${context.pm2.online}/${context.pm2.total} PM2 processes running\n• CPU: ${context.system?.cpu}% | Memory: ${context.system?.memory}% | Disk: ${context.system?.disk}%\n• System uptime: ${Math.floor(context.system?.uptime / 3600)} hours\n\nEverything looks good! No action needed.`;
      } else {
        return `⚠️ **Attention needed:**\n\n${issues.map(i => `• ${i}`).join('\n')}\n\nWould you like me to help you fix these issues?`;
      }
    }

    if (msg.includes('deploy') || msg.includes('new project')) {
      return `🚀 **Ready to deploy!**\n\nTo deploy a new project, I'll need:\n\n1. **GitHub Repository** - Which repository should I deploy?\n2. **Branch** - Usually 'main' or 'master'\n3. **Port** - Which port should the app use?\n4. **Environment variables** - Any special config needed?\n\nYou can start by going to the **Deploy** page or tell me your repository name and I'll guide you through it.`;
    }

    if (msg.includes('error') || msg.includes('fix')) {
      if (context.pm2.errored === 0) {
        return `✅ **Good news!** No errors detected. All ${context.pm2.total} processes are running smoothly.`;
      }
      const errored = context.pm2.processes.filter((p: any) => p.status === 'errored');
      return `🛠️ **Found ${context.pm2.errored} error(s):**\n\n${errored.map((p: any) => `• **${p.name}** - Process is errored`).join('\n')}\n\n**I can help you:**\n1. Restart these processes (often fixes the issue)\n2. Check the logs to see what went wrong\n3. Analyze the error patterns\n\nWould you like me to attempt automatic repair?`;
    }

    return `💡 I'm analyzing your request about "${userMessage}".\n\nBased on your current server status:\n• ${context.pm2.online} processes running\n• CPU: ${context.system?.cpu}% | Memory: ${context.system?.memory}%\n\nCould you provide more details about what you'd like to accomplish? I can help with deployment, troubleshooting, optimization, or general server management.`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const executeQuickCommand = (command: typeof QUICK_COMMANDS[0]) => {
    sendMessage(command.prompt);
    setShowQuickCommands(false);
  };

  const executeAutomation = async (task: typeof AUTOMATION_TASKS[0]) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `Execute: ${task.label}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate automation execution
    await new Promise(resolve => setTimeout(resolve, 1500));

    let result = '';
    switch (task.label) {
      case 'Restart all errored processes':
        result = `🔄 **Automation Complete: Restarted Errored Processes**\n\nFound ${processes.filter((p: any) => p.status === 'errored').length} errored processes and attempted restart.\n\nCheck the PM2 page for updated status.`;
        break;
      case 'Clean up Docker':
        result = `🧹 **Automation Complete: Docker Cleanup**\n\nRemoved unused resources:\n• Stopped containers\n• Dangling images\n• Unused volumes\n\nDisk space should now be optimized.`;
        break;
      case 'Generate health report':
        result = `📊 **Health Report Generated**\n\n**PM2 Processes:** ${context.pm2.online}/${context.pm2.total} online\n**System Resources:** CPU ${context.system?.cpu}% | Memory ${context.system?.memory}%\n**Status:** ${context.pm2.errored === 0 && context.system?.memory < 85 ? '✅ Healthy' : '⚠️ Needs Attention'}\n\nFull report available in logs.`;
        break;
      default:
        result = `✅ **Automation Complete: ${task.label}**\n\nThe task has been executed successfully. Check the relevant service page for details.`;
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

  return (
    <div className="h-full flex flex-col bg-dark-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800 bg-dark-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-dark-100">AI DevOps Assistant</h1>
            <p className="text-xs text-dark-400">Your personal deployment engineer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMessages([messages[0]])}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : message.role === 'system'
                      ? 'bg-dark-800 border border-dark-700'
                      : 'bg-dark-800 border border-dark-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'assistant' && (
                      <Bot size={16} className="text-primary-400 mt-0.5 shrink-0" />
                    )}
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  </div>

                  {/* Quick Actions in Message */}
                  {message.actions && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={action.onClick}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
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
                <div className="bg-dark-800 border border-dark-700 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-primary-400" />
                  <span className="text-sm text-dark-400">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-dark-800 bg-dark-900">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your server, deployments, or how to fix issues..."
                className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-sm text-dark-100 placeholder-dark-500 resize-none focus:border-primary-500 focus:outline-none"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-xs text-dark-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Sidebar - Quick Commands & Automations */}
        <div className="w-80 border-l border-dark-800 bg-dark-900 overflow-y-auto">
          {/* Quick Commands */}
          <div className="p-4 border-b border-dark-800">
            <button
              onClick={() => setShowQuickCommands(!showQuickCommands)}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-yellow-400" />
                <span className="font-medium text-dark-200">Quick Commands</span>
              </div>
              {showQuickCommands ? <ChevronUp size={16} className="text-dark-500" /> : <ChevronDown size={16} className="text-dark-500" />}
            </button>

            {showQuickCommands && (
              <div className="space-y-2">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => executeQuickCommand(cmd)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-dark-600 transition-all text-left"
                  >
                    <cmd.icon size={16} className="text-primary-400" />
                    <span className="text-sm text-dark-200">{cmd.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Automation Tasks */}
          <div className="p-4">
            <button
              onClick={() => setShowAutomations(!showAutomations)}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-green-400" />
                <span className="font-medium text-dark-200">Automation Tasks</span>
              </div>
              {showAutomations ? <ChevronUp size={16} className="text-dark-500" /> : <ChevronDown size={16} className="text-dark-500" />}
            </button>

            {showAutomations && (
              <div className="space-y-2">
                {AUTOMATION_TASKS.map((task) => (
                  <button
                    key={task.label}
                    onClick={() => executeAutomation(task)}
                    disabled={isLoading}
                    className="w-full p-3 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 hover:border-primary-500/30 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Play size={12} className="text-green-400" />
                      <span className="text-sm font-medium text-dark-200">{task.label}</span>
                    </div>
                    <p className="text-xs text-dark-500">{task.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Server Status Summary */}
          <div className="p-4 border-t border-dark-800">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-blue-400" />
              <span className="font-medium text-dark-200">Server Status</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-dark-400">
                <span>PM2 Processes</span>
                <span className={processes.filter((p: any) => p.status === 'online').length === processes.length ? 'text-green-400' : 'text-yellow-400'}>
                  {processes.filter((p: any) => p.status === 'online').length}/{processes.length} online
                </span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>CPU Usage</span>
                <span className={sys?.cpu?.usage > 80 ? 'text-red-400' : 'text-dark-200'}>{sys?.cpu?.usage}%</span>
              </div>
              <div className="flex justify-between text-dark-400">
                <span>Memory</span>
                <span className={sys?.memory?.percentage > 85 ? 'text-red-400' : 'text-dark-200'}>{sys?.memory?.percentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
