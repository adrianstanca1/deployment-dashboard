import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Github, Star, GitFork, ExternalLink, Search, Clock, GitBranch,
  GitCommit, AlertCircle, GitPullRequest, Tag, Zap, CheckCircle,
  XCircle, Loader2, RefreshCw, Copy, Download, Rocket, ChevronRight,
  Lock, Eye, FileText, Circle, Plus, Play, GitMerge, Sync
} from 'lucide-react';
import { githubAPI } from '@/api';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime, getLanguageColor } from '@/utils';
import type {
  GitHubRepo, GitHubCommit, GitHubBranch, GitHubIssue,
  GitHubPR, GitHubRelease, GitHubWorkflowRun
} from '@/types';
import {
  CreateBranchModal, TriggerWorkflowModal, CreateIssueModal,
  CreatePRModal, SyncForkModal, QuickActionsBar, CommitActivityChart
} from '@/components/GitHubEnhanced';

// ... (keeping helper functions from original file)
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function WorkflowBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === 'in_progress') return <span className="flex items-center gap-1 text-yellow-400"><Loader2 size={11} className="animate-spin" /> In progress</span>;
  if (status === 'queued') return <span className="flex items-center gap-1 text-blue-400"><Circle size={11} /> Queued</span>;
  if (conclusion === 'success') return <span className="flex items-center gap-1 text-green-400"><CheckCircle size={11} /> Success</span>;
  if (conclusion === 'failure') return <span className="flex items-center gap-1 text-red-400"><XCircle size={11} /> Failed</span>;
  if (conclusion === 'cancelled') return <span className="flex items-center gap-1 text-dark-500"><XCircle size={11} /> Cancelled</span>;
  if (conclusion === 'skipped') return <span className="flex items-center gap-1 text-dark-500">Skipped</span>;
  return <span className="text-dark-500">{conclusion || status}</span>;
}

type DetailTab = 'overview' | 'commits' | 'branches' | 'issues' | 'pulls' | 'releases' | 'actions';
type ModalType = 'branch' | 'workflow' | 'issue' | 'pr' | 'sync' | null;

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-dark-800 bg-dark-900 py-3 px-2 text-center">
      <Icon size={14} className="text-dark-500 mx-auto mb-1" />
      <div className="text-lg font-bold text-dark-100">{value}</div>
      <div className="text-xs text-dark-500">{label}</div>
    </div>
  );
}

function LoadingState() {
  return <div className="text-dark-500 text-sm py-8 text-center"><Loader2 size={16} className="animate-spin mx-auto mb-2" />Loading…</div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-dark-600 text-sm py-8 text-center">{message}</div>;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-red-400 text-sm">
      <AlertCircle size={14} />
      {message}
    </div>
  );
}

function IssueRow({ item, href }: { item: GitHubIssue; href: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-dark-800 last:border-0">
      <AlertCircle size={14} className={`shrink-0 mt-0.5 ${item.state === 'open' ? 'text-green-400' : 'text-dark-600'}`} />
      <div className="flex-1 min-w-0">
        <a href={href} target="_blank" rel="noreferrer" className="text-sm text-dark-100 hover:text-primary-400 font-medium">
          {item.title}
        </a>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-dark-500">#{item.number} by {item.user.login} · {formatRelativeTime(item.created_at)}</span>
          {item.labels?.map(l => (
            <span key={l.name} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `#${l.color}25`, color: `#${l.color}`, border: `1px solid #${l.color}50` }}>
              {l.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main Repo Detail Component with Enhanced Actions
function RepoDetail({ repo }: { repo: GitHubRepo }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notify } = useNotifications();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<DetailTab>>(new Set(['overview']));
  const [issueState, setIssueState] = useState<'open' | 'closed'>('open');
  const [prState, setPrState] = useState<'open' | 'closed'>('open');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const visitTab = (t: DetailTab) => {
    setActiveTab(t);
    setVisitedTabs(prev => new Set([...prev, t]));
  };

  // Data queries
  const { data: commitsData, isLoading: commitsLoading, error: commitsError } = useQuery({
    queryKey: ['github-commits', repo.name],
    queryFn: () => githubAPI.getCommits(repo.name),
    enabled: visitedTabs.has('commits'),
    staleTime: 2 * 60 * 1000,
  });

  const { data: branchesData, isLoading: branchesLoading, error: branchesError } = useQuery({
    queryKey: ['github-branches', repo.name],
    queryFn: () => githubAPI.getBranches(repo.name),
    enabled: visitedTabs.has('branches'),
    staleTime: 2 * 60 * 1000,
  });

  const { data: issuesData, isLoading: issuesLoading, error: issuesError } = useQuery({
    queryKey: ['github-issues', repo.name, issueState],
    queryFn: () => githubAPI.getIssues(repo.name, issueState),
    enabled: visitedTabs.has('issues'),
    staleTime: 2 * 60 * 1000,
  });

  const { data: pullsData, isLoading: pullsLoading, error: pullsError } = useQuery({
    queryKey: ['github-pulls', repo.name, prState],
    queryFn: () => githubAPI.getPulls(repo.name, prState),
    enabled: visitedTabs.has('pulls'),
    staleTime: 2 * 60 * 1000,
  });

  const { data: releasesData, isLoading: releasesLoading, error: releasesError } = useQuery({
    queryKey: ['github-releases', repo.name],
    queryFn: () => githubAPI.getReleases(repo.name),
    enabled: visitedTabs.has('releases'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: actionsData, isLoading: actionsLoading, error: actionsError } = useQuery({
    queryKey: ['github-actions', repo.name],
    queryFn: () => githubAPI.getActions(repo.name),
    enabled: visitedTabs.has('actions'),
    staleTime: 60 * 1000,
  });

  const { data: readmeData, isLoading: readmeLoading, error: readmeError } = useQuery({
    queryKey: ['github-readme', repo.name],
    queryFn: () => githubAPI.getReadme(repo.name),
    enabled: visitedTabs.has('overview'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: localStatusData, refetch: refetchLocal } = useQuery({
    queryKey: ['github-local-status', repo.name],
    queryFn: () => githubAPI.getLocalStatus(repo.name),
    staleTime: 30 * 1000,
  });

  const { data: activityData } = useQuery({
    queryKey: ['github-commit-activity', repo.name],
    queryFn: () => githubAPI.getCommitActivity(repo.name),
    enabled: visitedTabs.has('overview'),
    staleTime: 5 * 60 * 1000,
  });

  const pullLocalMut = useMutation({
    mutationFn: () => githubAPI.pullLocal(repo.name),
    onSuccess: () => {
      refetchLocal();
      notify({ type: 'success', title: 'Pull successful', message: 'Local repository updated' });
    },
    onError: (err: any) => {
      notify({ type: 'error', title: 'Git pull failed', message: err?.response?.data?.error || err.message });
    },
  });

  const commits = commitsData?.data ?? [];
  const branches = branchesData?.data ?? [];
  const issues = (issuesData?.data ?? []).filter((i: GitHubIssue) => !i.pull_request);
  const pulls = pullsData?.data ?? [];
  const releases = releasesData?.data ?? [];
  const actions = actionsData?.data ?? [];
  const readme = readmeData?.data ?? '';
  const localStatus = localStatusData?.data;
  const activity = activityData?.data ?? [];

  const tabs: Array<{ id: DetailTab; label: string; icon: React.ElementType; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'commits', label: 'Commits', icon: GitCommit, count: commits.length || undefined },
    { id: 'branches', label: 'Branches', icon: GitBranch, count: branches.length || undefined },
    { id: 'issues', label: 'Issues', icon: AlertCircle },
    { id: 'pulls', label: 'PRs', icon: GitPullRequest },
    { id: 'releases', label: 'Releases', icon: Tag },
    { id: 'actions', label: 'Actions', icon: Zap },
  ];

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['github', repo.name] });
    refetchLocal();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Quick Actions Bar */}
      <QuickActionsBar
        repo={repo}
        localStatus={localStatus}
        onRefresh={refreshAll}
        onCreateBranch={() => setActiveModal('branch')}
        onTriggerWorkflow={() => setActiveModal('workflow')}
        onCreateIssue={() => setActiveModal('issue')}
        onCreatePR={() => setActiveModal('pr')}
        onSyncFork={repo.fork ? () => setActiveModal('sync') : undefined}
        onPullLocal={() => pullLocalMut.mutate()}
        onDeploy={() => navigate(`/deploy?repo=${repo.name}`)}
      />

      {/* Tab bar */}
      <div className="flex border-b border-dark-700 px-2 shrink-0 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => visitTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'text-dark-100 border-b-2 border-primary-400'
                : 'text-dark-500 hover:text-dark-300'
            }`}
          >
            <t.icon size={11} />
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1 bg-dark-700 text-dark-400 px-1.5 py-0.5 rounded-full text-xs">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <MetricCard label="Stars" value={String(repo.stargazers_count)} icon={Star} />
              <MetricCard label="Forks" value={String(repo.forks_count)} icon={GitFork} />
              <MetricCard label="Size" value={`${(repo.size / 1024).toFixed(1)} MB`} icon={FileText} />
            </div>
            
            {activity && activity.length > 0 && (
              <CommitActivityChart data={activity} />
            )}
            
            {readmeLoading && <div className="text-dark-500 text-sm text-center py-4">Loading README…</div>}
            {readmeError && <ErrorState message="Failed to load README" />}
            {!readmeLoading && !readmeError && readme && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-xs text-dark-500 font-medium uppercase tracking-wider">
                  <FileText size={11} /> README
                </div>
                <pre className="text-xs text-dark-300 bg-dark-950 border border-dark-800 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {readme}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Commits */}
        {activeTab === 'commits' && (
          <div className="space-y-2">
            {commitsLoading && <LoadingState />}
            {commitsError && <ErrorState message="Failed to load commits" />}
            {!commitsLoading && !commitsError && commits.map((commit: GitHubCommit) => (
              <div key={commit.sha} className="flex items-start gap-3 py-3 border-b border-dark-800 last:border-0">
                <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center shrink-0 mt-0.5">
                  <GitCommit size={12} className="text-dark-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark-100 leading-snug line-clamp-2">
                    {commit.message?.split('\n')[0]}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-dark-500">
                    <span className="font-medium text-dark-400">{commit.author?.name}</span>
                    <span className="font-mono text-dark-600">{commit.sha?.slice(0, 7)}</span>
                    <span>{formatRelativeTime(commit.author?.date)}</span>
                  </div>
                </div>
                <a
                  href={commit.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 p-1 text-dark-600 hover:text-dark-300"
                >
                  <ExternalLink size={11} />
                </a>
              </div>
            ))}
            {!commitsLoading && !commitsError && commits.length === 0 && <EmptyState message="No commits found" />}
          </div>
        )}

        {/* Branches */}
        {activeTab === 'branches' && (
          <div className="space-y-2">
            {branchesLoading && <LoadingState />}
            {branchesError && <ErrorState message="Failed to load branches" />}
            {!branchesLoading && !branchesError && branches.map((branch: GitHubBranch) => (
              <div key={branch.name} className="flex items-center gap-3 py-2.5 border-b border-dark-800 last:border-0">
                <GitBranch size={13} className="text-primary-400 shrink-0" />
                <span className={`font-mono text-sm flex-1 ${branch.name === repo.default_branch ? 'text-dark-100 font-semibold' : 'text-dark-300'}`}>
                  {branch.name}
                </span>
                {branch.name === repo.default_branch && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary-600/20 text-primary-400">default</span>
                )}
                {branch.protected && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500">protected</span>
                )}
                <span className="font-mono text-xs text-dark-600">{branch.commit?.sha?.slice(0, 7)}</span>
              </div>
            ))}
            {!branchesLoading && !branchesError && branches.length === 0 && <EmptyState message="No branches" />}
          </div>
        )}

        {/* Issues */}
        {activeTab === 'issues' && (
          <div className="space-y-1">
            <div className="flex gap-2 mb-3">
              {(['open', 'closed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setIssueState(s)}
                  className={`text-xs px-3 py-1 rounded-lg ${issueState === s ? 'bg-dark-700 text-dark-100' : 'text-dark-500 hover:text-dark-300'}`}
                >
                  {s === 'open' ? <><AlertCircle size={11} className="inline mr-1" />Open</> : 'Closed'}
                </button>
              ))}
            </div>
            {issuesLoading && <LoadingState />}
            {issuesError && <ErrorState message="Failed to load issues" />}
            {!issuesLoading && !issuesError && issues.map((issue: GitHubIssue) => (
              <IssueRow key={issue.id} item={issue} href={issue.html_url} />
            ))}
            {!issuesLoading && !issuesError && issues.length === 0 && <EmptyState message={`No ${issueState} issues`} />}
          </div>
        )}

        {/* Pull Requests */}
        {activeTab === 'pulls' && (
          <div className="space-y-1">
            <div className="flex gap-2 mb-3">
              {(['open', 'closed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setPrState(s)}
                  className={`text-xs px-3 py-1 rounded-lg ${prState === s ? 'bg-dark-700 text-dark-100' : 'text-dark-500 hover:text-dark-300'}`}
                >
                  {s === 'open' ? <><GitPullRequest size={11} className="inline mr-1" />Open</> : 'Closed'}
                </button>
              ))}
            </div>
            {pullsLoading && <LoadingState />}
            {pullsError && <ErrorState message="Failed to load pull requests" />}
            {!pullsLoading && !pullsError && pulls.map((pr: GitHubPR) => (
              <div key={pr.id} className="flex items-start gap-3 py-3 border-b border-dark-800 last:border-0">
                <GitPullRequest size={14} className={pr.state === 'open' ? 'text-green-400 shrink-0 mt-0.5' : 'text-purple-400 shrink-0 mt-0.5'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={pr.html_url} target="_blank" rel="noreferrer" className="text-sm text-dark-100 hover:text-primary-400 font-medium">
                      {pr.title}
                    </a>
                    {pr.draft && <span className="text-xs px-1.5 py-0.5 bg-dark-700 text-dark-500 rounded">Draft</span>}
                  </div>
                  <div className="text-xs text-dark-500 mt-1 flex items-center gap-2">
                    <span>#{pr.number}</span>
                    <span className="font-mono">{pr.head?.ref} → {pr.base?.ref}</span>
                    <span>by {pr.user?.login}</span>
                    <span>{formatRelativeTime(pr.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
            {!pullsLoading && !pullsError && pulls.length === 0 && <EmptyState message={`No ${prState} PRs`} />}
          </div>
        )}

        {/* Releases */}
        {activeTab === 'releases' && (
          <div className="space-y-3">
            {releasesLoading && <LoadingState />}
            {releasesError && <ErrorState message="Failed to load releases" />}
            {!releasesLoading && !releasesError && releases.map((r: GitHubRelease) => (
              <div key={r.id} className="rounded-xl border border-dark-700 bg-dark-900 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Tag size={13} className="text-primary-400" />
                      <span className="font-mono text-sm font-semibold text-dark-100">{r.tag_name}</span>
                      {r.prerelease && <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">Pre-release</span>}
                      {r.draft && <span className="text-xs px-1.5 py-0.5 bg-dark-700 text-dark-500 rounded">Draft</span>}
                    </div>
                    {r.name && r.name !== r.tag_name && (
                      <div className="text-sm text-dark-300 mt-0.5">{r.name}</div>
                    )}
                  </div>
                  <div className="text-xs text-dark-500 shrink-0">{formatRelativeTime(r.published_at)}</div>
                </div>
                {r.body && (
                  <pre className="text-xs text-dark-400 whitespace-pre-wrap bg-dark-950 rounded-lg p-3 mt-2 max-h-32 overflow-y-auto">
                    {r.body.slice(0, 400)}{r.body.length > 400 ? '…' : ''}
                  </pre>
                )}
                {r.assets && r.assets.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {r.assets.map(a => (
                      <div key={a.name} className="flex items-center justify-between text-xs text-dark-500">
                        <a href={a.browser_download_url} target="_blank" rel="noreferrer" className="hover:text-primary-400 flex items-center gap-1">
                          <Download size={10} /> {a.name}
                        </a>
                        <span>{a.download_count} downloads · {(a.size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!releasesLoading && !releasesError && releases.length === 0 && <EmptyState message="No releases" />}
          </div>
        )}

        {/* Actions */}
        {activeTab === 'actions' && (
          <div className="space-y-2">
            {actionsLoading && <LoadingState />}
            {actionsError && <ErrorState message="Failed to load workflow runs" />}
            {!actionsLoading && !actionsError && actions.map((run: GitHubWorkflowRun) => (
              <div key={run.id} className="flex items-center gap-3 py-3 border-b border-dark-800 last:border-0">
                <div className="w-5 shrink-0">
                  <WorkflowBadge status={run.status} conclusion={run.conclusion} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-dark-100 truncate">{run.display_title || run.name}</div>
                  <div className="text-xs text-dark-500 mt-0.5 flex items-center gap-2">
                    <span className="font-mono">{run.head_branch}</span>
                    <span>{run.event}</span>
                    <span>{formatRelativeTime(run.created_at)}</span>
                  </div>
                </div>
                <a href={run.html_url} target="_blank" rel="noreferrer" className="p-1 text-dark-600 hover:text-dark-300 shrink-0">
                  <ExternalLink size={11} />
                </a>
              </div>
            ))}
            {!actionsLoading && !actionsError && actions.length === 0 && <EmptyState message="No workflow runs" />}
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal === 'branch' && (
        <CreateBranchModal repo={repo} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'workflow' && (
        <TriggerWorkflowModal repo={repo} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'issue' && (
        <CreateIssueModal repo={repo} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'pr' && (
        <CreatePRModal repo={repo} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'sync' && (
        <SyncForkModal repo={repo} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}

// Main GitHub Page Component (same as original but with enhanced features)
export default function GitHubPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [sortBy, setSortBy] = useState<'pushed' | 'stars' | 'name'>('pushed');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['github-repos'],
    queryFn: githubAPI.getRepos,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  const repos = data?.data ?? [];
  const githubUsername = repos[0]?.owner?.login ?? null;

  const filtered = repos
    .filter(r => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase());
      const matchVis = visibilityFilter === 'all' || r.visibility === visibilityFilter;
      return matchSearch && matchVis;
    })
    .sort((a, b) => {
      if (sortBy === 'stars') return b.stargazers_count - a.stargazers_count;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
    });

  const publicCount = repos.filter(r => r.visibility === 'public').length;
  const privateCount = repos.filter(r => r.visibility === 'private').length;

  return (
    <div className="flex h-full">
      {/* Left panel: repo list */}
      <div className={`flex flex-col border-r border-dark-700 bg-dark-950 transition-all ${selectedRepo ? 'w-72 shrink-0' : 'flex-1'}`}>
        <div className="px-4 py-4 border-b border-dark-700 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github size={16} className="text-dark-300" />
              <span className="font-semibold text-dark-100 text-sm">Repositories</span>
              <span className="text-xs text-dark-500">{repos.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={githubUsername ? `https://github.com/${githubUsername}` : '#'}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-dark-500 hover:text-dark-200 hover:bg-dark-800 rounded"
              >
                <ExternalLink size={12} />
              </a>
              <button onClick={() => refetch()} className="p-1.5 text-dark-500 hover:text-dark-200 hover:bg-dark-800 rounded">
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Filter repositories…"
              className="input-field pl-8 text-xs py-1.5 w-full"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'public', 'private'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVisibilityFilter(v)}
                className={`text-xs px-2 py-0.5 rounded ${visibilityFilter === v ? 'bg-dark-700 text-dark-100' : 'text-dark-600 hover:text-dark-400'}`}
              >
                {v} {v === 'public' ? publicCount : v === 'private' ? privateCount : ''}
              </button>
            ))}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="ml-auto text-xs bg-transparent text-dark-500 border-0 cursor-pointer"
            >
              <option value="pushed">Recent</option>
              <option value="stars">Stars</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-dark-500">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading…
            </div>
          )}
          {error && <div className="px-4 py-8 text-center text-red-400 text-sm">Failed to load repositories</div>}

          {filtered.map(repo => (
            <button
              key={repo.id}
              onClick={() => setSelectedRepo(selectedRepo?.id === repo.id ? null : repo)}
              className={`w-full text-left px-4 py-3 border-b border-dark-800/50 hover:bg-dark-800/40 transition-colors ${
                selectedRepo?.id === repo.id ? 'bg-dark-800 border-l-2 border-l-primary-400' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-primary-400 truncate">{repo.name}</span>
                    {repo.visibility === 'private' && <Lock size={9} className="text-yellow-600 shrink-0" />}
                    {repo.fork && <GitFork size={9} className="text-dark-500 shrink-0" />}
                  </div>
                  {repo.description && !selectedRepo && (
                    <p className="text-xs text-dark-500 mt-0.5 line-clamp-1">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-dark-600">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${getLanguageColor(repo.language)}`} />
                        {!selectedRepo && repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && (
                      <span className="flex items-center gap-0.5"><Star size={9} /> {repo.stargazers_count}</span>
                    )}
                    <span className="ml-auto">{formatRelativeTime(repo.pushed_at)}</span>
                  </div>
                </div>
                <ChevronRight size={12} className={`shrink-0 mt-0.5 text-dark-600 transition-transform ${selectedRepo?.id === repo.id ? 'rotate-90' : ''}`} />
              </div>
            </button>
          ))}

          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-dark-600 text-sm">No repositories found</div>
          )}
        </div>
      </div>

      {/* Right panel: repo detail */}
      {selectedRepo ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <RepoDetail repo={selectedRepo} />
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center flex-col gap-3 text-dark-600">
          <Github size={40} className="opacity-20" />
          <p className="text-sm">Select a repository to view details</p>
        </div>
      )}
    </div>
  );
}