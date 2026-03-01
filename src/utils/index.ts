import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatUptime(seconds: number): string {
  if (seconds < 0) return 'N/A';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  } else {
    return formatDate(dateString);
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'online':
      return 'text-green-400';
    case 'running':
      return 'text-green-400';
    case 'error':
    case 'errored':
      return 'text-red-400';
    case 'stopped':
    case 'stopping':
      return 'text-yellow-400';
    case 'launching':
      return 'text-blue-400';
    case 'not-deployed':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

export function getStatusBadge(status: string): string {
  switch (status) {
    case 'online':
    case 'running':
      return 'status-online';
    case 'error':
    case 'errored':
      return 'status-error';
    case 'stopped':
    case 'stopping':
      return 'status-stopped';
    default:
      return 'status-gray';
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'online':
    case 'running':
      return '✓';
    case 'error':
    case 'errored':
      return '✕';
    case 'stopped':
    case 'stopping':
      return '⏸';
    case 'launching':
      return '⟳';
    default:
      return '○';
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function extractRepoName(fullName: string): string {
  return fullName.split('/')[1] || fullName;
}

export function getLanguageColor(language: string | null): string {
  const colors: Record<string, string> = {
    TypeScript: 'bg-blue-500',
    JavaScript: 'bg-yellow-500',
    Python: 'bg-green-500',
    Java: 'bg-red-500',
    Go: 'bg-cyan-500',
    Rust: 'bg-orange-500',
    Ruby: 'bg-pink-500',
    PHP: 'bg-purple-500',
    CSharp: 'bg-purple-600',
    'C#': 'bg-purple-600',
    Cpp: 'bg-blue-600',
    'C++': 'bg-blue-600',
    HTML: 'bg-orange-600',
    CSS: 'bg-blue-400',
    Shell: 'bg-gray-600',
    Vim: 'bg-green-600',
    Dockerfile: 'bg-blue-500',
  };
  return colors[language || ''] || 'bg-gray-500';
}

export function parseGitRemote(remote: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com[:/]([^/]+)\/([^.]+)\.git/,
    /github\.com\/([^/]+)\/([^.]+)/,
  ];

  for (const pattern of patterns) {
    const match = remote.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }
  return null;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/** Build a WebSocket URL with the auth token injected as ?token= */
export function wsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = localStorage.getItem('dashboard_token') ?? '';
  const sep = path.includes('?') ? '&' : '?';
  return `${protocol}//${window.location.host}${path}${sep}token=${encodeURIComponent(token)}`;
}
