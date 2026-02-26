import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Shield, Github, Bell, Server, Rocket, Terminal,
  Save, Loader2, Eye, EyeOff, CheckCircle, AlertCircle,
  LayoutGrid, FolderOpen, File, ChevronRight, ChevronLeft,
  Home, RefreshCw, Trash2, Plus, FolderPlus, FilePlus,
  Download, Upload, X
} from 'lucide-react';
import { settingsAPI, serverFileAPI, type FileItem } from '@/api';
import { useNotifications } from '@/hooks/useNotifications';

// Settings interfaces matching backend structure
interface SecuritySettings {
  dashboardUser: string;
  dashboardPassword: string;
  dashboardJwtSecret: string;
}

interface GithubSettings {
  username: string;
  token: string;
}

interface NotificationSettings {
  slackWebhook: string;
  emailSmtp: string;
  emailUser: string;
  emailPass: string;
  emailFrom: string;
}

interface ServerSettings {
  publicIp: string;
  appsBaseUrl: string;
  allowDirectPortUrls: boolean;
}

interface DeploySettings {
  defaultBranch: string;
  buildCommand: string;
  installCommand: string;
}

interface TerminalSettings {
  shell: string;
  workingDirectory: string;
}

interface FeatureSettings {
  enableAIAssistant: boolean;
  enableFileManager: boolean;
  enableTerminal: boolean;
}

interface DashboardSettings {
  security: SecuritySettings;
  github: GithubSettings;
  notifications: NotificationSettings;
  server: ServerSettings;
  deploy: DeploySettings;
  terminal: TerminalSettings;
  features: FeatureSettings;
}

const defaultSettings: DashboardSettings = {
  security: {
    dashboardUser: '',
    dashboardPassword: '',
    dashboardJwtSecret: '',
  },
  github: {
    username: '',
    token: '',
  },
  notifications: {
    slackWebhook: '',
    emailSmtp: '',
    emailUser: '',
    emailPass: '',
    emailFrom: '',
  },
  server: {
    publicIp: '',
    appsBaseUrl: '',
    allowDirectPortUrls: false,
  },
  deploy: {
    defaultBranch: 'main',
    buildCommand: 'npm run build',
    installCommand: 'npm install',
  },
  terminal: {
    shell: 'bash',
    workingDirectory: '/var/www',
  },
  features: {
    enableAIAssistant: true,
    enableFileManager: true,
    enableTerminal: true,
  },
};

type SettingsSection = 'security' | 'github' | 'notifications' | 'server' | 'deploy' | 'terminal' | 'features' | 'files';

// Password input with visibility toggle
function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  description,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  description?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-dark-500">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field text-sm w-full pr-9"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {description && <p className="text-xs text-dark-600">{description}</p>}
    </div>
  );
}

// Text input field
function TextField({
  label,
  value,
  onChange,
  placeholder,
  description,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  description?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-dark-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field text-sm w-full"
      />
      {description && <p className="text-xs text-dark-600">{description}</p>}
    </div>
  );
}

// Toggle switch for boolean settings
function ToggleField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label className="block text-sm text-dark-200">{label}</label>
        {description && <p className="text-xs text-dark-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-dark-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// Settings section card
function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-800 bg-dark-800/40">
        <Icon size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-dark-100">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// File Browser Component
function FileBrowser() {
  const [currentPath, setCurrentPath] = useState('/var/www');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'directory'>('file');
  const [newItemName, setNewItemName] = useState('');
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['serverFiles', currentPath],
    queryFn: () => serverFileAPI.browse(currentPath),
  });

  const deleteMutation = useMutation({
    mutationFn: (path: string) => serverFileAPI.delete(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['serverFiles'] });
      notify({ type: 'success', title: 'Deleted successfully' });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Delete failed', message: error.message });
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ path, type }: { path: string; type: 'file' | 'directory' }) =>
      serverFileAPI.create(path, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['serverFiles'] });
      setShowCreateModal(false);
      setNewItemName('');
      notify({ type: 'success', title: 'Created successfully' });
    },
    onError: (error: Error) => {
      notify({ type: 'error', title: 'Create failed', message: error.message });
    },
  });

  const handleNavigate = (item: FileItem) => {
    if (item.type === 'directory') {
      setCurrentPath(item.path);
      setSelectedFile(null);
    } else {
      setSelectedFile(item);
    }
  };

  const handleNavigateUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
    setSelectedFile(null);
  };

  const handleCreate = () => {
    if (!newItemName.trim()) return;
    const fullPath = `${currentPath}/${newItemName.trim()}`;
    createMutation.mutate({ path: fullPath, type: createType });
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'directory') return { icon: FolderOpen, color: 'text-yellow-400' };
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, { icon: typeof File; color: string }> = {
      js: { icon: File, color: 'text-yellow-300' },
      ts: { icon: File, color: 'text-blue-400' },
      json: { icon: File, color: 'text-green-400' },
      md: { icon: File, color: 'text-gray-400' },
      html: { icon: File, color: 'text-orange-400' },
      css: { icon: File, color: 'text-blue-300' },
      py: { icon: File, color: 'text-blue-500' },
      sh: { icon: File, color: 'text-green-500' },
    };
    return iconMap[ext || ''] || { icon: File, color: 'text-dark-400' };
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const items = data?.data?.items || [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleNavigateUp}
            disabled={currentPath === '/'}
            className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
          >
            <ChevronLeft size={14} />
            Up
          </button>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setCreateType('directory'); setShowCreateModal(true); }}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <FolderPlus size={14} />
            New Folder
          </button>
          <button
            onClick={() => { setCreateType('file'); setShowCreateModal(true); }}
            className="btn-primary text-xs flex items-center gap-1"
          >
            <FilePlus size={14} />
            New File
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-dark-400 bg-dark-900/50 px-3 py-2 rounded-lg border border-dark-800">
        <Home size={12} />
        {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
          <React.Fragment key={i}>
            <ChevronRight size={12} />
            <span className={i === arr.length - 1 ? 'text-dark-200' : ''}>{part}</span>
          </React.Fragment>
        ))}
      </div>

      {/* File List */}
      <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-dark-800 bg-dark-800/40 text-xs text-dark-500 font-medium">
          <div className="col-span-6">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-3">Modified</div>
          <div className="col-span-1"></div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-dark-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-dark-500">
            <FolderOpen size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Empty directory</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-800">
            {items.map((item) => {
              const { icon: Icon, color } = getFileIcon(item.name, item.type);
              return (
                <div
                  key={item.path}
                  onClick={() => handleNavigate(item)}
                  className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-dark-800/50 ${
                    selectedFile?.path === item.path ? 'bg-primary-500/10' : ''
                  }`}
                >
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <Icon size={16} className={color} />
                    <span className="truncate text-dark-200">{item.name}</span>
                  </div>
                  <div className="col-span-2 text-dark-500">{formatSize(item.size)}</div>
                  <div className="col-span-3 text-dark-500 text-xs">
                    {item.modified ? new Date(item.modified).toLocaleString() : '-'}
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete ${item.name}?`)) {
                          deleteMutation.mutate(item.path);
                        }
                      }}
                      className="text-dark-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-dark-700 rounded-xl max-w-sm w-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-dark-100">
                Create {createType === 'directory' ? 'Folder' : 'File'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-dark-500 hover:text-dark-200">
                <X size={16} />
              </button>
            </div>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Enter ${createType} name...`}
              className="input-field text-sm w-full mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newItemName.trim() || createMutation.isPending}
                className="btn-primary text-xs"
              >
                {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { notify } = useNotifications();
  const [activeTab, setActiveTab] = useState<SettingsSection>('security');
  const [settings, setSettings] = useState<DashboardSettings>(defaultSettings);

  // Load settings
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsAPI.getSettings,
  });

  // Update local state when data loads
  useEffect(() => {
    if (data?.data) {
      const transformed = transformBackendToFrontend(data.data);
      setSettings({
        ...defaultSettings,
        ...transformed,
      });
    }
  }, [data]);

  // Transform backend data format to frontend format
  const transformBackendToFrontend = (backendData: any): Partial<DashboardSettings> => {
    const result: Partial<DashboardSettings> = {};

    if (backendData.security) {
      result.security = {
        dashboardUser: backendData.security.dashboardUser || '',
        dashboardPassword: backendData.security.dashboardPasswordSet ? '***' : '',
        dashboardJwtSecret: backendData.security.dashboardJwtSecretSet ? '***' : '',
      };
    }

    if (backendData.integrations) {
      result.github = {
        username: backendData.integrations.githubUser || '',
        token: backendData.integrations.githubTokenConfigured ? '***' : '',
      };
    }

    if (backendData.general) {
      result.server = {
        publicIp: backendData.general.serverPublicIp || '',
        appsBaseUrl: backendData.general.appsBaseUrl || '',
        allowDirectPortUrls: backendData.general.allowDirectPortUrls || false,
      };
    }

    return result;
  };

  // Update local state when data loads
  useEffect(() => {
    if (data?.data) {
      const transformed = transformBackendToFrontend(data.data);
      setSettings({
        ...defaultSettings,
        ...transformed,
      });
    }
  }, [data]);

  // Save mutation - send each section separately
  const saveMutation = useMutation({
    mutationFn: async (newSettings: DashboardSettings) => {
      const results = [];

      // Save security section
      if (newSettings.security) {
        const secResult = await settingsAPI.updateSection('security', {
          dashboardUser: newSettings.security.dashboardUser,
          ...(newSettings.security.dashboardPassword && newSettings.security.dashboardPassword !== '***' &&
            { dashboardPassword: newSettings.security.dashboardPassword }),
          ...(newSettings.security.dashboardJwtSecret && newSettings.security.dashboardJwtSecret !== '***' &&
            { dashboardJwtSecret: newSettings.security.dashboardJwtSecret }),
        });
        results.push(secResult);
      }

      // Save integrations section (github)
      if (newSettings.github) {
        const intResult = await settingsAPI.updateSection('integrations', {
          githubUser: newSettings.github.username,
          ...(newSettings.github.token && newSettings.github.token !== '***' &&
            { githubToken: newSettings.github.token }),
        });
        results.push(intResult);
      }

      // Save general section (server)
      if (newSettings.server) {
        const genResult = await settingsAPI.updateSection('general', {
          serverPublicIp: newSettings.server.publicIp,
          appsBaseUrl: newSettings.server.appsBaseUrl,
          allowDirectPortUrls: newSettings.server.allowDirectPortUrls,
        });
        results.push(genResult);
      }

      return { success: true, results };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      notify({
        type: 'success',
        title: 'Settings Saved',
        message: 'Your settings have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      notify({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save settings.',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const updateSection = <K extends keyof DashboardSettings>(
    section: K,
    updates: Partial<DashboardSettings[K]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...updates,
      },
    }));
  };

  const tabs: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'server', label: 'Server', icon: Server },
    { id: 'deploy', label: 'Deploy', icon: Rocket },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'features', label: 'Features', icon: LayoutGrid },
    { id: 'files', label: 'Files', icon: FolderOpen },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-dark-500">
          <Loader2 size={18} className="animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-dark-800 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-dark-100">Settings</h1>
            <p className="text-sm text-dark-400 mt-0.5">
              Manage dashboard configuration and preferences
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto flex gap-6">
          {/* Sidebar tabs */}
          <div className="w-48 shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-600/15 text-primary-400'
                    : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Settings content */}
          <div className="flex-1 space-y-4">
            {/* Security Section */}
            {activeTab === 'security' && (
              <SectionCard title="Security Settings" icon={Shield}>
                <TextField
                  label="Dashboard Username"
                  value={settings.security.dashboardUser}
                  onChange={(val) => updateSection('security', { dashboardUser: val })}
                  placeholder="admin"
                  description="Username for dashboard login"
                />
                <PasswordField
                  label="Dashboard Password"
                  value={settings.security.dashboardPassword}
                  onChange={(val) => updateSection('security', { dashboardPassword: val })}
                  placeholder="••••••••"
                  description="Leave empty to keep current password"
                />
                <PasswordField
                  label="JWT Secret"
                  value={settings.security.dashboardJwtSecret}
                  onChange={(val) => updateSection('security', { dashboardJwtSecret: val })}
                  placeholder="your-secret-key"
                  description="Secret key for JWT token generation"
                />
              </SectionCard>
            )}

            {/* GitHub Section */}
            {activeTab === 'github' && (
              <SectionCard title="GitHub Configuration" icon={Github}>
                <TextField
                  label="GitHub Username"
                  value={settings.github.username}
                  onChange={(val) => updateSection('github', { username: val })}
                  placeholder="your-username"
                  description="Your GitHub username for API calls"
                />
                <PasswordField
                  label="GitHub Token"
                  value={settings.github.token}
                  onChange={(val) => updateSection('github', { token: val })}
                  placeholder="ghp_xxxxxxxxxxxx"
                  description="Personal access token with repo and workflow scopes"
                />
              </SectionCard>
            )}

            {/* Notifications Section */}
            {activeTab === 'notifications' && (
              <SectionCard title="Notification Settings" icon={Bell}>
                <TextField
                  label="Slack Webhook URL"
                  value={settings.notifications.slackWebhook}
                  onChange={(val) => updateSection('notifications', { slackWebhook: val })}
                  placeholder="https://hooks.slack.com/services/..."
                  description="Incoming webhook URL for Slack notifications"
                />
                <div className="border-t border-dark-800 pt-4">
                  <h3 className="text-xs font-medium text-dark-300 mb-3">Email Configuration</h3>
                  <div className="space-y-4">
                    <TextField
                      label="SMTP Server"
                      value={settings.notifications.emailSmtp}
                      onChange={(val) => updateSection('notifications', { emailSmtp: val })}
                      placeholder="smtp.gmail.com:587"
                      description="SMTP server address with port"
                    />
                    <TextField
                      label="Email Username"
                      value={settings.notifications.emailUser}
                      onChange={(val) => updateSection('notifications', { emailUser: val })}
                      placeholder="user@example.com"
                    />
                    <PasswordField
                      label="Email Password"
                      value={settings.notifications.emailPass}
                      onChange={(val) => updateSection('notifications', { emailPass: val })}
                      placeholder="••••••••"
                    />
                    <TextField
                      label="From Address"
                      value={settings.notifications.emailFrom}
                      onChange={(val) => updateSection('notifications', { emailFrom: val })}
                      placeholder="deploy@example.com"
                      description="Sender email address"
                    />
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Server Section */}
            {activeTab === 'server' && (
              <SectionCard title="Server Configuration" icon={Server}>
                <TextField
                  label="Public IP Address"
                  value={settings.server.publicIp}
                  onChange={(val) => updateSection('server', { publicIp: val })}
                  placeholder="72.62.132.43"
                  description="Server public IP for external access"
                />
                <TextField
                  label="Apps Base URL"
                  value={settings.server.appsBaseUrl}
                  onChange={(val) => updateSection('server', { appsBaseUrl: val })}
                  placeholder="http://72.62.132.43"
                  description="Base URL for deployed applications"
                />
                <ToggleField
                  label="Allow Direct Port URLs"
                  checked={settings.server.allowDirectPortUrls}
                  onChange={(val) => updateSection('server', { allowDirectPortUrls: val })}
                  description="Allow accessing apps directly via port numbers"
                />
              </SectionCard>
            )}

            {/* Deploy Section */}
            {activeTab === 'deploy' && (
              <SectionCard title="Deployment Settings" icon={Rocket}>
                <TextField
                  label="Default Branch"
                  value={settings.deploy.defaultBranch}
                  onChange={(val) => updateSection('deploy', { defaultBranch: val })}
                  placeholder="main"
                  description="Default git branch for deployments"
                />
                <TextField
                  label="Build Command"
                  value={settings.deploy.buildCommand}
                  onChange={(val) => updateSection('deploy', { buildCommand: val })}
                  placeholder="npm run build"
                  description="Command to build the application"
                />
                <TextField
                  label="Install Command"
                  value={settings.deploy.installCommand}
                  onChange={(val) => updateSection('deploy', { installCommand: val })}
                  placeholder="npm install"
                  description="Command to install dependencies"
                />
              </SectionCard>
            )}

            {/* Terminal Section */}
            {activeTab === 'terminal' && (
              <SectionCard title="Terminal Settings" icon={Terminal}>
                <TextField
                  label="Shell"
                  value={settings.terminal.shell}
                  onChange={(val) => updateSection('terminal', { shell: val })}
                  placeholder="bash"
                  description="Default shell for terminal sessions (bash, zsh, sh)"
                />
                <TextField
                  label="Working Directory"
                  value={settings.terminal.workingDirectory}
                  onChange={(val) => updateSection('terminal', { workingDirectory: val })}
                  placeholder="/var/www"
                  description="Default working directory for new terminals"
                />
              </SectionCard>
            )}

            {/* Features Section */}
            {activeTab === 'features' && (
              <SectionCard title="Feature Toggles" icon={LayoutGrid}>
                <div className="space-y-4">
                  <ToggleField
                    label="Enable AI Assistant"
                    checked={settings.features.enableAIAssistant}
                    onChange={(val) => updateSection('features', { enableAIAssistant: val })}
                    description="Show AI Assistant in navigation and enable AI features"
                  />
                  <ToggleField
                    label="Enable File Manager"
                    checked={settings.features.enableFileManager}
                    onChange={(val) => updateSection('features', { enableFileManager: val })}
                    description="Show Server Files in navigation"
                  />
                  <ToggleField
                    label="Enable Terminal"
                    checked={settings.features.enableTerminal}
                    onChange={(val) => updateSection('features', { enableTerminal: val })}
                    description="Show Terminal in navigation"
                  />
                </div>
              </SectionCard>
            )}

            {/* Files Section */}
            {activeTab === 'files' && <FileBrowser />}
          </div>
        </div>
      </div>
    </div>
  );
}
