# Deployment Dashboard Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild and optimize the deployment dashboard with performance improvements, enhanced AI integration, better UX, and comprehensive monitoring.

**Architecture:** Frontend uses React 18 + Vite + TypeScript + Tailwind CSS with TanStack Query for state management. Backend uses Express + WebSocket + node-pty. AI integration supports multiple providers (OpenAI, Anthropic, Google, Ollama) with tool execution capabilities.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, TanStack Query, WebSocket, Express, node-pty, Dockerode, PM2

---

## Overview

This plan covers:
1. Performance optimizations (code splitting, virtual scrolling, caching)
2. AI Assistant enhancements (streaming, history, templates)
3. UX improvements (skeleton loaders, optimistic updates, bulk operations)
4. Monitoring & observability (health checks, metrics, alerts)
5. Security & reliability improvements

---

## Task 1: Project Setup and Dependencies

**Files:**
- Modify: `/root/deployment-dashboard/package.json`
- Modify: `/root/deployment-dashboard/vite.config.ts`
- Modify: `/root/deployment-dashboard/tsconfig.json`

**Step 1: Install new dependencies**

```bash
cd /root/deployment-dashboard
npm install @tanstack/react-virtual react-intersection-observer zustand immer
npm install -D @types/node
```

**Step 2: Update vite.config.ts for code splitting**

Add manual chunks configuration for better code splitting.

**Step 3: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "deps: add performance and state management libraries"
```

---

## Task 2: Create Zustand Store for Global State

**Files:**
- Create: `/root/deployment-dashboard/src/store/index.ts`
- Create: `/root/deployment-dashboard/src/store/slices/uiSlice.ts`
- Create: `/root/deployment-dashboard/src/store/slices/aiSlice.ts`

**Step 1: Create store directory structure**

```typescript
// src/store/index.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createUISlice, UISlice } from './slices/uiSlice';
import { createAISlice, AISlice } from './slices/aiSlice';

export const useStore = create<UISlice & AISlice>()(
  immer((...args) => ({
    ...createUISlice(...args),
    ...createAISlice(...args),
  }))
);
```

**Step 2: Create UI slice**

```typescript
// src/store/slices/uiSlice.ts
import { StateCreator } from 'zustand';

export interface UISlice {
  sidebarOpen: boolean;
  activeModal: string | null;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  setSidebarOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  sidebarOpen: true,
  activeModal: null,
  toast: null,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  showToast: (message, type) => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),
});
```

**Step 3: Commit**

```bash
git add src/store/
git commit -m "feat: add zustand store with ui and ai slices"
```

---

## Task 3: Create Virtual Scrolling Components

**Files:**
- Create: `/root/deployment-dashboard/src/components/VirtualList.tsx`
- Create: `/root/deployment-dashboard/src/components/VirtualTable.tsx`

**Step 1: Create VirtualList component**

```typescript
// src/components/VirtualList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 50,
  overscan = 5,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div ref={parentRef} className="overflow-auto h-full">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/VirtualList.tsx
git commit -m "feat: add virtual list component for large datasets"
```

---

## Task 4: Create Skeleton Loader Components

**Files:**
- Create: `/root/deployment-dashboard/src/components/skeletons/CardSkeleton.tsx`
- Create: `/root/deployment-dashboard/src/components/skeletons/TableSkeleton.tsx`
- Create: `/root/deployment-dashboard/src/components/skeletons/index.ts`

**Step 1: Create CardSkeleton**

```typescript
// src/components/skeletons/CardSkeleton.tsx
export function CardSkeleton() {
  return (
    <div className="animate-pulse bg-dark-800 rounded-lg p-4 border border-dark-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-dark-700" />
        <div className="flex-1">
          <div className="h-4 bg-dark-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-dark-700 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-dark-700 rounded" />
        <div className="h-3 bg-dark-700 rounded w-5/6" />
      </div>
    </div>
  );
}
```

**Step 2: Create TableSkeleton**

```typescript
// src/components/skeletons/TableSkeleton.tsx
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-dark-800 rounded-t-lg border border-dark-700 border-b-0 flex gap-4 px-4 items-center">
        <div className="h-4 bg-dark-700 rounded w-1/6" />
        <div className="h-4 bg-dark-700 rounded w-1/4" />
        <div className="h-4 bg-dark-700 rounded w-1/6" />
        <div className="h-4 bg-dark-700 rounded w-1/6" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-dark-800 border border-dark-700 border-t-0 flex gap-4 px-4 items-center"
        >
          <div className="h-4 bg-dark-700 rounded w-1/6" />
          <div className="h-4 bg-dark-700 rounded w-1/4" />
          <div className="h-4 bg-dark-700 rounded w-1/6" />
          <div className="h-4 bg-dark-700 rounded w-1/6" />
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/skeletons/
git commit -m "feat: add skeleton loader components for better UX"
```

---

## Task 5: Optimize PM2 Page with Virtual Scrolling

**Files:**
- Modify: `/root/deployment-dashboard/src/pages/PM2Page.tsx`
- Modify: `/root/deployment-dashboard/src/hooks/usePM2.ts`

**Step 1: Update usePM2 hook with optimistic updates**

Add optimistic update support to mutations.

**Step 2: Update PM2Page with virtual scrolling**

Use VirtualList for large process lists. Add bulk operation controls.

**Step 3: Commit**

```bash
git add src/pages/PM2Page.tsx src/hooks/usePM2.ts
git commit -m "perf: optimize PM2 page with virtual scrolling and optimistic updates"
```

---

## Task 6: Enhance AI Assistant with Streaming

**Files:**
- Create: `/root/deployment-dashboard/src/hooks/useAIStreaming.ts`
- Modify: `/root/deployment-dashboard/src/pages/AIAssistant.tsx`
- Modify: `/root/deployment-dashboard/src/store/slices/aiSlice.ts`

**Step 1: Create useAIStreaming hook**

```typescript
// src/hooks/useAIStreaming.ts
import { useState, useCallback, useRef } from 'react';

interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function useAIStreaming() {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: StreamingMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMessage: StreamingMessage = {
      id: (Date.now() + 1).toString(),
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
        body: JSON.stringify({ message: content }),
        signal: abortRef.current.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Streaming error:', error);
      }
    } finally {
      setIsStreaming(false);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    }
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, sendMessage, stopStreaming };
}
```

**Step 2: Update AIAssistant page**

Replace the current implementation with streaming support.

**Step 3: Commit**

```bash
git add src/hooks/useAIStreaming.ts src/pages/AIAssistant.tsx
git commit -m "feat: add streaming support to AI assistant"
```

---

## Task 7: Create Health Check Dashboard

**Files:**
- Create: `/root/deployment-dashboard/src/pages/HealthPage.tsx`
- Create: `/root/deployment-dashboard/src/hooks/useHealthCheck.ts`
- Modify: `/root/deployment-dashboard/src/components/Sidebar.tsx`

**Step 1: Create useHealthCheck hook**

```typescript
// src/hooks/useHealthCheck.ts
import { useQuery } from '@tanstack/react-query';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastChecked: string;
  message?: string;
}

export function useHealthCheck() {
  return useQuery<HealthStatus[]>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Failed to fetch health status');
      return response.json();
    },
    refetchInterval: 30000, // 30 seconds
  });
}
```

**Step 2: Create HealthPage component**

Dashboard showing health status of all services (PM2, Docker, AI providers, etc.)

**Step 3: Update Sidebar to include Health link**

**Step 4: Commit**

```bash
git add src/pages/HealthPage.tsx src/hooks/useHealthCheck.ts src/components/Sidebar.tsx
git commit -m "feat: add health check dashboard for monitoring"
```

---

## Task 8: Add Bulk Operations to Docker Page

**Files:**
- Modify: `/root/deployment-dashboard/src/pages/DockerPage.tsx`
- Modify: `/root/deployment-dashboard/src/hooks/useDocker.ts`

**Step 1: Add selection state and bulk actions**

Add checkboxes for container selection and bulk operation buttons (start, stop, remove).

**Step 2: Commit**

```bash
git add src/pages/DockerPage.tsx src/hooks/useDocker.ts
git commit -m "feat: add bulk operations to Docker page"
```

---

## Task 9: Implement Code Splitting for Routes

**Files:**
- Modify: `/root/deployment-dashboard/src/App.tsx`

**Step 1: Add lazy loading to all routes**

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';
import { TableSkeleton } from '@/components/skeletons';

const Overview = lazy(() => import('@/pages/Overview'));
const PM2Page = lazy(() => import('@/pages/PM2Page'));
const DockerPage = lazy(() => import('@/pages/DockerPage'));
// ... etc
```

**Step 2: Wrap routes with Suspense**

```tsx
<Route
  path="/overview"
  element={
    <ProtectedRoute>
      <Suspense fallback={<TableSkeleton />}>
        <Overview />
      </Suspense>
    </ProtectedRoute>
  }
/>
```

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "perf: implement code splitting with lazy loading"
```

---

## Task 10: Add Keyboard Shortcuts

**Files:**
- Create: `/root/deployment-dashboard/src/hooks/useKeyboardShortcuts.ts`
- Modify: `/root/deployment-dashboard/src/App.tsx`

**Step 1: Create keyboard shortcuts hook**

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

**Step 2: Integrate into App**

Add shortcuts for command palette (Ctrl+K), sidebar toggle, etc.

**Step 3: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/App.tsx
git commit -m "feat: add keyboard shortcuts for power users"
```

---

## Task 11: Optimize React Query Configuration

**Files:**
- Create: `/root/deployment-dashboard/src/lib/queryClient.ts`
- Modify: `/root/deployment-dashboard/src/main.tsx`

**Step 1: Create optimized query client**

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('401')) {
          return false; // Don't retry auth errors
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});
```

**Step 2: Update main.tsx to use new query client**

**Step 3: Commit**

```bash
git add src/lib/queryClient.ts src/main.tsx
git commit -m "perf: optimize React Query configuration"
```

---

## Task 12: Build and Verify

**Step 1: Run build**

```bash
cd /root/deployment-dashboard
npm run build
```

**Step 2: Verify no errors**

**Step 3: Run smoke tests**

```bash
npm run smoke:dashboard
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: final build and verification"
```

---

## Task 13: Backend Optimizations

**Files:**
- Modify: `/root/deployment-dashboard-server/server.js`
- Create: `/root/deployment-dashboard-server/middleware/cache.js`
- Create: `/root/deployment-dashboard-server/routes/health.js`

**Step 1: Add response caching middleware**

```javascript
// middleware/cache.js
const cache = new Map();

function cacheMiddleware(duration = 60000) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < duration) {
      return res.json(cached.data);
    }

    const originalJson = res.json;
    res.json = function(data) {
      cache.set(key, { data, timestamp: Date.now() });
      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = { cacheMiddleware };
```

**Step 2: Create health check route**

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add backend caching and health endpoints"
```

---

## Final Steps

**Step 1: Push to GitHub**

```bash
cd /root/deployment-dashboard
git push origin master

cd /root/deployment-dashboard-server
git push origin master
```

**Step 2: Deploy to VPS**

```bash
# Rebuild and restart containers
ssh root@72.62.132.43 'cd /opt/docker/projects && docker-compose up -d --build dashboard-frontend dashboard-backend'
```

---

## Testing Checklist

- [ ] All pages load without errors
- [ ] PM2 process list scrolls smoothly with virtual scrolling
- [ ] Docker bulk operations work correctly
- [ ] AI assistant streams responses
- [ ] Keyboard shortcuts function properly
- [ ] Health dashboard shows all service statuses
- [ ] Skeleton loaders appear during data fetching
- [ ] Build completes without errors
- [ ] Bundle size is optimized
