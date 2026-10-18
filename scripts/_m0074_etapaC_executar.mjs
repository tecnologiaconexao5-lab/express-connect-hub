import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load DATABASE_URL from .env
const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) { console.error('DATABASE_URL not found in .env'); process.exit(1); }
const DATABASE_URL = match[1].replace(/^["']|["']$/g, '');

const SQL = `
DO $$
DECLARE
  v_rows INTEGER;
  v_os_status TEXT;
  v_fr_status TEXT;
  v_fp_status TEXT;
  v_pp_status TEXT;
  v_cf_count INTEGER;
  v_event_count INTEGER;
BEGIN

  -- ============================================================
  -- STEP 1: DELETE composicao_financeira_os (criada pela ETAPA A)
  -- ============================================================
  DELETE FROM composicao_financeira_os
  WHERE id = 'acfbf07e-5f03-4a8c-ab44-ccf4714b6e5a';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'ERRO STEP 1: DELETE composicao_financeira_os afetou % linhas (esperado 1)', v_rows;
  END IF;
  RAISE NOTICE 'STEP 1 OK: composicao_financeira_os removida (1 linha)';

  -- ============================================================
  -- STEP 2: UPDATE ordens_servico → pendente
  -- ============================================================
  UPDATE ordens_servico
  SET status = 'pendente',
      valor_prestador_calculado = 0,
      updated_at = NOW()
  WHERE id = '71e61468-af09-42e6-8d7e-e4624d9b1468';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'ERRO STEP 2: UPDATE ordens_servico afetou % linhas (esperado 1)', v_rows;
  END IF;
  RAISE NOTICE 'STEP 2 OK: ordens_servico atualizada (1 linha)';

  -- ============================================================
  -- STEP 3: Corrige financeiro_receber (M80b definiu como 'aberto')
  -- ============================================================
  UPDATE financeiro_receber
  SET status = 'pendente',
      updated_at = NOW()
  WHERE id = '200ecb02-c91e-48e1-9dc8-ff73f99e0227';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'ERRO STEP 3: UPDATE financeiro_receber afetou % linhas (esperado 1)', v_rows;
  END IF;
  RAISE NOTICE 'STEP 3 OK: financeiro_receber atualizado (1 linha)';

  -- ============================================================
  -- STEP 4: Corrige financeiro_pagar (M80b definiu como 'aberto')
  -- ============================================================
  UPDATE financeiro_pagar
  SET status = 'pendente',
      updated_at = NOW()
  WHERE id = '208bc3cb-8e9f-48dc-88c1-67b3a54cdd28';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'ERRO STEP 4: UPDATE financeiro_pagar afetou % linhas (esperado 1)', v_rows;
  END IF;
  RAISE NOTICE 'STEP 4 OK: financeiro_pagar atualizado (1 linha)';

  -- ============================================================
  -- STEP 5: Touch pagamentos_prestadores (atualiza timestamp)
  -- ============================================================
  UPDATE pagamentos_prestadores
  SET updated_at = NOW()
  WHERE id = '7178a5ca-050b-4854-974d-8a3c70ea0d22';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows != 1 THEN
    RAISE EXCEPTION 'ERRO STEP 5: UPDATE pagamentos_prestadores afetou % linhas (esperado 1)', v_rows;
  END IF;
  RAISE NOTICE 'STEP 5 OK: pagamentos_prestadores atualizado (1 linha)';

  -- ============================================================
  -- VALIDAÇÃO FINAL
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '=== INICIO DAS VALIDACOES POS-RESTAURACAO ===';

  -- VAL 1A: OS.status = pendente
  SELECT status INTO v_os_status
  FROM ordens_servico WHERE id = '71e61468-af09-42e6-8d7e-e4624d9b1468';
  IF v_os_status != 'pendente' THEN
    RAISE EXCEPTION 'VAL 1A: OS.status = % (esperado pendente)', v_os_status;
  END IF;
  RAISE NOTICE 'VAL 1A OK: OS.status = pendente';

  -- VAL 1B: custo_prestador = 1500
  IF (SELECT custo_prestador FROM ordens_servico WHERE id = '71e61468-af09-42e6-8d7e-e4624d9b1468') != 1500 THEN
    RAISE EXCEPTION 'VAL 1B: custo_prestador alterado';
  END IF;
  RAISE NOTICE 'VAL 1B OK: custo_prestador = 1500';

  -- VAL 1C: valor_cliente = 3000
  IF (SELECT valor_cliente FROM ordens_servico WHERE id = '71e61468-af09-42e6-8d7e-e4624d9b1468') != 3000 THEN
    RAISE EXCEPTION 'VAL 1C: valor_cliente alterado';
  END IF;
  RAISE NOTICE 'VAL 1C OK: valor_cliente = 3000';

  -- VAL 1D: cliente_id
  IF (SELECT cliente_id FROM ordens_servico WHERE id = '71e61468-af09-42e6-8d7e-e4624d9b1468') != '04280785-4004-42c3-a406-886dd0730a8d' THEN
    RAISE EXCEPTION 'VAL 1D: cliente_id alterado';
  END IF;
  -- VAL 1E: prestador_id
  IF (SELECT prestador_id FROM ordens_servico WHERE id = '71e61468-af09-42e6-8d7e-e4624d9b1468') != '6cc41f68-1467-455d-b8d5-c61bfe72cb7c' THEN
    RAISE EXCEPTION 'VAL 1E: prestador_id alterado';
  END IF;
  RAISE NOTICE 'VAL 1D+1E OK: cliente_id e prestador_id preservados';

  -- VAL 2A: FR.status = pendente
  SELECT status INTO v_fr_status
  FROM financeiro_receber WHERE id = '200ecb02-c91e-48e1-9dc8-ff73f99e0227';
  IF v_fr_status != 'pendente' THEN
    RAISE EXCEPTION 'VAL 2A: FR.status = % (esperado pendente)', v_fr_status;
  END IF;
  RAISE NOTICE 'VAL 2A OK: FR.status = pendente';

  -- VAL 2B: FR.valor = 3000
  IF (SELECT valor FROM financeiro_receber WHERE id = '200ecb02-c91e-48e1-9dc8-ff73f99e0227') != 3000 THEN
    RAISE EXCEPTION 'VAL 2B: FR.valor alterado';
  END IF;
  RAISE NOTICE 'VAL 2B OK: FR.valor = 3000';

  -- VAL 3A: FP.status = pendente
  SELECT status INTO v_fp_status
  FROM financeiro_pagar WHERE id = '208bc3cb-8e9f-48dc-88c1-67b3a54cdd28';
  IF v_fp_status != 'pendente' THEN
    RAISE EXCEPTION 'VAL 3A: FP.status = % (esperado pendente)', v_fp_status;
  END IF;
  RAISE NOTICE 'VAL 3A OK: FP.status = pendente';

  -- VAL 3B: FP.valor = 1500
  IF (SELECT valor FROM financeiro_pagar WHERE id = '208bc3cb-8e9f-48dc-88c1-67b3a54cdd28') != 1500 THEN
    RAISE EXCEPTION 'VAL 3B: FP.valor alterado';
  END IF;
  RAISE NOTICE 'VAL 3B OK: FP.valor = 1500';

  -- VAL 4A: PP.status_pagamento
  SELECT status_pagamento INTO v_pp_status
  FROM pagamentos_prestadores WHERE id = '7178a5ca-050b-4854-974d-8a3c70ea0d22';
  IF v_pp_status != 'pendente' THEN
    RAISE EXCEPTION 'VAL 4A: PP.status_pagamento = % (esperado pendente)', v_pp_status;
  END IF;
  RAISE NOTICE 'VAL 4A OK: PP.status_pagamento = pendente';

  -- VAL 4B: PP.status_conferencia
  IF (SELECT status_conferencia FROM pagamentos_prestadores WHERE id = '7178a5ca-050b-4854-974d-8a3c70ea0d22') != 'em_aberto' THEN
    RAISE EXCEPTION 'VAL 4B: PP.status_conferencia alterado';
  END IF;
  RAISE NOTICE 'VAL 4B OK: PP.status_conferencia = em_aberto';

  -- VAL 4C: PP.valor_liquido = 1750
  IF (SELECT valor_liquido FROM pagamentos_prestadores WHERE id = '7178a5ca-050b-4854-974d-8a3c70ea0d22') != 1750 THEN
    RAISE EXCEPTION 'VAL 4C: PP.valor_liquido alterado';
  END IF;
  RAISE NOTICE 'VAL 4C OK: PP.valor_liquido = 1750';

  -- VAL 5: composicao_financeira_os = 0
  SELECT COUNT(*) INTO v_cf_count FROM composicao_financeira_os
  WHERE os_id = '71e61468-af09-42e6-8d7e-e4624d9b1468';
  IF v_cf_count != 0 THEN
    RAISE EXCEPTION 'VAL 5: composicao tem % registros (esperado 0)', v_cf_count;
  END IF;
  RAISE NOTICE 'VAL 5 OK: composicao_financeira_os = 0';

  -- VAL 6A: evento finalizada preservado
  SELECT COUNT(*) INTO v_event_count FROM eventos_oficiais
  WHERE entity_id = '71e61468-af09-42e6-8d7e-e4624d9b1468'
    AND event_type = 'os.ordem_servico.finalizada';
  IF v_event_count != 1 THEN
    RAISE EXCEPTION 'VAL 6A: evento finalizada = % (esperado 1)', v_event_count;
  END IF;
  RAISE NOTICE 'VAL 6A OK: 1 evento os.ordem_servico.finalizada preservado';

  -- VAL 6B: status_changed criado
  SELECT COUNT(*) INTO v_event_count FROM eventos_oficiais
  WHERE entity_id = '71e61468-af09-42e6-8d7e-e4624d9b1468'
    AND event_type = 'os.ordem_servico.status_changed'
    AND payload->>'status_anterior' = 'finalizada'
    AND payload->>'status_novo' = 'pendente';
  IF v_event_count != 1 THEN
    RAISE EXCEPTION 'VAL 6B: evento status_changed = % (esperado 1)', v_event_count;
  END IF;
  RAISE NOTICE 'VAL 6B OK: 1 evento os.ordem_servico.status_changed criado';

  -- VAL 6C: total = 2 (sem duplicatas)
  SELECT COUNT(*) INTO v_event_count FROM eventos_oficiais
  WHERE entity_id = '71e61468-af09-42e6-8d7e-e4624d9b1468';
  IF v_event_count != 2 THEN
    RAISE EXCEPTION 'VAL 6C: total eventos = % (esperado 2)', v_event_count;
  END IF;
  RAISE NOTICE 'VAL 6C OK: total = 2 eventos (sem duplicatas)';

  -- ============================================================
  -- TUDO OK
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '  TMS-007.4 ETAPA C — RESTAURACAO CONCLUIDA COM SUCESSO';
  RAISE NOTICE '  TODAS AS 16 VALIDACOES PASSARAM';
  RAISE NOTICE '============================================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '  ERRO: %', SQLERRM;
    RAISE NOTICE '  REALIZANDO ROLLBACK...';
    RAISE NOTICE '============================================================';
    RAISE;
END;
$$;
`;

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.on('notice', (msg) => {
    console.log(msg.message);
  });

  try {
    await client.connect();
    console.log('Conectado ao Supabase via DATABASE_URL.');
    console.log('Executando restauracao...');
    console.log('');

    await client.query(SQL);

    console.log('');
    console.log('SQL executado com sucesso. Nenhuma excecao foi lancada.');
    console.log('Todas as validacoes passaram, DO block concluido.');
  } catch (err) {
    console.error('');
    console.error('ERRO durante execucao:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
