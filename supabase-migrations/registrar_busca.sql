-- 2. registrar_busca: rejeita payloads absurdamente grandes antes de inserir.
DROP FUNCTION IF EXISTS public.registrar_busca(text, text, text, bigint, bigint, bigint, bigint, numeric, timestamp with time zone, jsonb);

CREATE OR REPLACE FUNCTION public.registrar_busca(
  p_repo_name text, p_owner_type text, p_language text, p_stars bigint,
  p_forks bigint, p_issues bigint, p_subscribers bigint, p_health_score numeric,
  p_last_push_at timestamp with time zone, p_full_report jsonb DEFAULT NULL::jsonb
)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_id bigint;
begin
  if p_full_report is not null and octet_length(p_full_report::text) > 500000 then
    raise exception 'full_report payload excede o limite de 500KB';
  end if;

  if p_repo_name is null or length(p_repo_name) > 300 then
    raise exception 'repo_name é nulo ou excede o tamanho esperado';
  end if;

  insert into analytics_searches (
    repo_name, owner_type, language, stars, forks, issues, subscribers,
    health_score, last_push_at, full_report
  )
  values (
    p_repo_name, p_owner_type, p_language, p_stars, p_forks, p_issues, p_subscribers,
    p_health_score, p_last_push_at, p_full_report
  )
  returning id into new_id;

  return new_id;
end;
$function$;
