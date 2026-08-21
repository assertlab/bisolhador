-- 1. get_leaderboard: limita o máximo que qualquer chamador pode pedir,
--    independente do que o client envie (e nunca quebra em NULL).
DROP FUNCTION IF EXISTS public.get_leaderboard(integer);

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 50)
 RETURNS TABLE(repo_name text, total_buscas bigint, last_analyzed_at timestamp with time zone, language text, stars bigint, health_score numeric)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH latest_snapshots AS (
    SELECT DISTINCT ON (repo_name)
      repo_name, created_at, language, stars, health_score
    FROM analytics_searches
    WHERE status = 'success'
    ORDER BY repo_name, created_at DESC
  ),
  search_counts AS (
    SELECT repo_name, COUNT(*) as total
    FROM analytics_searches
    WHERE status = 'success'
    GROUP BY repo_name
  )
  SELECT
    l.repo_name, c.total as total_buscas, l.created_at as last_analyzed_at,
    l.language, l.stars, l.health_score
  FROM latest_snapshots l
  JOIN search_counts c ON l.repo_name = c.repo_name
  ORDER BY c.total DESC, l.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);  -- NULL vira default 50; nunca menos que 1, nunca mais que 100
$function$;
