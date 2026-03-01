import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pm2API } from '@/api';
import type { PM2Process, Project } from '@/types';

export function usePM2Status() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pm2-list'],
    queryFn: pm2API.getList,
    refetchInterval: 5000,
    retry: 1,
  });

  const startMutation = useMutation({
    mutationFn: pm2API.start,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pm2-list'] }); },
  });

  const stopMutation = useMutation({
    mutationFn: pm2API.stop,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pm2-list'] }); },
  });

  const restartMutation = useMutation({
    mutationFn: pm2API.restart,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pm2-list'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: pm2API.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pm2-list'] }); },
  });

  const processes: PM2Process[] = data?.data ?? [];

  const projects: Project[] = processes.map((proc) => ({
    id: String(proc.pm_id),
    name: proc.name,
    path: proc.pm2_env.pm_cwd,
    status: proc.status === 'online' ? 'online' : proc.status === 'errored' ? 'error' : 'stopped',
    pm_id: proc.pm_id,
    port: parseInt(proc.pm2_env.env.PORT ?? '0'),
    memory: proc.monit.memory,
    cpu: proc.monit.cpu,
    uptime: (proc.pm2_env.pm_uptime ?? 0) / 1000,
    pid: proc.pid,
    restarts: proc.pm2_env.restart_time,
  }));

  return {
    processes,
    projects,
    isLoading,
    error,
    refetch,
    startProcess: startMutation.mutateAsync,
    stopProcess: stopMutation.mutateAsync,
    restartProcess: restartMutation.mutateAsync,
    deleteProcess: deleteMutation.mutateAsync,
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isRestarting: restartMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
