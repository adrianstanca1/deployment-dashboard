import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, GitBranch, Plus, AlertCircle, CheckCircle, XCircle, Loader2,
  Zap, GitMerge, FileText, RefreshCw, ExternalLink, X, Rocket,
  Download, Copy, Star, GitFork, Clock, RotateCw, Workflow
} from 'lucide-react';
import { githubAPI } from '@/api';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime } from '@/utils';
import type { GitHubRepo } from '@/types';

// ============================================================
// ACTION MODALS
// ============================================================

interface ModalProps {
  repo: { name: string; default_branch: string; html_url: string; full_name: string; owner?: { login: string } };
  onClose: () => void;
}

export function CreateBranchModal({ repo, onClose }: ModalProps) {
  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState(repo.default_branch);
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const { data: branches } = useQuery({
    queryKey: ['github-branches', repo.name],
    queryFn: () => githubAPI.getBranches(repo.name),
  });

  const mutation = useMutation({
    mutationFn: () => githubAPI.createBranch(repo.full_name, branchName, baseBranch),
    onSuccess: () => {
      notify({ type: 'success', title: `Branch '${branchName}' created successfully!` });
      qc.invalidateQueries({ queryKey: ['github-branches', repo.full_name] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      notify({ type: 'error', title: 'Failed to create branch', message: msg });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <GitBranch size={18} className="text-primary-400" />
            </div>
            Create New Branch
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X size={18} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Branch Name</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/my-awesome-feature"
              className="input-field w-full text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Base Branch</label>
            <select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="input-field w-full text-sm"
            >
              {branches?.data?.map((b: any) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-dark-800/50 rounded-lg p-3 text-xs text-dark-400">
            <p>The branch will be created from <span className="text-primary-400 font-mono">{baseBranch}</span></p>
          </div>

          <div className="flex gap-3 pt-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!branchName || mutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <GitBranch size={16} />
              )}
              Create Branch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TriggerWorkflowModal({ repo, onClose }: ModalProps) {
  const [workflowId, setWorkflowId] = useState('');
  const [branch, setBranch] = useState(repo.default_branch);
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['github-workflows', repo.name],
    queryFn: () => githubAPI.getWorkflows(repo.name),
  });

  const mutation = useMutation({
    mutationFn: () => githubAPI.triggerWorkflow(repo.full_name, workflowId, branch),
    onSuccess: () => {
      notify({ type: 'success', title: `Workflow triggered on ${branch}!`, message: 'Check the Actions tab for progress.' });
      qc.invalidateQueries({ queryKey: ['github-actions', repo.full_name] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      notify({ type: 'error', title: 'Failed to trigger workflow', message: msg });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Zap size={18} className="text-yellow-400" />
            </div>
            Trigger Workflow
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X size={18} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-primary-400" />
              <p className="text-dark-400 text-sm mt-3">Loading workflows...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Select Workflow</label>
                <select
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  <option value="">Choose a workflow...</option>
                  {workflows?.data?.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Branch / Tag</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="input-field w-full text-sm"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={!workflowId || mutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  Run Workflow
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CreateIssueModal({ repo, onClose }: ModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [labels, setLabels] = useState('');
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => githubAPI.createIssue(repo.full_name, title, body, labels.split(',').map(l => l.trim()).filter(Boolean)),
    onSuccess: (data) => {
      notify({ 
        type: 'success', 
        title: `Issue #${data.data.issueNumber} created!`,
        message: 'View it on GitHub'
      });
      qc.invalidateQueries({ queryKey: ['github-issues', repo.full_name] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      notify({ type: 'error', title: 'Failed to create issue', message: msg });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-600 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <AlertCircle size={18} className="text-green-400" />
            </div>
            Create New Issue
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X size={18} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              className="input-field w-full text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Description</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detailed description of the issue..."
              rows={5}
              className="input-field w-full resize-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Labels</label>
            <input
              type="text"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="bug, enhancement, help wanted"
              className="input-field w-full text-sm"
            />
            <p className="text-xs text-dark-500 mt-1">Comma-separated list of labels</p>
          </div>

          <div className="flex gap-3 pt-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!title || mutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <AlertCircle size={16} />
              )}
              Create Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreatePRModal({ repo, onClose }: ModalProps) {
  const [title, setTitle] = useState('');
  const [head, setHead] = useState('');
  const [base, setBase] = useState(repo.default_branch);
  const [body, setBody] = useState('');
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const { data: branches } = useQuery({
    queryKey: ['github-branches', repo.name],
    queryFn: () => githubAPI.getBranches(repo.name),
  });

  const mutation = useMutation({
    mutationFn: () => githubAPI.createPR(repo.full_name, title, head, base, body),
    onSuccess: (data) => {
      notify({ 
        type: 'success', 
        title: `PR #${data.data.prNumber} created!`,
        message: data.data.html_url
      });
      qc.invalidateQueries({ queryKey: ['github-pulls', repo.full_name] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      notify({ type: 'error', title: 'Failed to create PR', message: msg });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-600 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <GitMerge size={18} className="text-purple-400" />
            </div>
            Create Pull Request
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X size={18} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="PR title"
              className="input-field w-full text-sm"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">From (head)</label>
              <select
                value={head}
                onChange={(e) => setHead(e.target.value)}
                className="input-field w-full text-sm"
              >
                <option value="">Select branch...</option>
                {branches?.data?.map((b: any) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Into (base)</label>
              <select
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="input-field w-full text-sm"
              >
                {branches?.data?.map((b: any) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Description</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your changes..."
              rows={4}
              className="input-field w-full resize-none text-sm"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!title || !head || mutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <GitMerge size={16} />
              )}
              Create PR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SyncForkModal({ repo, onClose }: ModalProps) {
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => githubAPI.syncFork(repo.full_name),
    onSuccess: (data) => {
      notify({ 
        type: 'success', 
        title: 'Fork synced successfully!',
        message: `Synced with ${data.data.upstream}`
      });
      qc.invalidateQueries({ queryKey: ['github-repos'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      notify({ type: 'error', title: 'Failed to sync fork', message: msg });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-dark-100 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <RotateCw size={18} className="text-blue-400" />
            </div>
            Sync Fork
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X size={18} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-dark-300">
            This will sync your fork with the upstream repository to get the latest changes.
          </p>

          <div className="bg-dark-800/50 rounded-lg p-4 text-sm">
            <p className="text-dark-400">Repository:</p>
            <p className="text-dark-200 font-mono">{repo.name}</p>
          </div>

          <div className="flex gap-3 pt-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RotateCw size={16} />
              )}
              Sync Fork
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// QUICK ACTIONS BAR COMPONENT
// ============================================================

interface QuickActionsProps {
  repo: {
    name: string;
    default_branch: string;
    html_url: string;
    fork?: boolean;
    owner?: { login: string };
  };
  localStatus?: { exists: boolean; gitStatus?: { branch: string; changes: string } };
  onRefresh: () => void;
  onCreateBranch: () => void;
  onTriggerWorkflow: () => void;
  onCreateIssue: () => void;
  onCreatePR: () => void;
  onSyncFork?: () => void;
  onPullLocal: () => void;
  onDeploy: () => void;
}

export function QuickActionsBar({
  repo,
  localStatus,
  onRefresh,
  onCreateBranch,
  onTriggerWorkflow,
  onCreateIssue,
  onCreatePR,
  onSyncFork,
  onPullLocal,
  onDeploy,
}: QuickActionsProps) {
  const cloneUrl = `https://github.com/${repo.owner?.login ?? 'unknown'}/${repo.name}.git`;

  const copyCloneUrl = () => {
    navigator.clipboard.writeText(cloneUrl);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap py-3 px-4 bg-dark-800/50 border-b border-dark-700">
      {/* Local Status */}
      {localStatus?.exists ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
          <CheckCircle size={14} className="text-green-400" />
          <span className="text-green-400">Cloned</span>
          <span className="text-dark-500">·</span>
          <span className="text-dark-300 font-mono">{localStatus.gitStatus?.branch}</span>
          {localStatus.gitStatus?.changes && (
            <span className="text-yellow-400 text-xs">
              ({localStatus.gitStatus.changes.split('\n').length} changes)
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700/50 border border-dark-600 text-sm text-dark-400">
          <XCircle size={14} />
          Not cloned
        </div>
      )}

      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {localStatus?.exists && (
          <button
            onClick={onPullLocal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm text-dark-200 transition-colors"
          >
            <Download size={14} />
            Pull
          </button>
        )}

        {repo.fork && onSyncFork && (
          <button
            onClick={onSyncFork}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-sm text-blue-300 transition-colors"
          >
            <RotateCw size={14} />
            Sync Fork
          </button>
        )}

        <button
          onClick={onCreateBranch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm text-dark-200 transition-colors"
        >
          <GitBranch size={14} />
          Branch
        </button>

        <button
          onClick={onTriggerWorkflow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-sm text-yellow-300 transition-colors"
        >
          <Zap size={14} />
          Run
        </button>

        <button
          onClick={onCreateIssue}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-sm text-green-300 transition-colors"
        >
          <AlertCircle size={14} />
          Issue
        </button>

        <button
          onClick={onCreatePR}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-sm text-purple-300 transition-colors"
        >
          <GitMerge size={14} />
          PR
        </button>

        <button
          onClick={onDeploy}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-sm text-white font-medium transition-colors"
        >
          <Rocket size={14} />
          Deploy
        </button>

        <button
          onClick={copyCloneUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm text-dark-200 transition-colors"
          title="Copy clone URL"
        >
          <Copy size={14} />
        </button>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm text-dark-200 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>

        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 text-sm text-dark-200 transition-colors"
          title="Open on GitHub"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

// ============================================================
// COMMIT ACTIVITY CHART COMPONENT
// ============================================================

export function CommitActivityChart({ data }: { data: Array<{ week: number; total: number; days: number[] }> }) {
  if (!data || data.length === 0) return null;

  const maxCommits = Math.max(...data.map(d => d.total), 1);
  const weeks = data.slice(-12); // Last 12 weeks

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
      <h4 className="text-sm font-medium text-dark-300 mb-3 flex items-center gap-2">
        <GitFork size={14} />
        Commit Activity (12 weeks)
      </h4>
      <div className="flex items-end gap-1 h-20">
        {weeks.map((week, i) => (
          <div
            key={i}
            className="flex-1 bg-primary-600/30 rounded-t transition-all hover:bg-primary-500/50"
            style={{ height: `${(week.total / maxCommits) * 100}%` }}
            title={`${week.total} commits`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-dark-500">
        <span>12 weeks ago</span>
        <span>Now</span>
      </div>
    </div>
  );
}

export function GitHubFileBrowser({ repo }: { repo: GitHubRepo }) {
  const [ref, setRef] = useState(repo.default_branch);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['github-tree', repo.name, ref],
    queryFn: () => githubAPI.getTree(repo.name, ref, true),
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
  });

  const entries = data?.data ?? [];

  const topEntries = entries
    .slice(0, 40)
    .map((entry: any) => ({
      ...entry,
      sizeLabel: typeof entry.size === 'number' ? `${Math.round(entry.size / 1024)} KB` : '-',
    }));

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-dark-100 flex items-center gap-2">
          <FileText size={14} />
          File Tree
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="input-field text-xs w-36"
            placeholder="branch or ref"
          />
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-1 text-xs text-dark-200 hover:bg-dark-700"
          >
            Refresh
          </button>
        </div>
      </div>
      {isLoading && <p className="text-xs text-dark-500">Loading tree for {ref}…</p>}
      {isError && <p className="text-xs text-red-500">Failed to load file tree.</p>}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {topEntries.map((entry: any) => (
          <div key={`${entry.path}-${entry.sha ?? entry.url}`} className="flex items-center justify-between text-xs text-dark-300 border border-dark-800 rounded px-3 py-2">
            <div className="flex-1 min-w-0 truncate">
              <span className="font-mono text-dark-100">{entry.path}</span>
              <span className="ml-2 text-dark-500">{entry.type}</span>
            </div>
            <div className="text-dark-500">{entry.sizeLabel}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-dark-500">
        Showing {Math.min(topEntries.length, entries.length)} entries of {entries.length || '0'}. Use the full GitHub page if you need more.
      </p>
    </div>
  );
}
