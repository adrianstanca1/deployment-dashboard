import { useQuery } from '@tanstack/react-query';
import { githubAPI } from '@/api';
import type { GitHubRepo, GitHubCommit, GitHubBranch } from '@/types';

export function useGitHubRepos() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['github-repos'],
    queryFn: githubAPI.getRepos,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const repos: GitHubRepo[] = data?.data ?? [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentlyPushed = repos.filter((repo) => {
    const pushedAt = new Date(repo.pushed_at);
    return pushedAt > sevenDaysAgo;
  });

  return {
    repos,
    recentlyPushed,
    isLoading,
    error,
    refetch,
    totalCount: repos.length,
  };
}

export function useGitHubCommits(repo: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['github-commits', repo],
    queryFn: () => githubAPI.getCommits(repo),
    enabled: !!repo,
    staleTime: 10000,
  });

  const commits: GitHubCommit[] = data?.data ?? [];

  return { commits, isLoading, error };
}

export function useGitHubBranches(repo: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['github-branches', repo],
    queryFn: () => githubAPI.getBranches(repo),
    enabled: !!repo,
  });

  const branches: GitHubBranch[] = data?.data ?? [];

  return { branches, isLoading, error };
}
