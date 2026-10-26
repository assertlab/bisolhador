import { useQuery } from '@tanstack/react-query';
import analytics from '../services/analytics.js';
import { createMockRepoData, parseFullReport } from '../utils/snapshotAdapter.js';
import { normalizeSnapshotProcessMetrics } from '../utils/prReviewStats.js';
import { normalizeSnapshotContributors } from '../utils/contributors.js';
import { normalizeSnapshotActivity } from '../utils/activityStats.js';
import { normalizeSnapshotPractices } from '../utils/projectPractices.js';
import { normalizeSnapshotAiProcess } from '../utils/aiProcess.js';
import { CACHE_STALE_TIME_MS } from '../constants.js';

// Converte o registro do Supabase no formato que o Dashboard renderiza:
// full_report (JSON completo) quando existe, senão um mock a partir das colunas.
function toRepoData(snapshotResult) {
  const report = parseFullReport(snapshotResult.full_report, 'useSnapshot');
  const data = report ? normalizeSnapshotAiProcess(normalizeSnapshotPractices(normalizeSnapshotActivity(normalizeSnapshotContributors(normalizeSnapshotProcessMetrics(report))))) : createMockRepoData(snapshotResult);

  if (typeof data === 'object') {
    data.analysisDate = snapshotResult.created_at || new Date().toISOString();
  }

  return data;
}

async function fetchSnapshot({ id, repo, date }) {
  const snapshotResult = id
    ? await analytics.getSnapshot(Number(id))
    : await analytics.getSnapshotByDate(repo, date);

  // Lança em vez de retornar null: o TanStack cachearia null como sucesso
  // (com staleTime Infinity para ?id=), e uma falha momentânea do Supabase
  // ficaria presa até o garbage collection. Erro é refeito ao revisitar a URL.
  // getSnapshot/getSnapshotByDate retornam null tanto para "não existe" quanto para falha de rede.
  if (!snapshotResult) {
    const message = id
      ? `Snapshot ${id} não encontrado`
      : `Nenhum registro encontrado para ${repo} em ${date}`;
    console.error('[useSnapshot] Erro ao carregar snapshot:', message);
    throw new Error(message);
  }

  return toRepoData(snapshotResult);
}

// Lê da URL qual snapshot exibir. `?id=` (permalink imutável) tem prioridade
// sobre `?repo=&date=` (busca semântica); null quando a URL não é de snapshot.
export function getSnapshotParams(searchParams) {
  const id = searchParams.get('id');
  if (id) return { id };
  const repo = searchParams.get('repo');
  const date = searchParams.get('date');
  return repo && date ? { repo, date } : null;
}

const VALID_SNAPSHOT_ID = /^\d+$/;

export function useSnapshot(params) {
  const invalidId = Boolean(params?.id) && !VALID_SNAPSHOT_ID.test(params.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['snapshot', params],
    queryFn: () => fetchSnapshot(params),
    enabled: Boolean(params) && !invalidId,
    // Snapshot por id nunca muda; por data pode ganhar registro novo no mesmo dia.
    staleTime: params?.id ? Infinity : CACHE_STALE_TIME_MS,
    retry: false,
  });

  return {
    data: data ?? null,
    loading: isLoading, // v5: false when the query is disabled
    failed: invalidId || Boolean(error),
  };
}
