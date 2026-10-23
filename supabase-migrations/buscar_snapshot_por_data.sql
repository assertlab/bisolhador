-- Migration: versionar e corrigir buscar_snapshot_por_data (permalink ?repo=&date=)
-- Data: 2026-10-23
--
-- Por quê: a versão implantada (o SQL nunca esteve no repositório) devolvia
-- null para qualquer entrada, inclusive dias com 16 snapshots — o permalink
-- semântico estava quebrado. Mesmo padrão das outras RPCs públicas:
-- SECURITY DEFINER (a tabela tem RLS sem policies; ver AGENTS.md), search_path
-- fixo e DROP antes do CREATE para não deixar uma sobrecarga antiga coexistindo.
--
-- Semântica: o snapshot MAIS RECENTE registrado até o fim do dia p_date, no
-- fuso fixo America/Recife — o mesmo link mostra o mesmo registro para
-- qualquer pessoa, em qualquer fuso (antes o fuso vinha do navegador). Dia sem
-- registro cai no anterior mais próximo; o app mostra a data real do registro.
-- p_timezone é aceito e IGNORADO, só para compatibilidade: clientes até a
-- v3.8.0 ainda o enviam, e sem ele o PostgREST não encontraria a função.
--
-- Mesmo formato de retorno de obter_snapshot (um objeto JSON, ou null).
-- Rodar no SQL Editor do Supabase. Idempotente.

DROP FUNCTION IF EXISTS public.buscar_snapshot_por_data(text, date, text);
DROP FUNCTION IF EXISTS public.buscar_snapshot_por_data(text, text, text);
DROP FUNCTION IF EXISTS public.buscar_snapshot_por_data(text, date);
DROP FUNCTION IF EXISTS public.buscar_snapshot_por_data(text, text);

CREATE OR REPLACE FUNCTION public.buscar_snapshot_por_data(
  p_repo_name text,
  p_date date,
  p_timezone text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(s)
  FROM (
    SELECT id, full_report, repo_name, created_at, stars, health_score, owner_type, last_push_at
    FROM analytics_searches
    WHERE p_repo_name IS NOT NULL
      AND length(p_repo_name) <= 300
      AND p_date IS NOT NULL
      AND LOWER(repo_name) = LOWER(p_repo_name)
      AND created_at < ((p_date + 1)::timestamp AT TIME ZONE 'America/Recife')
    ORDER BY created_at DESC
    LIMIT 1
  ) s;
$$;

COMMENT ON FUNCTION public.buscar_snapshot_por_data(text, date, text) IS
  'Snapshot mais recente de um repositório até o fim de p_date (fuso fixo America/Recife; p_timezone ignorado, só compatibilidade). Mesmo formato de obter_snapshot.';
