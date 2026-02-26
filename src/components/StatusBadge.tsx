import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusMap: Record<string, { label: string; className: string; dot: string }> = {
  online: { label: 'online', className: 'bg-green-500/10 text-green-400 border border-green-500/20', dot: 'bg-green-400' },
  running: { label: 'running', className: 'bg-green-500/10 text-green-400 border border-green-500/20', dot: 'bg-green-400' },
  errored: { label: 'errored', className: 'bg-red-500/10 text-red-400 border border-red-500/20', dot: 'bg-red-400' },
  error: { label: 'error', className: 'bg-red-500/10 text-red-400 border border-red-500/20', dot: 'bg-red-400' },
  stopped: { label: 'stopped', className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', dot: 'bg-yellow-400' },
  stopping: { label: 'stopping', className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', dot: 'bg-yellow-400' },
  launching: { label: 'launching', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', dot: 'bg-blue-400' },
  exited: { label: 'exited', className: 'bg-gray-500/10 text-gray-400 border border-gray-500/20', dot: 'bg-gray-400' },
  paused: { label: 'paused', className: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', dot: 'bg-purple-400' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusMap[status] ?? {
    label: status,
    className: 'bg-dark-700/50 text-dark-400 border border-dark-600',
    dot: 'bg-dark-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
    } ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === 'online' || status === 'running' ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}
