import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Activity, Github, Container, ScrollText,
  FolderOpen, ChevronLeft, ChevronRight, Terminal, Rocket,
  BarChart2, Zap, Server, LogOut, User, Bot, Settings, Key,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  onOpenPalette: () => void;
  aiFailureCount?: number;
}

const topNav = [
  { to: '/command-center', icon: LayoutDashboard, label: 'Command Center' },
  { to: '/ai-assistant', icon: Bot, label: 'AI Assistant' },
  { to: '/ai-settings', icon: Settings, label: 'AI Settings' },
  { to: '/overview', icon: Activity, label: 'Overview' },
  { to: '/pm2', icon: Server, label: 'Runtime Processes' },
  { to: '/monitor', icon: BarChart2, label: 'System Monitor' },
  { to: '/deploy', icon: Rocket, label: 'Deploy' },
];

const bottomNav = [
  { to: '/github', icon: Github, label: 'GitHub' },
  { to: '/docker', icon: Container, label: 'Docker' },
  { to: '/logs', icon: ScrollText, label: 'Live Logs' },
  { to: '/file-manager', icon: FolderOpen, label: 'Server Files' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ open, onToggle, onOpenPalette, aiFailureCount = 0 }: SidebarProps) {
  const { username, logout } = useAuth();

  return (
    <aside className={`flex flex-col bg-dark-900 border-r border-dark-700 transition-all duration-300 shrink-0 ${open ? 'w-56' : 'w-14'}`}>
      {/* Logo / header */}
      <div className="flex items-center h-14 px-3 border-b border-dark-700 gap-2">
        {open && (
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            <Server size={16} className="text-primary-400 shrink-0" />
            <span className="font-bold text-sm text-dark-100 whitespace-nowrap">Deploy Hub</span>
          </div>
        )}
        {!open && <Server size={16} className="text-primary-400 mx-auto" />}
        <button onClick={onToggle} className="text-dark-500 hover:text-dark-200 transition-colors ml-auto">
          {open ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>

      {/* Terminal button — prominent */}
      <div className={`px-2 pt-3 pb-1 ${open ? '' : 'flex justify-center'}`}>
        <NavLink
          to="/terminal"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 ${open ? 'px-3 py-2.5' : 'p-2.5 justify-center'} ${
              isActive
                ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                : 'bg-dark-800 text-dark-300 hover:text-dark-100 hover:bg-dark-700 border border-dark-700'
            }`
          }
          title="Terminal"
        >
          <Terminal size={16} className="shrink-0" />
          {open && 'Terminal'}
        </NavLink>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-dark-800" />

      {/* Top nav group */}
      <nav className="px-2 space-y-0.5">
        {topNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all duration-150 ${open ? '' : 'justify-center'} ${
                isActive
                  ? 'bg-primary-600/12 text-primary-400'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
              }`
            }
            title={!open ? label : undefined}
          >
            <Icon size={16} className="shrink-0" />
            {open && <span>{label}</span>}
            {to === '/ai-settings' && aiFailureCount > 0 && (
              <span
                className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300 ${
                  open ? '' : 'absolute -top-1 -right-1'
                }`}
              >
                {aiFailureCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 my-2 border-t border-dark-800" />

      {/* Bottom nav group */}
      <nav className="px-2 space-y-0.5">
        {bottomNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all duration-150 ${open ? '' : 'justify-center'} ${
                isActive
                  ? 'bg-primary-600/12 text-primary-400'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
              }`
            }
            title={!open ? label : undefined}
          >
            <Icon size={16} className="shrink-0" />
            {open && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Ctrl+K hint / Command palette button */}
      <div className="p-2 border-t border-dark-800 space-y-1">
        <button
          onClick={onOpenPalette}
          className={`flex items-center gap-2 w-full px-2 py-2 rounded-lg text-dark-500 hover:text-dark-200 hover:bg-dark-800 transition-colors text-xs ${open ? '' : 'justify-center'}`}
          title="Command palette"
        >
          <Zap size={14} className="shrink-0" />
          {open && <span className="flex-1 text-left">Commands</span>}
          {open && <kbd className="border border-dark-700 rounded px-1 text-xs">⌘K</kbd>}
        </button>

        {/* User + logout */}
        <button
          onClick={logout}
          className={`flex items-center gap-2 w-full px-2 py-2 rounded-lg text-dark-600 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs ${open ? '' : 'justify-center'}`}
          title={open ? undefined : `Sign out (${username})`}
        >
          {open ? (
            <>
              <User size={13} className="shrink-0" />
              <span className="flex-1 text-left truncate">{username}</span>
              <LogOut size={12} />
            </>
          ) : (
            <LogOut size={14} />
          )}
        </button>
      </div>
    </aside>
  );
}
