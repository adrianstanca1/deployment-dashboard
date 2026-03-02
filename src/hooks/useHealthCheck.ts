import { useQuery } from '@tanstack/react-query';

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthStatus {
  service: string;
  name: string;
  status: ServiceStatus;
  latency: number;
  lastChecked: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: ServiceStatus;
  services: HealthStatus[];
  timestamp: string;
}

export function useHealthCheck() {
  return useQuery<SystemHealth>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Failed to fetch health status');
      return response.json();
    },
    refetchInterval: 30000, // 30 seconds
    staleTime: 10000,
  });
}

export function useHealthHistory() {
  return useQuery<SystemHealth[]>({
    queryKey: ['health', 'history'],
    queryFn: async () => {
      const response = await fetch('/api/health/history');
      if (!response.ok) throw new Error('Failed to fetch health history');
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
  });
}

export function getStatusColor(status: ServiceStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-green-500 bg-green-500/10 border-green-500/30';
    case 'degraded':
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    case 'unhealthy':
      return 'text-red-500 bg-red-500/10 border-red-500/30';
    default:
      return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
  }
}

export function getStatusIcon(status: ServiceStatus): string {
  switch (status) {
    case 'healthy':
      return '✓';
    case 'degraded':
      return '⚠';
    case 'unhealthy':
      return '✗';
    default:
      return '?';
  }
}
