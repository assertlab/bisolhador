import { useQuery } from '@tanstack/react-query';
import analytics from '../services/analytics.js';
import { createMockRepoData } from '../utils/snapshotAdapter.js';
import { CACHE_STALE_TIME_MS } from '../constants.js';

// Converte o registro do Supabase no formato que o Dashboard renderiza:
// full_report (JSON completo) quando existe, senão um mock a partir das colunas.
function toRepoData(snapshotResult) {
  let data = null;

  if (snapshotResult.full_report) {
    try {
      data = typeof snapshotResult.full_report === 'string'
        ? JSON.parse(snapshotResult.full_report)
        : snapshotResult.full_report;
    } catch (e) {
      console.error('[useSnapshot] Erro fatal ao decodificar JSON:', e);
    }
  }

  if (!data) {
    data = createMockRepoData(snapshotResult);
  }

  if (data && typeof data === 'object') {
    data.analysisDate = snapshotResult.created_at || new Date().toISOString();
  }

  return data;
}

async function fetchSnapshot({ id, repo, date }) {
  const snapshotResult = id
    ? await analytics.getSnapshot(parseInt(id))
    : await analytics.getSnapshotByDate(repo, date);

  if (!snapshotResult) {
    console.error(id
      ? 'Erro ao carregar snapshot: Snapshot não encontrado'
      : `Erro ao carregar snapshot por data: Nenhum registro encontrado para ${repo} em ${date}`);
    return null;
  }

  return toRepoData(snapshotResult);
}

// Snapshot histórico identificado pela URL: `?id=` (permalink imutável) tem
// prioridade sobre `?repo=&date=` (busca semântica). Sem nenhum dos dois, não busca.
export function useSnapshot({ id, repo, date }) {
  const params = id ? { id } : { repo, date };
  const enabled = Boolean(id || (repo && date));

  const { data, isLoading } = useQuery({
    queryKey: ['snapshot', params],
    queryFn: () => fetchSnapshot(params),
    enabled,
    // Snapshot por id nunca muda; por data pode ganhar registro novo no mesmo dia.
    staleTime: id ? Infinity : CACHE_STALE_TIME_MS,
    retry: false,
  });

  return { data: data ?? null, loading: enabled && isLoading };
}
