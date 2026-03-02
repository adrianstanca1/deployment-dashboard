import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createUISlice, UISlice } from './slices/uiSlice';
import { createAISlice, AISlice } from './slices/aiSlice';
import { createDockerUISlice, DockerUISlice } from './slices/dockerUISlice';

export const useStore = create<UISlice & AISlice & DockerUISlice>()(
  immer((...args) => ({
    ...createUISlice(...args),
    ...createAISlice(...args),
    ...createDockerUISlice(...args),
  }))
);
