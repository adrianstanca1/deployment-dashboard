import { StateCreator } from 'zustand';

export interface PendingOperation {
  containerId: string;
  operation: 'start' | 'stop' | 'restart' | 'remove';
}

export interface DockerUISlice {
  selectedContainers: string[];
  pendingOperations: PendingOperation[];
  toggleContainerSelection: (id: string) => void;
  clearContainerSelection: () => void;
  selectAllContainers: (ids: string[]) => void;
  setContainerSelection: (ids: string[]) => void;
  addPendingOperation: (containerId: string, operation: 'start' | 'stop' | 'restart' | 'remove') => void;
  removePendingOperation: (containerId: string, operation: 'start' | 'stop' | 'restart' | 'remove') => void;
  clearPendingOperations: () => void;
  isContainerPending: (containerId: string, operation?: string) => boolean;
}

export const createDockerUISlice: StateCreator<DockerUISlice> = (set, get) => ({
  selectedContainers: [],
  pendingOperations: [],

  toggleContainerSelection: (id) =>
    set((state) => {
      const index = state.selectedContainers.indexOf(id);
      if (index === -1) {
        state.selectedContainers.push(id);
      } else {
        state.selectedContainers.splice(index, 1);
      }
    }),

  clearContainerSelection: () => set({ selectedContainers: [] }),

  selectAllContainers: (ids) =>
    set((state) => {
      state.selectedContainers = ids;
    }),

  setContainerSelection: (ids) => set({ selectedContainers: ids }),

  addPendingOperation: (containerId, operation) =>
    set((state) => {
      const exists = state.pendingOperations.some(
        (op) => op.containerId === containerId && op.operation === operation
      );
      if (!exists) {
        state.pendingOperations.push({ containerId, operation });
      }
    }),

  removePendingOperation: (containerId, operation) =>
    set((state) => {
      state.pendingOperations = state.pendingOperations.filter(
        (op) => !(op.containerId === containerId && op.operation === operation)
      );
    }),

  clearPendingOperations: () => set({ pendingOperations: [] }),

  isContainerPending: (containerId, operation) => {
    const { pendingOperations } = get();
    if (operation) {
      return pendingOperations.some(
        (op) => op.containerId === containerId && op.operation === operation
      );
    }
    return pendingOperations.some((op) => op.containerId === containerId);
  },
});
