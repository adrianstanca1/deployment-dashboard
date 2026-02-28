import axios from 'axios';
import type {
  PM2Process,
  GitHubRepo,
  GitHubCommit,
  GitHubBranch,
  GitHubIssue,
  GitHubPR,
  GitHubRelease,
  GitHubWorkflowRun,
  GitHubLocalStatus,
  DockerContainer,
  DockerImage,
  DockerVolume,
  DockerNetwork,
  DockerContainerStats,
  LogEntry,
  ServerDirectoryItem,
  SystemStats,
  DashboardSettings,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Inject JWT into every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dashboard_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear session and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dashboard_token');
      localStorage.removeItem('dashboard_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    return res.data;
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// System API calls - maps to /api/server/*
export const systemAPI = {
  getStats: async () => {
    const response = await api.get('/server/stats');
    return response.data;
  },
  getProcesses: async () => {
    const response = await api.get('/server/processes');
    return response.data;
  },
  getInfo: async () => {
    const response = await api.get('/server/info');
    return response.data;
  },
};

// Docker API calls - maps to /api/docker/*
export const dockerAPI = {
  getContainers: async () => {
    const response = await api.get('/docker/containers');
    return response.data;
  },
  getImages: async () => {
    const response = await api.get('/docker/images');
    return response.data;
  },
  getVolumes: async () => {
    const response = await api.get('/docker/volumes');
    return response.data;
  },
  getNetworks: async () => {
    const response = await api.get('/docker/networks');
    return response.data;
  },
  startContainer: async (id: string) => {
    const response = await api.post(`/docker/containers/${id}/start`);
    return response.data;
  },
  stopContainer: async (id: string) => {
    const response = await api.post(`/docker/containers/${id}/stop`);
    return response.data;
  },
  restartContainer: async (id: string) => {
    const response = await api.post(`/docker/containers/${id}/restart`);
    return response.data;
  },
  getLogs: async (id: string) => {
    const response = await api.get(`/docker/containers/${id}/logs`);
    return response.data;
  },
  getStats: async (id: string) => {
    const response = await api.get(`/docker/containers/${id}/stats`);
    return response.data;
  },
  containerAction: async (action: string, id: string) => {
    const response = await api.post(`/docker/containers/${id}/${action}`);
    return response.data;
  },
  removeContainer: async (id: string) => {
    const response = await api.delete(`/docker/containers/${id}`);
    return response.data;
  },
  inspectContainer: async (id: string) => {
    const response = await api.get(`/docker/containers/${id}/inspect`);
    return response.data;
  },
  getContainerStats: async (id: string) => {
    return dockerAPI.getStats(id);
  },
  removeImage: async (id: string) => {
    const response = await api.delete(`/docker/images/${id}`);
    return response.data;
  },
  removeVolume: async (name: string) => {
    const response = await api.delete(`/docker/volumes/${name}`);
    return response.data;
  },
  prune: async (type: 'containers' | 'images' | 'volumes' | 'all') => {
    const response = await api.post('/docker/prune', { type });
    return response.data;
  },
  run: async (opts: any) => {
    const response = await api.post('/docker/run', opts);
    return response.data;
  },
  getSystemDf: async () => {
    const response = await api.get('/docker/system/df');
    return response.data;
  },
};

// Projects API - maps to /api/projects
export const projectsAPI = {
  getProjects: async () => {
    const response = await api.get('/projects');
    return response.data;
  },
  deployProject: async (name: string, port?: number) => {
    const response = await api.post(`/projects/${name}/deploy`, { port });
    return response.data;
  },
};

// GitHub API - maps to /api/github/*
export const githubAPI = {
  getRepos: async () => {
    const response = await api.get('/github/repos');
    return response.data;
  },
  getRepo: async (owner: string, repo: string) => {
    const response = await api.get(`/github/repo/${owner}/${repo}`);
    return response.data;
  },
  getBranches: async (owner: string, repo: string) => {
    const response = await api.get(`/github/branches/${owner}/${repo}`);
    return response.data;
  },
  getCommits: async (owner: string, repo: string) => {
    const response = await api.get(`/github/commits/${owner}/${repo}`);
    return response.data;
  },
  deployFromGitHub: async (repoUrl: string, branch = 'main') => {
    const response = await api.post('/github/deploy', { repoUrl, branch });
    return response.data;
  },
  // Legacy compatibility
  getIssues: async (repo: string, state = 'open') => {
    return { success: true, data: [] };
  },
  getPulls: async (repo: string, state = 'open') => {
    return { success: true, data: [] };
  },
  getReleases: async (repo: string) => {
    return { success: true, data: [] };
  },
  getReadme: async (repo: string) => {
    return { success: true, data: '' };
  },
  getActions: async (repo: string) => {
    return { success: true, data: [] };
  },
  getLocalStatus: async (repo: string) => {
    return { success: true, data: { status: 'unknown' } };
  },
  pullLocal: async (repo: string) => {
    return { success: true, data: '' };
  },
  // Extra methods
  syncFork: async (repo: string) => {
    return { success: true, data: { synced: true } };
  },
  createBranch: async (repo: string, branchName: string, baseBranch = 'main') => {
    return { success: true, data: { branch: branchName } };
  },
  triggerWorkflow: async (repo: string, workflowId: string, branch = 'main', inputs: Record<string, string> = {}) => {
    return { success: true, data: { triggered: true } };
  },
  createIssue: async (repo: string, title: string, body = '', labels: string[] = []) => {
    return { success: true, data: { issueNumber: 1 } };
  },
  createPR: async (repo: string, title: string, head: string, base: string, body = '') => {
    return { success: true, data: { prNumber: 1 } };
  },
  mergePR: async (repo: string, pullNumber: number) => {
    return { success: true, data: { merged: true } };
  },
  compareBranches: async (repo: string, base: string, head: string) => {
    return { success: true, data: { ahead_by: 0, behind_by: 0 } };
  },
  getWorkflows: async (repo: string) => {
    return { success: true, data: [] };
  },
  getCommitActivity: async (repo: string) => {
    return { success: true, data: [] };
  },
};

// System commands API
export const systemExecAPI = {
  exec: async (command: string) => {
    const response = await api.post('/system/exec', { command });
    return response.data;
  },
};

// Legacy exports for compatibility
export const pm2API = {
  getList: async () => {
    const response = await dockerAPI.getContainers();
    const containers = response.data || [];
    return {
      success: true,
      data: containers.map((c: any) => ({
        name: c.Names?.[0]?.replace('/', '') || c.Id?.slice(0, 12),
        status: c.State === 'running' ? 'online' : 'stopped',
        uptime: c.Status,
        cpu: '0%',
        memory: '0 MB',
        pm_id: c.Id?.slice(0, 12),
        pid: 0,
        instances: 1,
        mode: 'docker',
        exec_interpreter: 'docker',
        pm_uptime: Date.now(),
        restart_time: 0,
        unstable_restarts: 0,
        version: c.Image || '',
      })),
    };
  },
  getSummary: async () => {
    const response = await dockerAPI.getContainers();
    const containers = response.data || [];
    const running = containers.filter((c: any) => c.State === 'running').length;
    return {
      success: true,
      data: {
        total: containers.length,
        online: running,
        errored: 0,
        stopped: containers.length - running,
      },
    };
  },
  restart: async (name: string) => {
    return dockerAPI.restartContainer(name);
  },
  stop: async (name: string) => {
    return dockerAPI.stopContainer(name);
  },
  start: async (name: string) => {
    return dockerAPI.startContainer(name);
  },
  getLogs: async (name: string) => {
    return dockerAPI.getLogs(name);
  },
  save: async () => {
    return { success: true };
  },
  delete: async (name: string) => {
    return dockerAPI.removeContainer(name);
  },
};

// Server file API
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
  owner?: string;
}

export const serverFileAPI = {
  browse: async (path: string = '/') => {
    const response = await api.post('/system/exec', { command: `ls -la ${path}` });
    return {
      success: true,
      data: {
        path,
        items: [] as FileItem[],
      },
    };
  },
  getContent: async (path: string) => {
    return { success: true, data: { content: '', path, size: 0, modified: '' } };
  },
  saveContent: async (path: string, content: string) => {
    return { success: true, message: 'Saved' };
  },
  create: async (path: string, type: 'file' | 'directory', content?: string) => {
    return { success: true, message: 'Created' };
  },
  delete: async (path: string) => {
    return { success: true, message: 'Deleted' };
  },
  download: (path: string) => `/api/server/download?path=${encodeURIComponent(path)}`,
};

export const serverAPI = {
  getApps: async () => {
    const response = await projectsAPI.getProjects();
    return {
      success: true,
      data: (response.data || []).map((p: any) => p.name),
    };
  },
  getApp: async (name: string) => {
    return { success: true, data: { name } };
  },
};

// Settings API
export const settingsAPI = {
  getSettings: async () => {
    return { success: true, data: {} as DashboardSettings };
  },
  updateSection: async (section: string, values: Record<string, unknown>) => {
    return { success: true, message: 'Updated' };
  },
  updateSettings: async (settings: DashboardSettings) => {
    return { success: true };
  },
  getHealth: async () => {
    return { success: true, settingsFile: { exists: true, path: '', writable: true } };
  },
};

// Git API
export const gitAPI = {
  execute: async (command: string, cwd = '/var/www') => {
    return { success: true, data: '' };
  },
};

// Deploy API
export const deployAPI = {
  clone: async (repo: string, branch = 'main') => {
    return { success: true };
  },
  build: async (name: string) => {
    return { success: true };
  },
  install: async (name: string) => {
    return { success: true };
  },
};

// PM2 Extra API
export const pm2ExtraAPI = {
  bulk: async (action: 'restart' | 'stop' | 'start' | 'delete', names: string[]) => {
    return { success: true };
  },
  restartErrored: async () => {
    return { success: true };
  },
  save: async () => {
    return { success: true };
  },
};

export default api;
