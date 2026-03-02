import { useState, useCallback, useRef } from 'react';
import { useStore } from '@/store';

interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  provider?: string;
  model?: string;
}

interface SendMessageOptions {
  capability?: string;
  provider?: string;
  model?: string;
}

interface UseAIStreamingReturn {
  messages: StreamingMessage[];
  isStreaming: boolean;
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
}

export function useAIStreaming(conversationId?: string): UseAIStreamingReturn {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const latestAssistantRef = useRef<StreamingMessage | null>(null);
  const skipPersistRef = useRef(false);
  const store = useStore();

  const updateAssistantMessage = useCallback((messageId: string, updater: (message: StreamingMessage) => StreamingMessage) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id !== messageId) return msg;
        const nextMessage = updater(msg);
        latestAssistantRef.current = nextMessage;
        return nextMessage;
      })
    );
  }, []);

  const sendMessage = useCallback(async (content: string, options?: SendMessageOptions) => {
    const messageBaseId = Date.now().toString();
    const userMessage: StreamingMessage = {
      id: `${messageBaseId}-user`,
      role: 'user',
      content,
    };

    const assistantMessage: StreamingMessage = {
      id: `${messageBaseId}-assistant`,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    latestAssistantRef.current = assistantMessage;
    skipPersistRef.current = false;
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: content,
          capability: options?.capability,
          conversationId,
          provider: options?.provider,
          model: options?.model,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Ignore JSON parse errors and use the status-based message.
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        const nextContent = data.response || data.content || 'No response received.';
        updateAssistantMessage(assistantMessage.id, (msg) => ({
          ...msg,
          content: nextContent,
          provider: data.provider || msg.provider,
          model: data.model || msg.model,
        }));
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content || parsed.provider || parsed.model) {
                updateAssistantMessage(assistantMessage.id, (msg) => ({
                  ...msg,
                  content: parsed.content ? msg.content + parsed.content : msg.content,
                  provider: parsed.provider || msg.provider,
                  model: parsed.model || msg.model,
                }));
              }
            } catch {
              updateAssistantMessage(assistantMessage.id, (msg) => ({
                ...msg,
                content: msg.content + data,
              }));
            }
          }
        }
      }

      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (!data || data === '[DONE]') continue;
          updateAssistantMessage(assistantMessage.id, (msg) => ({
            ...msg,
            content: msg.content + data,
          }));
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Streaming error:', error);
        updateAssistantMessage(assistantMessage.id, (msg) => ({
          ...msg,
          content: `Error: ${error.message}`,
          isStreaming: false,
        }));
      }
    } finally {
      setIsStreaming(false);
      updateAssistantMessage(assistantMessage.id, (msg) => ({ ...msg, isStreaming: false }));
      abortRef.current = null;

      if (conversationId && !skipPersistRef.current) {
        store.addMessage(conversationId, {
          id: userMessage.id,
          role: 'user',
          content: userMessage.content,
          timestamp: Date.now(),
        });
        const finalAssistant = latestAssistantRef.current;
        if (finalAssistant) {
          store.addMessage(conversationId, {
            id: finalAssistant.id,
            role: 'assistant',
            content: finalAssistant.content,
            timestamp: Date.now(),
            provider: finalAssistant.provider,
            model: finalAssistant.model,
          });
        }
      }
    }
  }, [conversationId, store, updateAssistantMessage]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    skipPersistRef.current = true;
    abortRef.current?.abort();
    setMessages([]);
    latestAssistantRef.current = null;
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, sendMessage, stopStreaming, clearMessages };
}
