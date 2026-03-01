import { useQuery } from '@tanstack/react-query';
import { dockerAPI } from '@/api';
import type { DockerContainer, DockerImage } from '@/types';

export function useDockerContainers() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: dockerAPI.getContainers,
    refetchInterval: 5000,
  });

  const containers: DockerContainer[] = data?.data ?? [];
  const running = containers.filter((c) => c.status?.startsWith('Up'));
  const stopped = containers.filter((c) => !c.status?.startsWith('Up'));

  return {
    containers,
    running,
    stopped,
    isLoading,
    error,
    refetch,
    totalCount: containers.length,
  };
}

export function useDockerImages() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['docker-images'],
    queryFn: dockerAPI.getImages,
    refetchInterval: 60000,
  });

  const images: DockerImage[] = data?.data ?? [];

  return {
    images,
    isLoading,
    error,
    totalCount: images.length,
  };
}
