-- Migration: Criar função RPC para buscar histórico de evolução de repositório
-- Feature: Time Machine v3.0
-- Data: 2026-02-12

-- Remove função se já existir
DROP FUNCTION IF EXISTS get_repo_history(text);

-- Cria função para buscar histórico de repositório
CREATE OR REPLACE FUNCTION get_repo_history(p_repo_name text)
RETURNS TABLE (
  id bigint,
  created_at timestamp with time zone,
  full_report jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Retorna todos os registros do repositório ordenados cronologicamente
  RETURN QUERY
  SELECT
    analytics_searches.id,
    analytics_searches.created_at,
    analytics_searches.full_report
  FROM analytics_searches
  WHERE LOWER(analytics_searches.repo_name) = LOWER(p_repo_name)
  ORDER BY analytics_searches.created_at ASC;
END;
$$;

-- Comentário da função
COMMENT ON FUNCTION get_repo_history(text) IS 'Busca histórico completo de análises de um repositório ordenado por data de criação';
