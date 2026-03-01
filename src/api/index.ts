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

function normalizeRepoName(ownerOrRepo: string, repoName?: string) {
  const value = repoName || ownerOrRepo;
  return value.includes('/') ? value.split('/').pop() || value : value;
}

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
  getNetwork: async () => {
    const response = await api.get('/system/network');
    return response.data;
  },
  getPorts: async () => {
    const response = await api.get('/system/ports');
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
  getBranches: async (ownerOrRepo: string, repoName?: string) => {
    const response = await api.get(`/github/branches/${normalizeRepoName(ownerOrRepo, repoName)}`);
    return response.data;
  },
  getCommits: async (ownerOrRepo: string, repoName?: string) => {
    const response = await api.get(`/github/commits/${normalizeRepoName(ownerOrRepo, repoName)}`);
    return response.data;
  },
  deployFromGitHub: async (repoUrl: string, branch = 'main') => {
    const response = await api.post('/github/deploy', { repoUrl, branch });
    return response.data;
  },
  getIssues: async (repo: string, state = 'open') => {
    const response = await api.get(`/github/issues/${normalizeRepoName(repo)}`, { params: { state } });
    return response.data;
  },
  getPulls: async (repo: string, state = 'open') => {
    const response = await api.get(`/github/pulls/${normalizeRepoName(repo)}`, { params: { state } });
    return response.data;
  },
  getReleases: async (repo: string) => {
    const response = await api.get(`/github/releases/${normalizeRepoName(repo)}`);
    return response.data;
  },
  getReadme: async (repo: string) => {
    const response = await api.get(`/github/readme/${normalizeRepoName(repo)}`);
    return response.data;
  },
  getActions: async (repo: string) => {
    const response = await api.get(`/github/actions/${normalizeRepoName(repo)}`);
    return response.data;
  },
  getLocalStatus: async (repo: string) => {
    const response = await api.get(`/github/local-status/${normalizeRepoName(repo)}`);
    return response.data;
  },
  pullLocal: async (repo: string) => {
    const response = await api.post(`/github/pull-local/${normalizeRepoName(repo)}`);
    return response.data;
  },
  syncFork: async (repo: string) => {
    const response = await api.post(`/github/sync/${normalizeRepoName(repo)}`);
    return response.data;
  },
  createBranch: async (repo: string, branchName: string, baseBranch = 'main') => {
    const response = await api.post(`/github/create-branch/${normalizeRepoName(repo)}`, { branchName, baseBranch });
    return response.data;
  },
  triggerWorkflow: async (repo: string, workflowId: string, branch = 'main', inputs: Record<string, string> = {}) => {
    const response = await api.post(`/github/trigger-workflow/${normalizeRepoName(repo)}`, { workflowId, branch, inputs });
    return response.data;
  },
  createIssue: async (repo: string, title: string, body = '', labels: string[] = []) => {
    const response = await api.post(`/github/create-issue/${normalizeRepoName(repo)}`, { title, body, labels });
    return response.data;
  },
  createPR: async (repo: string, title: string, head: string, base: string, body = '') => {
    const response = await api.post(`/github/create-pr/${normalizeRepoName(repo)}`, { title, head, base, body });
    return response.data;
  },
  mergePR: async (repo: string, pullNumber: number) => {
    const response = await api.post(`/github/merge-pr/${normalizeRepoName(repo)}/${pullNumber}`);
    return response.data;
  },
  compareBranches: async (repo: string, base: string, head: string) => {
    const response = await api.get(`/github/compare/${normalizeRepoName(repo)}`, { params: { base, head } });
    return response.data;
  },
  getWorkflows: async (repo: string) => {
    const response = await api.get(`/github/workflows/${normalizeRepoName(repo)}`);
    return response.data;
  },
  getTree: async (repo: string, ref?: string, recursive = true) => {
    const response = await api.get(`/github/tree/${normalizeRepoName(repo)}`, {
      params: { ref, recursive },
    });
    return response.data;
  },
  getCommitActivity: async (repo: string) => {
    const response = await api.get(`/github/commit-activity/${normalizeRepoName(repo)}`);
    return response.data;
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
    const response = await api.get('/server/browse', { params: { path } });
    return response.data;
  },
  getContent: async (path: string) => {
    const response = await api.get('/server/edit', { params: { path } });
    return response.data;
  },
  saveContent: async (path: string, content: string) => {
    const response = await api.post('/server/edit', { path, content });
    return response.data;
  },
  create: async (path: string, type: 'file' | 'directory', content?: string) => {
    const response = await api.post('/server/create', { path, type, content });
    return response.data;
  },
  delete: async (path: string) => {
    const response = await api.delete('/server/delete', { data: { path } });
    return response.data;
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
    const response = await api.get('/settings');
    return response.data;
  },
  updateSection: async (section: string, values: Record<string, unknown>) => {
    const response = await api.post('/settings', { section, values });
    return response.data;
  },
  updateSettings: async (settings: DashboardSettings) => {
    const entries = Object.entries(settings as unknown as Record<string, unknown>);
    const results = await Promise.all(entries.map(([section, values]) => api.post('/settings', { section, values })));
    return { success: results.every((result) => result.data?.success !== false), data: results.map((result) => result.data) };
  },
  getHealth: async () => {
    const response = await api.get('/settings/health');
    return response.data;
  },
};

// Git API
export const gitAPI = {
  execute: async (command: string, cwd = '/opt/docker/projects') => {
    const response = await api.post('/git/command', { command, cwd });
    return response.data;
  },
};

// Deploy API
export const deployAPI = {
  clone: async (repo: string, branch = 'main') => {
    const response = await api.post('/deploy/clone', { repo: normalizeRepoName(repo), branch });
    return response.data;
  },
  build: async (name: string) => {
    const response = await api.post('/deploy/build', { name: normalizeRepoName(name) });
    return response.data;
  },
  install: async (name: string) => {
    const response = await api.post('/deploy/install', { name: normalizeRepoName(name) });
    return response.data;
  },
};

// PM2 Extra API
export const pm2ExtraAPI = {
  bulk: async (action: 'restart' | 'stop' | 'start' | 'delete', names: string[]) => {
    const response = await api.post('/pm2/bulk', { action, names });
    return response.data;
  },
  restartErrored: async () => {
    const response = await api.post('/pm2/restart-errored');
    return response.data;
  },
  save: async () => {
    const response = await api.post('/pm2/save');
    return response.data;
  },
};

export default api;
