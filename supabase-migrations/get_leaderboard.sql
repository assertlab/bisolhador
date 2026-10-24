-- get_leaderboard: ranking "Mais analisados" (Bisolhômetro).
--
-- 2026-10: ordena por DIAS DISTINTOS com análise (fuso America/Recife, o mesmo
-- do permalink por data), não por linhas. Antes cada recarregamento contava 1:
-- assertlab/bisolhador liderava com 140 "análises", quase todas testes da
-- própria equipe numa mesma tarde. Agrupa sem diferenciar maiúsculas (como
-- get_repo_history) e mostra a grafia do registro mais recente.
--
-- Compatibilidade: as colunas antigas continuam, com o mesmo significado
-- (total_buscas = linhas); dias_analisados é nova, no fim. Clientes até a
-- v3.9.1 seguem funcionando e só passam a ver a nova ordem.
--
-- limit_count tem teto de 100 independente do que o client envie (e nunca
-- quebra em NULL). Rodar no SQL Editor do Supabase. Idempotente.
DROP FUNCTION IF EXISTS public.get_leaderboard(integer);

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 50)
 RETURNS TABLE(
   repo_name text,
   total_buscas bigint,
   last_analyzed_at timestamp with time zone,
   language text,
   stars bigint,
   health_score numeric,
   dias_analisados bigint
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH successful AS (
    SELECT LOWER(repo_name) AS repo_key, repo_name, created_at, language, stars, health_score
    FROM analytics_searches
    WHERE status = 'success' AND repo_name IS NOT NULL
  ),
  latest_snapshots AS (
    SELECT DISTINCT ON (repo_key) repo_key, repo_name, created_at, language, stars, health_score
    FROM successful
    ORDER BY repo_key, created_at DESC
  ),
  counts AS (
    SELECT
      repo_key,
      COUNT(*) AS total,
      COUNT(DISTINCT (created_at AT TIME ZONE 'America/Recife')::date) AS days
    FROM successful
    GROUP BY repo_key
  )
  SELECT
    l.repo_name, c.total AS total_buscas, l.created_at AS last_analyzed_at,
    l.language, l.stars, l.health_score, c.days AS dias_analisados
  FROM latest_snapshots l
  JOIN counts c ON l.repo_key = c.repo_key
  ORDER BY c.days DESC, l.created_at DESC
  -- COALESCE primeiro: um caller passando limit_count => null explicitamente
  -- (sobrescrevendo o DEFAULT 50) não pode resultar em LIMIT NULL (= sem limite).
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);
$function$;

COMMENT ON FUNCTION public.get_leaderboard(integer) IS
  'Repositórios mais analisados: dias distintos com análise (America/Recife), não linhas. Teto de 100.';

-- Esperado: exatamente UMA linha, public.get_leaderboard(integer).
SELECT oid::regprocedure AS deployed_signature FROM pg_proc WHERE proname = 'get_leaderboard';
