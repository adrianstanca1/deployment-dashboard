import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Activity, Github, Container, ScrollText,
  FolderOpen, Terminal, Rocket, BarChart2, Search, RotateCw,
  Square, Save, AlertCircle, Server, ChevronRight,
} from 'lucide-react';
import { pm2API, systemAPI } from '@/api';
import type { PM2Process } from '@/types';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  action: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, type: 'success' | 'error') => void;
}

export default function CommandPalette({ isOpen, onClose, onNotify }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const processes: PM2Process[] = (qc.getQueryData(['pm2-list']) as { data?: PM2Process[] } | undefined)?.data ?? [];

  const nav = (to: string) => { navigate(to); onClose(); };

  const exec = async (fn: () => Promise<unknown>, label: string) => {
    onClose();
    try {
      await fn();
      onNotify?.(`${label} succeeded`, 'success');
      qc.invalidateQueries({ queryKey: ['pm2-list'] });
    } catch (e: unknown) {
      onNotify?.(`${label} failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  const COMMANDS: Command[] = [
    { id: 'nav-overview', label: 'Overview', description: 'Dashboard overview', icon: <LayoutDashboard size={14}/>, group: 'Navigate', action: () => nav('/overview') },
    { id: 'nav-pm2', label: 'Runtime Processes', description: 'Manage PM2 processes', icon: <Activity size={14}/>, group: 'Navigate', action: () => nav('/pm2') },
    { id: 'nav-terminal', label: 'Terminal', description: 'Open shell terminal', icon: <Terminal size={14}/>, group: 'Navigate', action: () => nav('/terminal') },
    { id: 'nav-deploy', label: 'Deploy Manager', description: 'Deploy new apps', icon: <Rocket size={14}/>, group: 'Navigate', action: () => nav('/deploy') },
    { id: 'nav-monitor', label: 'System Monitor', description: 'CPU, memory, disk charts', icon: <BarChart2 size={14}/>, group: 'Navigate', action: () => nav('/monitor') },
    { id: 'nav-github', label: 'GitHub Repos', icon: <Github size={14}/>, group: 'Navigate', action: () => nav('/github') },
    { id: 'nav-docker', label: 'Docker', icon: <Container size={14}/>, group: 'Navigate', action: () => nav('/docker') },
    { id: 'nav-logs', label: 'Live Logs', icon: <ScrollText size={14}/>, group: 'Navigate', action: () => nav('/logs') },
    { id: 'nav-server', label: 'Server Files', icon: <FolderOpen size={14}/>, group: 'Navigate', action: () => nav('/server') },
    { id: 'pm2-restart-errored', label: 'Restart Errored Runtime Processes', icon: <AlertCircle size={14}/>, group: 'PM2 Actions', action: () => exec(() => fetch('/api/pm2/restart-errored', { method: 'POST' }).then(r => r.json()), 'Restart errored') },
    { id: 'pm2-save', label: 'PM2 Save', description: 'Save process list', icon: <Save size={14}/>, group: 'PM2 Actions', action: () => exec(() => pm2API.save(), 'PM2 save') },
    { id: 'sys-nginx-reload', label: 'Nginx Reload', description: 'nginx -s reload', icon: <Server size={14}/>, group: 'System', action: () => exec(() => systemAPI.exec('nginx -s reload'), 'Nginx reload') },
    { id: 'sys-nginx-test', label: 'Nginx Config Test', description: 'nginx -t', icon: <Server size={14}/>, group: 'System', action: () => exec(() => systemAPI.exec('nginx -t'), 'Nginx test') },
    ...processes.map(p => ({
      id: `restart-${p.name}`,
      label: `Restart: ${p.name}`,
      icon: <RotateCw size={14} className="text-blue-400"/>,
      group: 'Processes',
      action: () => exec(() => pm2API.restart(p.name), `Restart ${p.name}`),
    })),
    ...processes.filter(p => p.status === 'online').map(p => ({
      id: `stop-${p.name}`,
      label: `Stop: ${p.name}`,
      icon: <Square size={14} className="text-yellow-400"/>,
      group: 'Processes',
      action: () => exec(() => pm2API.stop(p.name), `Stop ${p.name}`),
    })),
    ...processes.map(p => ({
      id: `logs-${p.name}`,
      label: `Logs: ${p.name}`,
      icon: <ScrollText size={14} className="text-dark-400"/>,
      group: 'Processes',
      action: () => { navigate(`/logs?process=${encodeURIComponent(p.name)}`); onClose(); },
    })),
  ];

  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS.slice(0, 22);

  const groups = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    (acc[cmd.group] ??= []).push(cmd);
    return acc;
  }, {});

  const flat = Object.values(groups).flat();

  useEffect(() => {
    if (isOpen) { setQuery(''); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [isOpen]);

  useEffect(() => { setSelected(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && flat[selected]) { flat[selected].action(); }
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  let idx = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-dark-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl mx-4 bg-dark-900 border border-dark-600 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700">
          <Search size={15} className="text-dark-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, services, pages..."
            className="flex-1 bg-transparent text-sm text-dark-100 placeholder-dark-500 outline-none"
          />
          <kbd className="text-xs text-dark-600 border border-dark-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[420px] overflow-auto py-1">
          {flat.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-dark-500">No commands found</div>
          )}
          {Object.entries(groups).map(([group, cmds]) => (
            <div key={group}>
              <div className="px-4 py-1.5 text-xs font-semibold text-dark-600 uppercase tracking-wider">
                {group}
              </div>
              {cmds.map(cmd => {
                const i = idx++;
                const isSel = i === selected;
                return (
                  <button
                    key={cmd.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSel ? 'bg-primary-600/15 text-dark-100' : 'text-dark-300 hover:bg-dark-800'
                    }`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <span className={isSel ? 'text-primary-400' : 'text-dark-500'}>{cmd.icon}</span>
                    <span className="text-sm flex-1">{cmd.label}</span>
                    {cmd.description && <span className="text-xs text-dark-600">{cmd.description}</span>}
                    {isSel && <ChevronRight size={12} className="text-dark-600" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-dark-800 text-xs text-dark-600">
          <span><kbd className="border border-dark-700 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border border-dark-700 rounded px-1">↵</kbd> run</span>
          <span className="ml-auto"><kbd className="border border-dark-700 rounded px-1">Ctrl+K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
