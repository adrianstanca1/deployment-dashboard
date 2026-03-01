// PM2 Process Status (normalized from pm2 jlist)
export interface PM2Process {
  pm_id: number;
  name: string;
  pid: number;
  // Normalized to top-level by the server
  status: 'online' | 'stopping' | 'stopped' | 'launching' | 'errored' | string;
  mode: string;
  // Generated deployment URL from nginx mappings
  url?: string;
  // Top-level monit (from pm2 v6)
  monit: {
    memory: number;
    cpu: number;
  };
  pm2_env: {
    status: string;
    pm_cwd: string;
    pm_exec_path?: string;
    pm_out_log_path?: string;
    pm_err_log_path?: string;
    restart_time: number;
    created_at?: number;
    started_at?: number;
    pm_uptime?: number;
    exec_mode?: string;
    node_version?: string;
    // monit also copied here by server normalization
    monit: {
      memory: number;
      cpu: number;
    };
    env: {
      PORT?: string;
      NODE_ENV?: string;
      [key: string]: string | undefined | Record<string, unknown>;
    };
  };
}

// Dashboard Project
export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'online' | 'error' | 'stopped' | 'not-deployed';
  pm_id?: number;
  port?: number;
  memory?: number;
  cpu?: number;
  uptime?: number;
  pid?: number;
  restarts?: number;
}

// GitHub Repository
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  default_branch: string;
  pushed_at: string;
  created_at: string;
  updated_at: string;
  visibility: 'public' | 'private';
  topics: string[];
  size: number;
  owner?: { login: string; avatar_url?: string; };
  fork?: boolean;
}

// GitHub Commit
export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
  html_url: string;
  parents: Array<{ sha: string }>;
}

// GitHub Branch
export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

// Docker Container (from server pipe-delimited format)
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
}

// Docker Image (from server pipe-delimited format)
export interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  size: string;
}

// Log Entry
export interface LogEntry {
  id: string;
  timestamp: string;
  process: string;
  message: string;
  type: 'out' | 'err' | 'system';
}

// Server Directory Item
export interface ServerDirectoryItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size?: number;
  modified: string;
  isDeployed: boolean;
  gitInfo?: {
    branch: string;
    lastCommit: string;
    lastCommitDate: string;
  };
}

// System Stats
export interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  uptime: number;
  load: number[];
}

// Docker Volume
export interface DockerVolume {
  driver: string;
  name: string;
  mountpoint: string;
}

// Docker Network
export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

// Docker Container Stats (from docker stats --no-stream)
export interface DockerContainerStats {
  ID: string;
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  MemPerc: string;
  NetIO: string;
  BlockIO: string;
  PIDs: string;
}

// GitHub Issue
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string; color: string }>;
  body: string | null;
  pull_request?: { url: string };
}

// GitHub Pull Request
export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  draft: boolean;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  merged_at: string | null;
}

// GitHub Release
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  html_url: string;
  assets: Array<{ name: string; download_count: number; size: number; browser_download_url: string }>;
}

// GitHub Workflow Run
export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_branch: string;
  head_sha: string;
  event: string;
  display_title: string;
}

// GitHub Workflow
export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled_inactivity' | 'disabled_manually' | string;
  html_url: string;
  created_at?: string;
  updated_at?: string;
}

// Branch comparison result
export interface BranchComparison {
  ahead_by: number;
  behind_by: number;
  status: 'ahead' | 'behind' | 'diverged' | 'identical';
  total_commits: number;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
  }>;
  files: Array<{
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed' | string;
    additions: number;
    deletions: number;
  }>;
}

// Commit activity data point
export interface CommitActivity {
  week: number;
  total: number;
  days: number[];
}

// Repository health metrics
export interface RepoHealthMetrics {
  lastCommitAt: string;
  openIssues: number;
  openPRs: number;
  lastBuildStatus: 'success' | 'failure' | 'in_progress' | null;
  lastBuildAt: string | null;
}

// GitHub Local Repo Status
export interface GitHubLocalStatus {
  exists: boolean;
  path: string;
  gitStatus: {
    branch: string;
    changes: string;
    lastCommitHash: string;
    lastCommitMsg: string;
    lastCommitAge: string;
  } | null;
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Git Command Result
export interface GitCommandResult {
  command: string;
  output: string;
  error: string | null;
  exitCode: number;
  duration: number;
}

// Dashboard Settings
export interface SecuritySettings {
  dashboardUser: string;
  dashboardPassword: string;
  dashboardJwtSecret: string;
}

export interface GithubSettings {
  username: string;
  token: string;
}

export interface NotificationSettings {
  slackWebhook: string;
  emailSmtp: string;
  emailUser: string;
  emailPass: string;
  emailFrom: string;
}

export interface ServerSettings {
  publicIp: string;
  appsBaseUrl: string;
  allowDirectPortUrls: boolean;
}

export interface DeploySettings {
  defaultBranch: string;
  buildCommand: string;
  installCommand: string;
}

export interface TerminalSettings {
  shell: string;
  workingDirectory: string;
}

export interface FeatureSettings {
  enableAIAssistant: boolean;
  enableFileManager: boolean;
  enableTerminal: boolean;
}

export interface DashboardSettings {
  security: SecuritySettings;
  github: GithubSettings;
  notifications: NotificationSettings;
  server: ServerSettings;
  deploy: DeploySettings;
  terminal: TerminalSettings;
  features: FeatureSettings;
}
