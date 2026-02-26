import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { wsUrl } from '@/utils';
import Sidebar from '@/components/Sidebar';
import CommandPalette from '@/components/CommandPalette';
import NotificationToast from '@/components/NotificationToast';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useNotifications } from '@/hooks/useNotifications';
import Overview from '@/pages/Overview';
import CommandCenter from '@/pages/CommandCenter';
import PM2Page from '@/pages/PM2Page';
import GitHubPage from '@/pages/GitHubPage';
import DockerPage from '@/pages/DockerPage';
import LogsPage from '@/pages/LogsPage';
import ServerPage from '@/pages/ServerPage';
import TerminalPage from '@/pages/TerminalPage';
import DeployPage from '@/pages/DeployPage';
import SystemMonitorPage from '@/pages/SystemMonitorPage';
import AIAssistant from '@/pages/AIAssistant';
import EnhancedFileManager from '@/pages/EnhancedFileManager';
import LoginPage from '@/pages/LoginPage';

// Inner shell — only mounts when authenticated (so wsUrl() has a token)
function AppShell() {
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const cmdPalette = useCommandPalette();
  const { notifications, notify, dismiss } = useNotifications();
  const wsRef = useRef<WebSocket | null>(null);

  // PM2 error alert WebSocket — only connect when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const ws = new WebSocket(wsUrl('/ws'));
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pm2-alert' && Array.isArray(msg.data)) {
          for (const alert of msg.data) {
            notify({
              type: 'error',
              title: `Process errored: ${alert.name}`,
              message: `Transitioned from ${alert.from} → errored`,
              duration: 8000,
            });
          }
        }
      } catch { /* ignore */ }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [isAuthenticated, notify]);

  const handleNotify = (msg: string, type: 'success' | 'error') => {
    notify({ type, title: msg });
  };

  return (
    <div className="flex h-screen bg-dark-950 text-dark-100 overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onOpenPalette={cmdPalette.open}
      />

      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <Routes>
          <Route path="/" element={<Navigate to="/command-center" replace />} />
          <Route path="/command-center" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
          <Route path="/overview" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
          <Route path="/pm2" element={<ProtectedRoute><PM2Page /></ProtectedRoute>} />
          <Route path="/github" element={<ProtectedRoute><GitHubPage /></ProtectedRoute>} />
          <Route path="/docker" element={<ProtectedRoute><DockerPage /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
          <Route path="/server" element={<ProtectedRoute><ServerPage /></ProtectedRoute>} />
          <Route path="/terminal" element={<ProtectedRoute><TerminalPage /></ProtectedRoute>} />
          <Route path="/deploy" element={<ProtectedRoute><DeployPage /></ProtectedRoute>} />
          <Route path="/monitor" element={<ProtectedRoute><SystemMonitorPage /></ProtectedRoute>} />
          <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
          <Route path="/file-manager" element={<ProtectedRoute><EnhancedFileManager /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>

      <CommandPalette
        isOpen={cmdPalette.isOpen}
        onClose={cmdPalette.close}
        onNotify={handleNotify}
      />

      <NotificationToast notifications={notifications} onDismiss={dismiss} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </AuthProvider>
  );
}
