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

interface UseAIStreamingReturn {
  messages: StreamingMessage[];
  isStreaming: boolean;
  sendMessage: (content: string, capability?: string) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
}

export function useAIStreaming(conversationId?: string): UseAIStreamingReturn {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const store = useStore();

  const sendMessage = useCallback(async (content: string, capability?: string) => {
    const userMessage: StreamingMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMessage: StreamingMessage = {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          capability,
          conversationId,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE format
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? {
                          ...msg,
                          content: msg.content + parsed.content,
                          provider: parsed.provider || msg.provider,
                          model: parsed.model || msg.model,
                        }
                      : msg
                  )
                );
              }
            } catch {
              // If not JSON, append as plain text
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + data }
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Streaming error:', error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: 'Error: ' + error.message, isStreaming: false }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
        )
      );

      // Save to store conversation
      if (conversationId) {
        store.addMessage(conversationId, {
          id: userMessage.id,
          role: 'user',
          content: userMessage.content,
          timestamp: Date.now(),
        });
        const finalAssistant = messages.find(m => m.id === assistantMessage.id);
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
  }, [conversationId, store, messages]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, stopStreaming, clearMessages };
}
