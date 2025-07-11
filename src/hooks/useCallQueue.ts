import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Lead {
  id: string;
  name: string;
  phones: string[];
  mobile?: string | null;
  direct?: string | null;
  company?: string | null;
  priority?: number | null;
  opportunity?: string;
  statut?: string;
  agent?: string;
  linkedin?: string;
}

export function useCallQueue(agent: string) {
  const queryClient = useQueryClient();

  const queue = useQuery<Lead[]>({
    queryKey: ['callQueue', agent],
    queryFn: async () => {
      const r = await fetch(`/api/queue?agent=${encodeURIComponent(agent)}`);
      if (!r.ok) throw new Error('Failed to load call queue');
      return (await r.json()) as Lead[];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      const r = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!r.ok) throw new Error('Failed to update status');
      return await r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callQueue', agent] });
    },
  });

  return {
    queue: queue.data ?? [],
    isLoading: queue.isLoading,
    markCalled: (id: string) => updateStatus.mutate({ id, status: 'Fait' }),
    markCallback: (id: string) => updateStatus.mutate({ id, status: 'Callback' }),
    isUpdating: updateStatus.isPending,
  };
}
