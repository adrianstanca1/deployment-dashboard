import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Play, GitBranch, Plus, AlertCircle, CheckCircle, XCircle, Loader2,
  Zap, GitMerge, FileText, RefreshCw, ExternalLink, X
} from 'lucide-react';
import { githubAPI } from '@/api';
import { useNotifications } from '@/hooks/useNotifications';

interface Props {
  repo: { name: string; default_branch: string };
  onClose: () => void;
}

export function CreateBranchModal({ repo, onClose }: Props) {
  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState(repo.default_branch);
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const { data: branches } = useQuery({
    queryKey: ['github-branches', repo.name],
    queryFn: () => githubAPI.getBranches(repo.name),
  });

  const mutation = useMutation({
    mutationFn: () => githubAPI.createBranch(repo.name, branchName, baseBranch),
    onSuccess: () => {
      notify({ type: 'success', title: `Branch '${branchName}' created` });
      qc.invalidateQueries({ queryKey: ['github-branches', repo.name] });
      onClose();
    },
    onError: (err: Error) => {
      notify({ type: 'error', title: 'Failed to create branch', message: err.message });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
            <GitBranch size={18} /> Create Branch
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-800 rounded">
            <X size={16} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Branch Name</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feature/my-new-feature"
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Base Branch</label>
            <select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="input-field w-full"
            >
              {branches?.data?.map((b: any) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!branchName || mutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TriggerWorkflowModal({ repo, onClose }: Props) {
  const [workflowId, setWorkflowId] = useState('');
  const [branch, setBranch] = useState(repo.default_branch);
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['github-workflows', repo.name],
    queryFn: () => githubAPI.getWorkflows(repo.name),
  });

  const mutation = useMutation({
    mutationFn: () => githubAPI.triggerWorkflow(repo.name, workflowId, branch),
    onSuccess: () => {
      notify({ type: 'success', title: `Workflow triggered on ${branch}` });
      qc.invalidateQueries({ queryKey: ['github-actions', repo.name] });
      onClose();
    },
    onError: (err: Error) => {
      notify({ type: 'error', title: 'Failed to trigger workflow', message: err.message });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
            <Zap size={18} className="text-yellow-400" /> Trigger Workflow
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-800 rounded">
            <X size={16} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-dark-500">
              <Loader2 size={20} className="animate-spin mx-auto" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Workflow</label>
                <select
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Select a workflow...</option>
                  {workflows?.data?.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-dark-400 mb-1">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="input-field w-full"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={!workflowId || mutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
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

export function CreateIssueModal({ repo, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [labels, setLabels] = useState('');
  const { notify } = useNotifications();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => githubAPI.createIssue(repo.name, title, body, labels.split(',').map(l => l.trim()).filter(Boolean)),
    onSuccess: (data) => {
      notify({ type: 'success', title: `Issue #${data.data.issueNumber} created` });
      qc.invalidateQueries({ queryKey: ['github-issues', repo.name] });
      onClose();
    },
    onError: (err: Error) => {
      notify({ type: 'error', title: 'Failed to create issue', message: err.message });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
            <AlertCircle size={18} className="text-green-400" /> Create Issue
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-800 rounded">
            <X size={16} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
              className="input-field w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Description</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
              className="input-field w-full resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Labels (comma-separated)</label>
            <input
              type="text"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="bug, enhancement"
              className="input-field w-full"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!title || mutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Create Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreatePRModal({ repo, onClose }: Props) {
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
    mutationFn: () => githubAPI.createPR(repo.name, title, head, base, body),
    onSuccess: (data) => {
      notify({ type: 'success', title: `PR #${data.data.prNumber} created` });
      qc.invalidateQueries({ queryKey: ['github-pulls', repo.name] });
      onClose();
    },
    onError: (err: Error) => {
      notify({ type: 'error', title: 'Failed to create PR', message: err.message });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
            <GitMerge size={18} className="text-purple-400" /> Create Pull Request
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-800 rounded">
            <X size={16} className="text-dark-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="PR title"
              className="input-field w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-dark-400 mb-1">From (head)</label>
              <select
                value={head}
                onChange={(e) => setHead(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Select branch...</option>
                {branches?.data?.map((b: any) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-dark-400 mb-1">Into (base)</label>
              <select
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="input-field w-full"
              >
                {branches?.data?.map((b: any) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Description</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your changes..."
              rows={4}
              className="input-field w-full resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!title || !head || mutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
              Create PR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
