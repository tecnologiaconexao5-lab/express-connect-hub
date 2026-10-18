DO $$
DECLARE
  v_new RECORD;
BEGIN
  v_new := ROW(
    'aaaaaaaa-1111-1111-1111-111111111111'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    '55555555-5555-5555-5555-555555555555'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    NULL::uuid,
    NULL::uuid,
    CURRENT_DATE,
    'diurno'::text,
    'van'::text,
    NULL::text,
    NULL::text,
    NULL::text,
    'SP'::text,
    'Campinas'::text,
    'pendente'::text,
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::timestamptz,
    0::numeric,
    0::numeric,
    500::numeric,
    400::numeric,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    '{}'::jsonb,
    NOW(),
    NOW(),
    false,
    NULL::timestamptz,
    NULL::text[]
  );

  BEGIN
    PERFORM f_trg_propagar_financeiro_alocacao();
    RAISE NOTICE 'FUNCTION CALLED OK';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FUNCTION ERROR: %', SQLERRM;
  END;
END;
$$;
