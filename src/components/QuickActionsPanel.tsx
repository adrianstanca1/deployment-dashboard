import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, AlertCircle, Rocket, Container, Terminal, Activity,
  X, Keyboard, Zap, RotateCw, CheckCircle, ChevronRight,
  HeartPulse, Sparkles, Trash2
} from 'lucide-react';
import { pm2ExtraAPI, dockerAPI, systemAPI, pm2API } from '@/api';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink';
  action: () => void | Promise<void>;
  badge?: number;
}

interface QuickActionsPanelProps {
  /** Called when an action is triggered */
  onAction?: (actionId: string) => void;
  /** Called when a notification needs to be shown */
  onNotify?: (title: string, type: 'success' | 'error') => void;
  /** Called to open the command palette */
  onOpenCommandPalette?: () => void;
  /** Position of the FAB (default: bottom-right) */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Color Maps
// ============================================================================

const colorMap = {
  blue:   { bg: 'bg-blue-500',   hover: 'hover:bg-blue-400',   ring: 'ring-blue-500/30',   text: 'text-blue-400',   light: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  green:  { bg: 'bg-green-500',  hover: 'hover:bg-green-400',  ring: 'ring-green-500/30',  text: 'text-green-400',  light: 'bg-green-500/10',  border: 'border-green-500/30' },
  yellow: { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-400', ring: 'ring-yellow-500/30', text: 'text-yellow-400', light: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  red:    { bg: 'bg-red-500',    hover: 'hover:bg-red-400',    ring: 'ring-red-500/30',    text: 'text-red-400',    light: 'bg-red-500/10',    border: 'border-red-500/30' },
  purple: { bg: 'bg-purple-500', hover: 'hover:bg-purple-400', ring: 'ring-purple-500/30', text: 'text-purple-400', light: 'bg-purple-500/10', border: 'border-purple-500/30' },
  pink:   { bg: 'bg-pink-500',   hover: 'hover:bg-pink-400',   ring: 'ring-pink-500/30',   text: 'text-pink-400',   light: 'bg-pink-500/10',   border: 'border-pink-500/30' },
} as const;

// ============================================================================
// QuickActionsPanel Component
// ============================================================================

export default function QuickActionsPanel({
  onAction,
  onNotify,
  onOpenCommandPalette,
  position = 'bottom-right',
  className = '',
}: QuickActionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Fetch data for badges
  const { data: pm2Data } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 5000,
  });

  const { data: dockerData } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: dockerAPI.getContainers,
    refetchInterval: 10000,
  });

  const processes = pm2Data?.data ?? [];
  const containers = dockerData?.data ?? [];
  const erroredCount = processes.filter((p: any) => p.status === 'errored').length;
  const stoppedContainers = containers.filter((c: any) => !c.status?.startsWith('Up')).length;

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleRestartErrored = useCallback(async () => {
    setActiveAction('restart-errored');
    try {
      await fetch('/api/pm2/restart-errored', { method: 'POST' });
      qc.invalidateQueries({ queryKey: ['pm2-list'] });
      onNotify?.('Restarted errored runtime processes', 'success');
    } catch {
      onNotify?.('Failed to restart errored runtime processes', 'error');
    } finally {
      setActiveAction(null);
      setIsOpen(false);
    }
    onAction?.('restart-errored');
  }, [qc, onNotify, onAction]);

  const handleDeploy = useCallback(() => {
    navigate('/deploy');
    setIsOpen(false);
    onAction?.('deploy');
  }, [navigate, onAction]);

  const handleCleanDocker = useCallback(async () => {
    setActiveAction('clean-docker');
    try {
      await dockerAPI.prune('all');
      qc.invalidateQueries({ queryKey: ['docker-containers'] });
      qc.invalidateQueries({ queryKey: ['docker-images'] });
      onNotify?.('Docker cleanup completed', 'success');
    } catch {
      onNotify?.('Docker cleanup failed', 'error');
    } finally {
      setActiveAction(null);
      setIsOpen(false);
    }
    onAction?.('clean-docker');
  }, [qc, onNotify, onAction]);

  const handleOpenTerminal = useCallback(() => {
    navigate('/terminal');
    setIsOpen(false);
    onAction?.('terminal');
  }, [navigate, onAction]);

  const handleHealthCheck = useCallback(async () => {
    setActiveAction('health-check');
    try {
      const pm2Res = await pm2API.getSummary();
      const systemRes = await systemAPI.getStats();

      const pm2Summary = pm2Res.data;
      const systemStats = systemRes.data;

      const allOnline = pm2Summary.errored === 0;
      const healthyCpu = systemStats.cpu.usage < 80;
      const healthyMem = systemStats.memory.percentage < 90;

      if (allOnline && healthyCpu && healthyMem) {
        onNotify?.('All systems healthy', 'success');
      } else {
        const issues = [];
        if (!allOnline) issues.push(`${pm2Summary.errored} errored runtime processes`);
        if (!healthyCpu) issues.push('High CPU usage');
        if (!healthyMem) issues.push('High memory usage');
        onNotify?.(`Health check: ${issues.join(', ')}`, 'error');
      }
    } catch {
      onNotify?.('Health check failed', 'error');
    } finally {
      setActiveAction(null);
      setIsOpen(false);
    }
    onAction?.('health-check');
  }, [onNotify, onAction]);

  const handleCommandPalette = useCallback(() => {
    onOpenCommandPalette?.();
    setIsOpen(false);
    onAction?.('command-palette');
  }, [onOpenCommandPalette, onAction]);

  // ============================================================================
  // Quick Actions Definition
  // ============================================================================

  const quickActions: QuickAction[] = [
    {
      id: 'restart-errored',
      label: 'Restart Errored',
      description: 'Restart all errored PM2-managed processes',
      icon: <RotateCw size={18} />,
      shortcut: 'R',
      color: 'red',
      action: handleRestartErrored,
      badge: erroredCount > 0 ? erroredCount : undefined,
    },
    {
      id: 'deploy',
      label: 'Deploy App',
      description: 'Open deploy manager',
      icon: <Rocket size={18} />,
      shortcut: 'D',
      color: 'blue',
      action: handleDeploy,
    },
    {
      id: 'clean-docker',
      label: 'Clean Docker',
      description: 'Remove unused containers, images, volumes',
      icon: <Trash2 size={18} />,
      shortcut: 'C',
      color: 'yellow',
      action: handleCleanDocker,
      badge: stoppedContainers > 0 ? stoppedContainers : undefined,
    },
    {
      id: 'terminal',
      label: 'Open Terminal',
      description: 'Open shell terminal',
      icon: <Terminal size={18} />,
      shortcut: 'T',
      color: 'purple',
      action: handleOpenTerminal,
    },
    {
      id: 'health-check',
      label: 'Health Check',
      description: 'Run system health diagnostics',
      icon: <HeartPulse size={18} />,
      shortcut: 'H',
      color: 'green',
      action: handleHealthCheck,
    },
  ];

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle panel with Shift+/
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        setShowShortcuts(s => !s);
        return;
      }

      // Close shortcuts with Escape
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        return;
      }

      // Quick actions when panel is open
      if (isOpen) {
        const action = quickActions.find(a =>
          a.shortcut?.toLowerCase() === e.key.toLowerCase()
        );
        if (action) {
          e.preventDefault();
          action.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, quickActions]);

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ============================================================================
  // Position Classes
  // ============================================================================

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  const menuPositionClasses = {
    'bottom-right': 'bottom-full right-0 mb-3',
    'bottom-left': 'bottom-full left-0 mb-3',
    'top-right': 'top-full right-0 mt-3',
    'top-left': 'top-full left-0 mt-3',
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Main FAB Container */}
      <div
        ref={panelRef}
        className={`fixed z-40 flex flex-col items-end ${positionClasses[position]} ${className}`}
      >
        {/* Quick Actions Menu */}
        <div
          className={`
            absolute ${menuPositionClasses[position]} w-72
            transition-all duration-300 ease-out origin-bottom-right
            ${isOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            }
          `}
        >
          {/* Menu Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-dark-800 border border-dark-700 rounded-t-xl">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary-400" />
              <span className="text-sm font-semibold text-dark-100">Quick Actions</span>
            </div>
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-1.5 text-dark-500 hover:text-dark-300 hover:bg-dark-700 rounded transition-colors"
              title="Keyboard shortcuts"
            >
              <Keyboard size={13} />
            </button>
          </div>

          {/* Menu Items */}
          <div className="bg-dark-900 border-x border-b border-dark-700 rounded-b-xl overflow-hidden">
            {quickActions.map((action, index) => {
              const colors = colorMap[action.color];
              const isActive = activeAction === action.id;
              const delay = index * 50;

              return (
                <button
                  key={action.id}
                  onClick={action.action}
                  disabled={isActive}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3
                    transition-all duration-200 group
                    ${isActive ? 'bg-dark-800' : 'hover:bg-dark-800'}
                    ${index < quickActions.length - 1 ? 'border-b border-dark-800' : ''}
                    ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
                  `}
                  style={{ transitionDelay: `${delay}ms` }}
                >
                  {/* Icon */}
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center
                    transition-all duration-200
                    ${colors.light} ${colors.text}
                    group-hover:scale-110 group-hover:shadow-lg
                    ${isActive ? 'animate-pulse' : ''}
                  `}>
                    {isActive ? (
                      <RotateCw size={18} className="animate-spin" />
                    ) : (
                      action.icon
                    )}
                  </div>

                  {/* Label & Description */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-dark-100">
                        {action.label}
                      </span>
                      {action.badge !== undefined && action.badge > 0 && (
                        <span className={`
                          px-1.5 py-0.5 text-[10px] font-bold rounded-full
                          ${action.color === 'red' ? 'bg-red-500 text-white' : 'bg-primary-500 text-white'}
                        `}>
                          {action.badge}
                        </span>
                      )}
                    </div>
                    {action.description && (
                      <span className="text-xs text-dark-500 block">
                        {action.description}
                      </span>
                    )}
                  </div>

                  {/* Shortcut Hint */}
                  {action.shortcut && (
                    <kbd className="
                      px-1.5 py-0.5 text-[10px] font-mono
                      text-dark-500 border border-dark-700 rounded
                      group-hover:border-dark-600 group-hover:text-dark-400
                      transition-colors
                    ">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}

            {/* Command Palette Link */}
            <button
              onClick={handleCommandPalette}
              className="
                w-full flex items-center justify-center gap-2 px-4 py-3
                text-xs text-dark-500 hover:text-dark-300
                hover:bg-dark-800 transition-colors border-t border-dark-800
              "
            >
              <Zap size={12} />
              More commands
              <kbd className="px-1.5 py-0.5 text-[10px] border border-dark-700 rounded">
                Ctrl+K
              </kbd>
            </button>
          </div>
        </div>

        {/* Floating Action Button */}
        <div className="relative">
          {/* Glow Effect */}
          <div
            className={`
              absolute inset-0 rounded-full bg-primary-500 blur-xl
              transition-all duration-500
              ${isOpen ? 'opacity-40 scale-110' : 'opacity-20 scale-100'}
            `}
          />

          {/* Main Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`
              relative w-14 h-14 rounded-full
              flex items-center justify-center
              bg-gradient-to-br from-primary-500 to-primary-600
              text-white shadow-lg shadow-primary-500/30
              transition-all duration-300 ease-out
              hover:scale-110 hover:shadow-xl hover:shadow-primary-500/40
              active:scale-95
              ${isOpen ? 'rotate-45' : 'rotate-0'}
            `}
            title={`Quick Actions (${erroredCount > 0 ? `${erroredCount} errored` : 'Open menu'})`}
          >
            {isOpen ? (
              <X size={24} className="transition-transform duration-300" />
            ) : (
              <Plus size={24} className="transition-transform duration-300" />
            )}
          </button>

          {/* Status Indicator */}
          {erroredCount > 0 && !isOpen && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg animate-bounce">
              {erroredCount}
            </div>
          )}

          {/* Pulse Animation for Health */}
          {erroredCount === 0 && !isOpen && (
            <div className="absolute inset-0 rounded-full bg-primary-500/30 animate-ping" />
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-800">
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-primary-400" />
                <span className="font-semibold text-dark-100">Keyboard Shortcuts</span>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1.5 text-dark-500 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="p-4 space-y-3">
              {/* Quick Actions */}
              <div>
                <h4 className="text-xs font-semibold text-dark-600 uppercase tracking-wider mb-2">
                  Quick Actions Panel
                </h4>
                <div className="space-y-1.5">
                  {quickActions.map(action => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-dark-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`${colorMap[action.color].text}`}>
                          {action.icon}
                        </span>
                        <span className="text-sm text-dark-300">{action.label}</span>
                      </div>
                      <kbd className="px-2 py-0.5 text-xs text-dark-500 border border-dark-700 rounded bg-dark-800">
                        {action.shortcut}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-dark-800" />

              {/* Global Shortcuts */}
              <div>
                <h4 className="text-xs font-semibold text-dark-600 uppercase tracking-wider mb-2">
                  Global
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between py-1.5 px-2">
                    <span className="text-sm text-dark-300">Command Palette</span>
                    <kbd className="px-2 py-0.5 text-xs text-dark-500 border border-dark-700 rounded bg-dark-800">
                      Ctrl+K
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2">
                    <span className="text-sm text-dark-300">Show Shortcuts</span>
                    <kbd className="px-2 py-0.5 text-xs text-dark-500 border border-dark-700 rounded bg-dark-800">
                      Shift+/
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2">
                    <span className="text-sm text-dark-300">Close / Cancel</span>
                    <kbd className="px-2 py-0.5 text-xs text-dark-500 border border-dark-700 rounded bg-dark-800">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-dark-950/50 border-t border-dark-800 text-center">
              <span className="text-xs text-dark-600">
                Press <kbd className="px-1 border border-dark-700 rounded">Shift+/</kbd> anytime to show shortcuts
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Re-export types
// ============================================================================

export type { QuickActionsPanelProps };
