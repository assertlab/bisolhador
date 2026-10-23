-- One-off data cleanup from docs/AUDITORIA_INDICADORES_2026-10.md (§2).
-- Run once in the Supabase SQL editor (service role). NOT a schema migration.
--
-- Fail-closed: everything runs in one transaction, and each DELETE must hit
-- exactly the expected number of rows (verified on 2026-10-23 via the public
-- read RPCs). Any mismatch raises an exception and rolls back everything, so
-- nothing is deleted unless the data is exactly what the audit found.
--
-- Extra guards per row: mocks must have a "Mocked..." description, degraded
-- rows must have health_score = 14.
--
-- First run (2026-10-23) aborted on the mocks guard with "got 0": the
-- description lives inside a double-encoded full_report (fixed below).

BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  -- §2.1 — 30 mocked test snapshots (manual/lag measurement scripts, Jul 29-30)
  DELETE FROM analytics_searches
  WHERE id IN (
    1013, 1014, 1015, 1016, 1017, 1018, 1027, 1031, 1035, 1039, 1043, 1047, -- facebook/react
    1029, 1030, 1033, 1034, 1037, 1038, 1041, 1042, 1045, 1049,             -- angular/angular
    1028, 1032, 1036, 1040, 1044, 1048,                                     -- vuejs/vue
    1046, 1050                                                              -- sveltejs/svelte
  )
  -- full_report is stored as a JSON *string* inside jsonb (double-encoded), so
  -- full_report->>'description' is NULL; #>> '{}' unwraps it (works for objects too).
  AND (full_report #>> '{}')::jsonb ->> 'description' ILIKE 'Mocked%';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 30 THEN
    RAISE EXCEPTION 'mocks: expected 30 rows, got % — aborting, nothing deleted', n;
  END IF;

  -- §2.2 — 6 degraded snapshots (community profile fetch failed → health 14)
  DELETE FROM analytics_searches
  WHERE id IN (1001, 1024, 1064, 1117, 1163, 407)
  AND health_score = 14;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 6 THEN
    RAISE EXCEPTION 'degraded: expected 6 rows, got % — aborting, nothing deleted', n;
  END IF;

  -- §2.3 — repos that are now private (2) or return 404 (5): 20 rows
  DELETE FROM analytics_searches
  WHERE LOWER(repo_name) IN (
    'ddevdan/future-grid',
    'marcellobressan/future-grid',
    'caioagrelli/mp-sipat',
    'lucasgrander/bcc3004-ic3a_sphere_server',
    'lucasgrander/bcc3004-ic3a_sphere_web',
    'felipeevgomes/adaptwrite-frontend',
    'felipeevgomes/adaptwrite-backend'
  );
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 20 THEN
    RAISE EXCEPTION 'private/404 repos: expected 20 rows, got % — aborting, nothing deleted', n;
  END IF;

  RAISE NOTICE 'OK: 56 rows deleted (30 mocks, 6 degraded, 20 private/404)';
END $$;

COMMIT;
