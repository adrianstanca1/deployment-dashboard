import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pm2API, pm2ExtraAPI } from '@/api';
import { useStore } from '@/store';
import type { PM2Process } from '@/types';

const PM2_LIST_QUERY_KEY = ['pm2-list'];

interface OptimisticContext {
  previousProcesses: PM2Process[] | undefined;
}

export function usePM2() {
  const qc = useQueryClient();
  const {
    pm2SelectedNames,
    pm2PendingNames,
    togglePM2Selection,
    clearPM2Selection,
    selectAllPM2,
    isPM2Selected,
    addPMPending,
    removePMPending,
    clearPMPending,
    isPMPending,
    showToast,
  } = useStore();

  // Query for fetching PM2 processes
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: PM2_LIST_QUERY_KEY,
    queryFn: async () => {
      const response = await pm2API.getList();
      return response.data ?? [];
    },
    refetchInterval: 5000,
    staleTime: 4000,
  });

  const processes: PM2Process[] = data ?? [];

  // Helper to optimistically update process status
  const optimisticUpdateStatus = (
    name: string,
    status: string,
    context: OptimisticContext
  ) => {
    qc.setQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY, (old) => {
      if (!old) return old;
      return old.map((p) =>
        p.name === name ? { ...p, status } : p
      );
    });
  };

  // Start mutation with optimistic update
  const startMutation = useMutation({
    mutationFn: (name: string) => pm2API.start(name),
    onMutate: async (name): Promise<OptimisticContext> => {
      addPMPending(name);
      await qc.cancelQueries({ queryKey: PM2_LIST_QUERY_KEY });
      const previousProcesses = qc.getQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY);
      optimisticUpdateStatus(name, 'launching', { previousProcesses });
      return { previousProcesses };
    },
    onError: (err, name, context) => {
      if (context?.previousProcesses) {
        qc.setQueryData(PM2_LIST_QUERY_KEY, context.previousProcesses);
      }
      showToast(`Failed to start ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
    onSettled: (_, __, name) => {
      removePMPending(name);
      qc.invalidateQueries({ queryKey: PM2_LIST_QUERY_KEY });
    },
    onSuccess: (_, name) => {
      showToast(`Started ${name}`, 'success');
    },
  });

  // Stop mutation with optimistic update
  const stopMutation = useMutation({
    mutationFn: (name: string) => pm2API.stop(name),
    onMutate: async (name): Promise<OptimisticContext> => {
      addPMPending(name);
      await qc.cancelQueries({ queryKey: PM2_LIST_QUERY_KEY });
      const previousProcesses = qc.getQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY);
      optimisticUpdateStatus(name, 'stopping', { previousProcesses });
      return { previousProcesses };
    },
    onError: (err, name, context) => {
      if (context?.previousProcesses) {
        qc.setQueryData(PM2_LIST_QUERY_KEY, context.previousProcesses);
      }
      showToast(`Failed to stop ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
    onSettled: (_, __, name) => {
      removePMPending(name);
      qc.invalidateQueries({ queryKey: PM2_LIST_QUERY_KEY });
    },
    onSuccess: (_, name) => {
      showToast(`Stopped ${name}`, 'success');
    },
  });

  // Restart mutation with optimistic update
  const restartMutation = useMutation({
    mutationFn: (name: string) => pm2API.restart(name),
    onMutate: async (name): Promise<OptimisticContext> => {
      addPMPending(name);
      await qc.cancelQueries({ queryKey: PM2_LIST_QUERY_KEY });
      const previousProcesses = qc.getQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY);
      optimisticUpdateStatus(name, 'launching', { previousProcesses });
      return { previousProcesses };
    },
    onError: (err, name, context) => {
      if (context?.previousProcesses) {
        qc.setQueryData(PM2_LIST_QUERY_KEY, context.previousProcesses);
      }
      showToast(`Failed to restart ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
    onSettled: (_, __, name) => {
      removePMPending(name);
      qc.invalidateQueries({ queryKey: PM2_LIST_QUERY_KEY });
    },
    onSuccess: (_, name) => {
      showToast(`Restarted ${name}`, 'success');
    },
  });

  // Delete mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: (name: string) => pm2API.delete(name),
    onMutate: async (name): Promise<OptimisticContext> => {
      addPMPending(name);
      await qc.cancelQueries({ queryKey: PM2_LIST_QUERY_KEY });
      const previousProcesses = qc.getQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY);
      qc.setQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.filter((p) => p.name !== name);
      });
      return { previousProcesses };
    },
    onError: (err, name, context) => {
      if (context?.previousProcesses) {
        qc.setQueryData(PM2_LIST_QUERY_KEY, context.previousProcesses);
      }
      showToast(`Failed to delete ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
    onSettled: (_, __, name) => {
      removePMPending(name);
      qc.invalidateQueries({ queryKey: PM2_LIST_QUERY_KEY });
    },
    onSuccess: (_, name) => {
      showToast(`Deleted ${name}`, 'success');
      // Remove from selection if deleted
      if (isPM2Selected(name)) {
        togglePM2Selection(name);
      }
    },
  });

  // Bulk operations with optimistic updates
  const bulkMutation = useMutation({
    mutationFn: ({ action, names }: { action: 'start' | 'stop' | 'restart' | 'delete'; names: string[] }) =>
      pm2ExtraAPI.bulk(action, names),
    onMutate: async ({ action, names }): Promise<OptimisticContext> => {
      names.forEach(addPMPending);
      await qc.cancelQueries({ queryKey: PM2_LIST_QUERY_KEY });
      const previousProcesses = qc.getQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY);

      const statusMap: Record<string, string> = {
        start: 'launching',
        stop: 'stopping',
        restart: 'launching',
        delete: 'deleting',
      };

      qc.setQueryData<PM2Process[]>(PM2_LIST_QUERY_KEY, (old) => {
        if (!old) return old;
        if (action === 'delete') {
          return old.filter((p) => !names.includes(p.name));
        }
        return old.map((p) =>
          names.includes(p.name) ? { ...p, status: statusMap[action] } : p
        );
      });

      return { previousProcesses };
    },
    onError: (err, { names }, context) => {
      if (context?.previousProcesses) {
        qc.setQueryData(PM2_LIST_QUERY_KEY, context.previousProcesses);
      }
      showToast(`Bulk operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
    onSettled: (_, __, { names }) => {
      names.forEach(removePMPending);
      qc.invalidateQueries({ queryKey: PM2_LIST_QUERY_KEY });
    },
    onSuccess: (_, { action, names }) => {
      showToast(`${action.charAt(0).toUpperCase() + action.slice(1)}ed ${names.length} processes`, 'success');
      clearPM2Selection();
    },
  });

  // Restart all errored processes
  const restartErroredMutation = useMutation({
    mutationFn: () => pm2ExtraAPI.restartErrored(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PM2_LIST_QUERY_KEY });
      showToast('Restarted all errored processes', 'success');
    },
    onError: (err) => {
      showToast(`Failed to restart errored: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
  });

  // Save PM2 config
  const saveMutation = useMutation({
    mutationFn: () => pm2ExtraAPI.save(),
    onSuccess: () => {
      showToast('PM2 configuration saved', 'success');
    },
    onError: (err) => {
      showToast(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    },
  });

  // Computed properties
  const selectedCount = pm2SelectedNames.length;
  const hasSelection = selectedCount > 0;
  const pendingCount = pm2PendingNames.length;

  return {
    // Data
    processes,
    isLoading,
    error,
    refetch,

    // Selection state
    selectedNames: pm2SelectedNames,
    selectedCount,
    hasSelection,
    isSelected: isPM2Selected,
    toggleSelection: togglePM2Selection,
    clearSelection: clearPM2Selection,
    selectAll: selectAllPM2,

    // Pending state (for optimistic UI)
    pendingNames: pm2PendingNames,
    pendingCount,
    isPending: isPMPending,

    // Individual mutations
    start: startMutation,
    stop: stopMutation,
    restart: restartMutation,
    delete: deleteMutation,

    // Bulk mutations
    bulk: bulkMutation,
    restartErrored: restartErroredMutation,
    save: saveMutation,
  };
}

export default usePM2;
