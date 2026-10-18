const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 });
  await c.connect();

  // 1. Migration history
  const hist = await c.query("SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '2026091%'");
  console.log('=== MIGRATION HISTORY ===');
  console.log('count:', hist.rowCount);

  // 2. 36 candidates frozen - join with ordens_servico for components
  // os.adicionais is JSONB, os.ajudante is JSONB, os.pedagio is numeric, os.descontos is numeric
  const cands = await c.query(`
    SELECT 
      fp.id AS fp_id,
      fp.os_id,
      fp.status,
      fp.valor AS valor_atual,
      pp.id AS pp_id,
      pp.valor_liquido AS valor_proposto,
      ROUND((pp.valor_liquido - fp.valor)::numeric, 2) AS diferenca,
      COALESCE(os.pedagio, 0) AS os_pedagio,
      CASE WHEN os.adicionais IS NULL THEN 0
           WHEN jsonb_typeof(os.adicionais) = 'number' THEN (os.adicionais #>> '{}')::NUMERIC
           ELSE COALESCE((os.adicionais->>'valor')::NUMERIC, 0)
      END AS os_adicionais,
      CASE WHEN os.ajudante IS NULL THEN 0
           WHEN jsonb_typeof(os.ajudante) = 'number' THEN (os.ajudante #>> '{}')::NUMERIC
           ELSE COALESCE((os.ajudante->>'valor')::NUMERIC, 0)
      END AS os_ajudante,
      COALESCE(os.descontos, 0) AS os_descontos
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp 
      ON pp.os_id::TEXT = fp.os_id 
      AND pp.prestador_id = fp.fornecedor_id
    LEFT JOIN ordens_servico os ON os.id::TEXT = fp.os_id
    WHERE COALESCE(fp.status,'') NOT IN ('pago','paga','cancelado','cancelada','estornado')
      AND fp.os_id IS NOT NULL AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor,0)::numeric,2) <> ROUND(COALESCE(pp.valor_liquido,0)::numeric,2)
    ORDER BY fp.id
  `);
  console.log('\n=== 36 CANDIDATES ===');
  console.log('count:', cands.rowCount);

  // 3. Prove sums from the frozen set
  let sumAtual = 0, sumProposto = 0, sumDiferenca = 0;
  let explicados = 0, naoExplicados = 0;
  const ids = [];
  for (const r of cands.rows) {
    const atual = parseFloat(r.valor_atual);
    const proposto = parseFloat(r.valor_proposto);
    const dif = parseFloat(r.diferenca);
    const ped = parseFloat(r.os_pedagio);
    const adic = parseFloat(r.os_adicionais);
    sumAtual += atual;
    sumProposto += proposto;
    sumDiferenca += dif;
    ids.push(r.fp_id);

    // Explicability: diferenca == pedagio + adicionais (from ordens_servico)
    const explicacao = Math.abs(dif - (ped + adic)) < 0.01;
    if (explicacao) explicados++; else {
      naoExplicados++;
      console.log('  NAO EXPLICADO: ' + r.fp_id + ' dif=' + dif + ' ped+adic=' + (ped+adic) + ' ped=' + ped + ' adic=' + adic);
    }
  }

  console.log('\n=== SUMS FROM FROZEN SET ===');
  console.log('COUNT:', cands.rowCount);
  console.log('SUM_ATUAL:', sumAtual.toFixed(2));
  console.log('SUM_PROPOSTO:', sumProposto.toFixed(2));
  console.log('SUM_DIFERENCA:', sumDiferenca.toFixed(2));
  console.log('SUM_PROPOSTO - SUM_ATUAL:', (sumProposto - sumAtual).toFixed(2));

  console.log('\n=== EXPLICABILIDADE ===');
  console.log('EXPLICADOS:', explicados + '/' + cands.rowCount);
  console.log('NAO_EXPLICADOS:', naoExplicados + '/' + cands.rowCount);

  // 4. Terminais check
  const termCheck = await c.query(`
    SELECT fp.id, fp.status
    FROM financeiro_pagar fp
    WHERE fp.id = ANY($1::uuid[])
      AND COALESCE(fp.status, '') IN ('pago','paga','cancelado','cancelada','estornado')
  `, [ids]);
  console.log('\n=== TERMINAIS CHECK ===');
  console.log('candidatos que viraram terminal:', termCheck.rowCount);

  // 5. Baixas check
  const baixasCheck = await c.query(`
    SELECT fp.id, fp.status, COUNT(b.id) AS baixa_count
    FROM financeiro_pagar fp
    LEFT JOIN financeiro_baixas b ON b.titulo_id = fp.id AND b.titulo_tabela = 'financeiro_pagar'
    WHERE fp.id = ANY($1::uuid[])
    GROUP BY fp.id, fp.status
    HAVING COUNT(b.id) > 0
  `, [ids]);
  console.log('\n=== BAIXAS CHECK ===');
  console.log('candidatos com baixas:', baixasCheck.rowCount);
  for (const r of baixasCheck.rows) console.log('  ', r.id, r.status, 'baixas:', r.baixa_count);

  // 6. Pago-sin-baixa
  const pagoSinBaixa = await c.query(`
    SELECT fp.id, fp.os_id, fp.valor, fp.status
    FROM financeiro_pagar fp
    LEFT JOIN financeiro_baixas b ON b.titulo_id = fp.id AND b.titulo_tabela = 'financeiro_pagar'
    WHERE COALESCE(fp.status, '') IN ('pago','paga')
    GROUP BY fp.id, fp.os_id, fp.valor, fp.status
    HAVING COUNT(b.id) = 0
  `);
  console.log('\n=== PAGO SEM BAIXA ===');
  console.log('count:', pagoSinBaixa.rowCount);
  for (const r of pagoSinBaixa.rows) {
    const isInCandidates = ids.includes(r.id);
    console.log('  id:', r.id, 'os_id:', r.os_id, 'valor:', r.valor, 'in_candidates:', isInCandidates);
  }

  // 7. Triggers pre-check
  const triggers = await c.query(`
    SELECT t.tgname, c.relname AS table_name, p.proname AS func_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('alocacoes_escala','ordens_servico')
      AND t.tgname LIKE 'trg_%'
    ORDER BY c.relname, t.tgname
  `);
  console.log('\n=== TRIGGERS PRE-CHECK ===');
  for (const r of triggers.rows) console.log('  ', r.table_name, r.tgname, '->', r.func_name);

  // 8. RPC pre-check
  const rpc = await c.query(`
    SELECT p.proname, p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'f_confirmar_pagamento_fechamento'
  `);
  console.log('\n=== RPC PRE-CHECK ===');
  console.log('exists:', rpc.rowCount > 0);

  // 9. Snapshot table pre-check
  const snap = await c.query(`
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fin_sane_02b_snapshot') AS exists_flag
  `);
  console.log('\n=== SNAPSHOT TABLE PRE-CHECK ===');
  console.log('exists:', snap.rows[0].exists_flag);

  // 10. Candidate IDs ordered
  console.log('\n=== CANDIDATE IDS (ordered) ===');
  for (const id of ids) console.log(id);

  await c.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
