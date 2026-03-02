import { StateCreator } from 'zustand';

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: string;
  model?: string;
  toolCalls?: AIToolCall[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface AISlice {
  conversations: AIConversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  streamingContent: string;
  createConversation: () => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: AIMessage) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteConversation: (id: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
}

export const createAISlice: StateCreator<AISlice> = (set) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  streamingContent: '',

  createConversation: () => {
    const id = Date.now().toString();
    const conversation: AIConversation = {
      id,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => {
      state.conversations.unshift(conversation);
      state.activeConversationId = id;
    });
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        conversation.messages.push(message);
        conversation.updatedAt = Date.now();
        // Update title from first user message
        if (conversation.messages.length === 1 && message.role === 'user') {
          conversation.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
        }
      }
    }),

  updateMessage: (conversationId, messageId, content) =>
    set((state) => {
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        const message = conversation.messages.find((m) => m.id === messageId);
        if (message) {
          message.content = content;
        }
      }
    }),

  deleteConversation: (id) =>
    set((state) => {
      const index = state.conversations.findIndex((c) => c.id === id);
      if (index !== -1) {
        state.conversations.splice(index, 1);
      }
      if (state.activeConversationId === id) {
        state.activeConversationId = state.conversations[0]?.id || null;
      }
    }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  clearStreamingContent: () => set({ streamingContent: '' }),
});
