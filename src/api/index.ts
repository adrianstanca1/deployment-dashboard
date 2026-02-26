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
  res => res,
  err => {
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
    const res = await api.post<{ success: boolean; token: string; username: string; error?: string }>(
      '/auth/login', { username, password }
    );
    return res.data;
  },
  me: async () => {
    const res = await api.get<{ success: boolean; user: { username: string } }>('/auth/me');
    return res.data;
  },
};

// PM2 API calls
export const pm2API = {
  // Returns full process list
  getList: async () => {
    const response = await api.get<{ success: boolean; data: PM2Process[] }>('/pm2/list');
    return response.data;
  },

  // Returns summary counts
  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: { total: number; online: number; errored: number; stopped: number } }>('/pm2/status');
    return response.data;
  },

  start: async (name: string) => {
    const response = await api.post(`/pm2/start/${name}`);
    return response.data;
  },

  stop: async (name: string) => {
    const response = await api.post(`/pm2/stop/${name}`);
    return response.data;
  },

  restart: async (name: string) => {
    const response = await api.post(`/pm2/restart/${name}`);
    return response.data;
  },

  delete: async (name: string) => {
    const response = await api.post(`/pm2/delete/${name}`);
    return response.data;
  },

  getLogs: async (name: string, lines = 200) => {
    const response = await api.get<{ success: boolean; data: string }>(
      `/pm2/logs/${name}?lines=${lines}`
    );
    return response.data;
  },
  save: async () => {
    const response = await api.post('/pm2/save');
    return response.data;
  },
};

// GitHub API calls
export const githubAPI = {
  getRepos: async () => {
    const response = await api.get<{ success: boolean; data: GitHubRepo[] }>('/github/repos');
    return response.data;
  },
  getCommits: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: GitHubCommit[] }>(`/github/commits/${repo}`);
    return response.data;
  },
  getBranches: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: GitHubBranch[] }>(`/github/branches/${repo}`);
    return response.data;
  },
  getIssues: async (repo: string, state = 'open') => {
    const response = await api.get<{ success: boolean; data: GitHubIssue[] }>(`/github/issues/${repo}?state=${state}`);
    return response.data;
  },
  getPulls: async (repo: string, state = 'open') => {
    const response = await api.get<{ success: boolean; data: GitHubPR[] }>(`/github/pulls/${repo}?state=${state}`);
    return response.data;
  },
  getReleases: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: GitHubRelease[] }>(`/github/releases/${repo}`);
    return response.data;
  },
  getReadme: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: string }>(`/github/readme/${repo}`);
    return response.data;
  },
  getActions: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: GitHubWorkflowRun[] }>(`/github/actions/${repo}`);
    return response.data;
  },
  getLocalStatus: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: GitHubLocalStatus }>(`/github/local-status/${repo}`);
    return response.data;
  },
  pullLocal: async (repo: string) => {
    const response = await api.post<{ success: boolean; data: string }>(`/github/pull-local/${repo}`);
    return response.data;
  },
  // New GitHub API functions
  syncFork: async (repo: string) => {
    const response = await api.post<{ success: boolean; data: { synced: boolean; upstream: string; sha: string }; error?: string }>(`/github/sync/${repo}`);
    return response.data;
  },
  createBranch: async (repo: string, branchName: string, baseBranch = 'main') => {
    const response = await api.post<{ success: boolean; data: { branch: string; sha: string }; error?: string }>(`/github/create-branch/${repo}`, { branchName, baseBranch });
    return response.data;
  },
  triggerWorkflow: async (repo: string, workflowId: string, branch = 'main', inputs: Record<string, string> = {}) => {
    const response = await api.post<{ success: boolean; data: { triggered: boolean; workflowId: string; branch: string }; error?: string }>(`/github/trigger-workflow/${repo}`, { workflowId, branch, inputs });
    return response.data;
  },
  createIssue: async (repo: string, title: string, body = '', labels: string[] = []) => {
    const response = await api.post<{ success: boolean; data: { issueNumber: number; html_url: string; title: string }; error?: string }>(`/github/create-issue/${repo}`, { title, body, labels });
    return response.data;
  },
  createPR: async (repo: string, title: string, head: string, base: string, body = '') => {
    const response = await api.post<{ success: boolean; data: { prNumber: number; html_url: string; title: string; state: string }; error?: string }>(`/github/create-pr/${repo}`, { title, head, base, body });
    return response.data;
  },
  mergePR: async (repo: string, pullNumber: number, commitMessage?: string, sha?: string) => {
    const response = await api.post<{ success: boolean; data: { merged: boolean; sha: string; message: string }; error?: string }>(`/github/merge-pr/${repo}/${pullNumber}`, { commitMessage, sha });
    return response.data;
  },
  compareBranches: async (repo: string, base: string, head: string) => {
    const response = await api.get<{ success: boolean; data: { ahead_by: number; behind_by: number; status: string; total_commits: number; commits: any[]; files: any[] }; error?: string }>(`/github/compare/${repo}?base=${base}&head=${head}`);
    return response.data;
  },
  getWorkflows: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: Array<{ id: number; name: string; path: string; state: string; html_url: string }>; error?: string }>(`/github/workflows/${repo}`);
    return response.data;
  },
  getCommitActivity: async (repo: string) => {
    const response = await api.get<{ success: boolean; data: Array<{ week: number; total: number; days: number[] }>; error?: string }>(`/github/commit-activity/${repo}`);
    return response.data;
  },
};

// Server API calls
export const serverAPI = {
  getApps: async () => {
    const response = await api.get<{ success: boolean; data: string[] }>('/server/apps');
    return response.data;
  },

  getApp: async (name: string) => {
    const response = await api.get<{ success: boolean; data: ServerDirectoryItem }>(`/server/app/${name}`);
    return response.data;
  },
};

// Docker API calls
export const dockerAPI = {
  getContainers: async () => {
    const response = await api.get<{ success: boolean; data: DockerContainer[] }>('/docker/containers');
    return response.data;
  },
  getImages: async () => {
    const response = await api.get<{ success: boolean; data: DockerImage[] }>('/docker/images');
    return response.data;
  },
  getVolumes: async () => {
    const response = await api.get<{ success: boolean; data: DockerVolume[] }>('/docker/volumes');
    return response.data;
  },
  getNetworks: async () => {
    const response = await api.get<{ success: boolean; data: DockerNetwork[] }>('/docker/networks');
    return response.data;
  },
  getSystemDf: async () => {
    const response = await api.get<{ success: boolean; data: Array<Record<string, string>> }>('/docker/system/df');
    return response.data;
  },
  containerAction: async (action: string, id: string) => {
    const response = await api.post(`/docker/container/${action}/${id}`);
    return response.data;
  },
  removeContainer: async (id: string) => {
    const response = await api.delete(`/docker/container/${id}`);
    return response.data;
  },
  inspectContainer: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Record<string, unknown> }>(`/docker/container/${id}/inspect`);
    return response.data;
  },
  getContainerStats: async (id: string) => {
    const response = await api.get<{ success: boolean; data: DockerContainerStats }>(`/docker/container/${id}/stats`);
    return response.data;
  },
  removeImage: async (id: string) => {
    const response = await api.delete(`/docker/image/${id}`);
    return response.data;
  },
  removeVolume: async (name: string) => {
    const response = await api.delete(`/docker/volume/${name}`);
    return response.data;
  },
  prune: async (type: 'containers' | 'images' | 'volumes' | 'all') => {
    const response = await api.post('/docker/prune', { type });
    return response.data;
  },
  run: async (opts: { image: string; name?: string; ports?: string[]; env?: string[]; detach?: boolean }) => {
    const response = await api.post('/docker/run', opts);
    return response.data;
  },
};

// PM2 bulk + extras
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

// System API calls
export const systemAPI = {
  getStats: async () => {
    const response = await api.get<{ success: boolean; data: SystemStats }>('/system/stats');
    return response.data;
  },
  getNetwork: async () => {
    const response = await api.get<{ success: boolean; data: Array<{address: string; iface: string}> }>('/system/network');
    return response.data;
  },
  getPorts: async () => {
    const response = await api.get<{ success: boolean; data: Array<{port: number; address: string; process: string}> }>('/system/ports');
    return response.data;
  },
  exec: async (command: string) => {
    const response = await api.post<{ success: boolean; data: string }>('/system/exec', { command });
    return response.data;
  },
};

// Git API calls
export const gitAPI = {
  execute: async (command: string, cwd = '/var/www') => {
    const response = await api.post<{ success: boolean; data: string }>('/git/command', {
      command,
      cwd,
    });
    return response.data;
  },
};

// Deploy API calls
export const deployAPI = {
  clone: async (repo: string, branch = 'main') => {
    const response = await api.post('/deploy/clone', { repo, branch });
    return response.data;
  },

  build: async (name: string) => {
    const response = await api.post('/deploy/build', { name });
    return response.data;
  },

  install: async (name: string) => {
    const response = await api.post('/deploy/install', { name });
    return response.data;
  },
};
