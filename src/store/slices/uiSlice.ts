import { StateCreator } from 'zustand';

export interface UISlice {
  sidebarOpen: boolean;
  activeModal: string | null;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  selectedItems: string[];
  // PM2-specific selection state
  pm2SelectedNames: string[];
  pm2PendingNames: string[];
  // Docker-specific selection state
  dockerSelectedIds: string[];
  dockerPendingIds: string[];
  setSidebarOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  // PM2 selection actions
  togglePM2Selection: (name: string) => void;
  clearPM2Selection: () => void;
  selectAllPM2: (names: string[]) => void;
  isPM2Selected: (name: string) => boolean;
  addPMPending: (name: string) => void;
  removePMPending: (name: string) => void;
  clearPMPending: () => void;
  isPMPending: (name: string) => boolean;
  // Docker selection actions
  toggleDockerSelection: (id: string) => void;
  clearDockerSelection: () => void;
  selectAllDocker: (ids: string[]) => void;
  isDockerSelected: (id: string) => boolean;
  addDockerPending: (id: string) => void;
  removeDockerPending: (id: string) => void;
  clearDockerPending: () => void;
  isDockerPending: (id: string) => boolean;
}

export const createUISlice: StateCreator<UISlice> = (set, get) => ({
  sidebarOpen: true,
  activeModal: null,
  toast: null,
  selectedItems: [],
  pm2SelectedNames: [],
  pm2PendingNames: [],
  dockerSelectedIds: [],
  dockerPendingIds: [],
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  showToast: (message, type) => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),
  toggleSelection: (id) =>
    set((state) => {
      const index = state.selectedItems.indexOf(id);
      if (index === -1) {
        state.selectedItems.push(id);
      } else {
        state.selectedItems.splice(index, 1);
      }
    }),
  clearSelection: () => set({ selectedItems: [] }),
  selectAll: (ids) => set({ selectedItems: ids }),
  // PM2 selection actions
  togglePM2Selection: (name) =>
    set((state) => {
      const index = state.pm2SelectedNames.indexOf(name);
      if (index === -1) {
        state.pm2SelectedNames.push(name);
      } else {
        state.pm2SelectedNames.splice(index, 1);
      }
    }),
  clearPM2Selection: () => set({ pm2SelectedNames: [] }),
  selectAllPM2: (names) => set({ pm2SelectedNames: names }),
  isPM2Selected: (name) => get().pm2SelectedNames.includes(name),
  addPMPending: (name) =>
    set((state) => {
      if (!state.pm2PendingNames.includes(name)) {
        state.pm2PendingNames.push(name);
      }
    }),
  removePMPending: (name) =>
    set((state) => {
      const index = state.pm2PendingNames.indexOf(name);
      if (index !== -1) {
        state.pm2PendingNames.splice(index, 1);
      }
    }),
  clearPMPending: () => set({ pm2PendingNames: [] }),
  isPMPending: (name) => get().pm2PendingNames.includes(name),
  // Docker selection actions
  toggleDockerSelection: (id) =>
    set((state) => {
      const index = state.dockerSelectedIds.indexOf(id);
      if (index === -1) {
        state.dockerSelectedIds.push(id);
      } else {
        state.dockerSelectedIds.splice(index, 1);
      }
    }),
  clearDockerSelection: () => set({ dockerSelectedIds: [] }),
  selectAllDocker: (ids) => set({ dockerSelectedIds: ids }),
  isDockerSelected: (id) => get().dockerSelectedIds.includes(id),
  addDockerPending: (id) =>
    set((state) => {
      if (!state.dockerPendingIds.includes(id)) {
        state.dockerPendingIds.push(id);
      }
    }),
  removeDockerPending: (id) =>
    set((state) => {
      const index = state.dockerPendingIds.indexOf(id);
      if (index !== -1) {
        state.dockerPendingIds.splice(index, 1);
      }
    }),
  clearDockerPending: () => set({ dockerPendingIds: [] }),
  isDockerPending: (id) => get().dockerPendingIds.includes(id),
});
