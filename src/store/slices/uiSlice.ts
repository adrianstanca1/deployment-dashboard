import { StateCreator } from 'zustand';

export interface UISlice {
  sidebarOpen: boolean;
  activeModal: string | null;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  selectedItems: string[];
  setSidebarOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  sidebarOpen: true,
  activeModal: null,
  toast: null,
  selectedItems: [],
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
});
