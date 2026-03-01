import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { wsUrl } from '@/utils';
import Sidebar from '@/components/Sidebar';
import CommandPalette from '@/components/CommandPalette';
import NotificationToast from '@/components/NotificationToast';
import AIFailureStatusCard, { type AIFailingProvider } from '@/components/AIFailureStatusCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { useNotifications } from '@/hooks/useNotifications';
import Overview from '@/pages/Overview';
import CommandCenter from '@/pages/CommandCenter';
import PM2Page from '@/pages/PM2Page';
import GitHubPage from '@/pages/GitHubPageEnhanced';
import DockerPage from '@/pages/DockerPage';
import LogsPage from '@/pages/LogsPage';
import ServerPage from '@/pages/ServerPage';
import TerminalPage from '@/pages/TerminalPage';
import DeployPage from '@/pages/DeployPage';
import SystemMonitorPage from '@/pages/SystemMonitorPage';
import AIAssistant from '@/pages/AIAssistant';
import AISettings from '@/pages/AISettings';
import EnhancedFileManager from '@/pages/EnhancedFileManager';
import SettingsPage from '@/pages/SettingsPage';
import LoginPage from '@/pages/LoginPage';

// Inner shell — only mounts when authenticated (so wsUrl() has a token)
function AppShell() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiFailureCount, setAiFailureCount] = useState(0);
  const [failingAiProviders, setFailingAiProviders] = useState<AIFailingProvider[]>([]);
  const [switchingToCloud, setSwitchingToCloud] = useState(false);
  const cmdPalette = useCommandPalette();
  const { notifications, notify, dismiss } = useNotifications();
  const wsRef = useRef<WebSocket | null>(null);
  const seenAiAlerts = useRef<Set<string>>(new Set());

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

        if (msg.type === 'ai-alert' && Array.isArray(msg.data)) {
          for (const alert of msg.data) {
            if (seenAiAlerts.current.has(alert.id)) continue;
            seenAiAlerts.current.add(alert.id);
            notify({
              type: alert.level === 'info' ? 'info' : 'error',
              title: `AI ${alert.provider}: ${alert.message}`,
              message: alert.details?.message,
              duration: alert.level === 'info' ? 6000 : 10000,
            });
          }
        }

        if (msg.type === 'ai-status' && msg.data?.providers) {
          const failingProviders = msg.data.providers.filter((provider: any) =>
            !provider.health?.healthy && provider.health?.status !== 'missing_credentials'
          );
          setAiFailureCount(failingProviders.length);
          setFailingAiProviders(failingProviders.map((provider: any) => ({
            id: provider.id,
            name: provider.name,
            status: provider.health?.status,
            message: provider.health?.message,
          })));
        }
      } catch { /* ignore */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setAiFailureCount(0);
      setFailingAiProviders([]);
    };
  }, [isAuthenticated, notify]);

  const handleNotify = (msg: string, type: 'success' | 'error') => {
    notify({ type, title: msg });
  };

  const switchToCloud = async () => {
    const token = localStorage.getItem('dashboard_token');
    if (!token) {
      notify({ type: 'error', title: 'Authentication required', message: 'Log in again to switch AI providers.' });
      return;
    }

    try {
      setSwitchingToCloud(true);
      const res = await fetch('/api/ai/providers/cloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to switch to Cloud');
      notify({
        type: 'success',
        title: 'Switched to Cloud AI',
        message: 'The dashboard moved the active AI provider to Cloud.',
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Cloud fallback failed',
        message: error instanceof Error ? error.message : 'Failed to switch AI provider.',
      });
    } finally {
      setSwitchingToCloud(false);
    }
  };

  return (
    <div className="flex h-screen bg-dark-950 text-dark-100 overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        onOpenPalette={cmdPalette.open}
        aiFailureCount={aiFailureCount}
      />

      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {failingAiProviders.length > 0 && (
          <div className="border-b border-red-500/20 bg-dark-950/95 px-4 py-3">
            <AIFailureStatusCard
              providers={failingAiProviders}
              switchingToCloud={switchingToCloud}
              onOpenSettings={() => navigate('/ai-settings')}
              onSwitchToCloud={switchToCloud}
            />
          </div>
        )}
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
          <Route path="/ai-settings" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
          <Route path="/file-manager" element={<ProtectedRoute><EnhancedFileManager /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
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
