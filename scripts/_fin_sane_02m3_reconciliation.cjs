const { Client } = require('pg');
const DATABASE_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    await client.connect();
    console.log('Conectado — SOMENTE LEITURA\n');

    // ═══════════════════════════════════════════════════════════════════
    // 1. PAGOS SEM BAIXA
    // ═══════════════════════════════════════════════════════════════════
    console.log('═══ 1. PAGOS SEM BAIXA ═══');
    const q1 = await client.query(`
      SELECT fp.id, fp.valor, fp.status, fp.descricao, fp.data_pagamento
      FROM financeiro_pagar fp
      WHERE fp.status = 'pago'
      AND NOT EXISTS (
        SELECT 1 FROM financeiro_baixas bx
        WHERE bx.titulo_tabela = 'financeiro_pagar' AND bx.titulo_id = fp.id
      )
      ORDER BY fp.created_at
    `);
    const total = q1.rows.length;
    const teste = q1.rows.filter(r => (r.descricao||'').toUpperCase().includes('TESTE')).length;
    const real = total - teste;
    console.log('TOTAL:', total);
    console.log('REAL:', real);
    console.log('TESTE:', teste);
    q1.rows.forEach(r => console.log('  -', r.id.slice(0,8), 'R$', r.valor, (r.descricao||'').slice(0,40)));
    console.log('Esperado: 0/0/0 →', total===0 && real===0 && teste===0 ? 'PASS' : 'DIVERGENTE');

    // ═══════════════════════════════════════════════════════════════════
    // 2. BAIXAS ÓRFÃS
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══ 2. BAIXAS ÓRFÃS ═══');
    const q2 = await client.query(`
      SELECT bx.id, bx.titulo_id, bx.valor_baixado, bx.created_at
      FROM financeiro_baixas bx
      WHERE bx.titulo_tabela = 'financeiro_pagar'
      AND NOT EXISTS (
        SELECT 1 FROM financeiro_pagar fp WHERE fp.id = bx.titulo_id
      )
    `);
    console.log('QTD:', q2.rows.length);
    q2.rows.forEach(r => console.log('  -', r.id.slice(0,8), 'titulo:', r.titulo_id.slice(0,8), 'R$', r.valor_baixado));

    // ═══════════════════════════════════════════════════════════════════
    // 3. DUPLICIDADE
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══ 3. DUPLICIDADE ═══');

    // financeiro_pagar — duplicatas por os_id (quando não nulo)
    const q3a = await client.query(`
      SELECT os_id, COUNT(*) as cnt
      FROM financeiro_pagar WHERE os_id IS NOT NULL
      GROUP BY os_id HAVING COUNT(*) > 1
    `);
    console.log('FP duplicatas por os_id:', q3a.rows.length);
    q3a.rows.forEach(r => console.log('  - os_id:', r.os_id?.slice(0,8), 'count:', r.cnt));

    // pagamentos_prestadores — duplicatas por os_id
    const q3b = await client.query(`
      SELECT os_id, COUNT(*) as cnt
      FROM pagamentos_prestadores WHERE os_id IS NOT NULL
      GROUP BY os_id HAVING COUNT(*) > 1
    `);
    console.log('PP duplicatas por os_id:', q3b.rows.length);
    q3b.rows.forEach(r => console.log('  - os_id:', r.os_id?.slice(0,8), 'count:', r.cnt));

    // financeiro_receber — duplicatas por os_id
    const q3c = await client.query(`
      SELECT os_id, COUNT(*) as cnt
      FROM financeiro_receber WHERE os_id IS NOT NULL
      GROUP BY os_id HAVING COUNT(*) > 1
    `);
    console.log('FR duplicatas por os_id:', q3c.rows.length);
    q3c.rows.forEach(r => console.log('  - os_id:', r.os_id?.slice(0,8), 'count:', r.cnt));

    // composicao_financeira_os — duplicatas por os_id
    const q3d = await client.query(`
      SELECT os_id, COUNT(*) as cnt
      FROM composicao_financeira_os WHERE os_id IS NOT NULL
      GROUP BY os_id HAVING COUNT(*) > 1
    `);
    console.log('CFO duplicatas por os_id:', q3d.rows.length);
    q3d.rows.forEach(r => console.log('  - os_id:', r.os_id?.slice(0,8), 'count:', r.cnt));

    // ═══════════════════════════════════════════════════════════════════
    // 4. 36 REGISTROS DO 02K
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══ 4. 36 REGISTROS DO 02K ═══');
    // Check total financeiro_pagar count and sum
    const q4a = await client.query(`SELECT COUNT(*) as cnt, COALESCE(SUM(valor),0) as total FROM financeiro_pagar`);
    console.log('FP total registros:', q4a.rows[0].cnt);
    console.log('FP soma total: R$', Number(q4a.rows[0].total).toFixed(2));

    // Check FP+PP match (os_id based) — os_id pode ser uuid ou text
    const q4b = await client.query(`
      SELECT fp.id, fp.valor as fp_valor, fp.status as fp_status, fp.os_id,
             pp.valor_liquido as pp_valor, pp.status_pagamento as pp_status
      FROM financeiro_pagar fp
      LEFT JOIN pagamentos_prestadores pp ON pp.os_id::text = fp.os_id::text
      WHERE fp.os_id IS NOT NULL
      ORDER BY fp.created_at
    `);
    console.log('FP com PP vinculado (por os_id):', q4b.rows.length);
    let matchCount = 0;
    let mismatchCount = 0;
    q4b.rows.forEach(r => {
      if (r.pp_valor !== null) {
        const fpV = Number(r.fp_valor);
        const ppV = Number(r.pp_valor);
        if (Math.abs(fpV - ppV) < 0.01) matchCount++;
        else { mismatchCount++; console.log('  MISMATCH:', r.id.slice(0,8), 'FP=R$', fpV, 'PP=R$', ppV); }
      }
    });
    console.log('FP=PP match:', matchCount, '/ mismatch:', mismatchCount);

    // Nenhuma baixa indevida nesses 36 (baixas in financeiro_baixas for these)
    const q4c = await client.query(`
      SELECT bx.id, bx.titulo_id, bx.valor_baixado
      FROM financeiro_baixas bx
      WHERE bx.titulo_tabela = 'financeiro_pagar'
    `);
    console.log('Baixas em financeiro_pagar (total):', q4c.rows.length);
    q4c.rows.forEach(r => console.log('  -', r.id.slice(0,8), 'titulo:', r.titulo_id.slice(0,8), 'R$', r.valor_baixado));

    // ═══════════════════════════════════════════════════════════════════
    // 5. FECHAMENTO TEST-02L
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══ 5. FECHAMENTO TEST-02L ═══');
    const FECH_ID = '3884e3c0-74ab-435f-b67d-55a6c6c4f938';
    const q5a = await client.query(`
      SELECT id, valor_liquido, status_pagamento, status, data_pagamento, prestador_id, prestador_nome, created_at, fechamento_id
      FROM pagamentos_prestadores WHERE id = $1
    `, [FECH_ID]);
    if (q5a.rows.length === 0) {
      console.log('FECHAMENTO NÃO ENCONTRADO');
    } else {
      const f = q5a.rows[0];
      console.log('status_pagamento:', f.status_pagamento);
      console.log('status:', f.status);
      console.log('valor_liquido:', f.valor_liquido);
      console.log('data_pagamento:', f.data_pagamento);
      console.log('prestador_id:', f.prestador_id);
      console.log('created_at:', f.created_at);

      // Check FP vinculado — tentar por os_id e fornecedor_id
      let q5b;
      if (f.os_id) {
        q5b = await client.query(`
          SELECT fp.id, fp.valor, fp.status
          FROM financeiro_pagar fp
          WHERE fp.os_id::text = $1::text
          LIMIT 5
        `, [f.os_id]);
      } else if (f.prestador_id) {
        q5b = await client.query(`
          SELECT fp.id, fp.valor, fp.status
          FROM financeiro_pagar fp
          WHERE fp.fornecedor_id::text = $1::text
          LIMIT 5
        `, [f.prestador_id]);
      } else {
        q5b = { rows: [] };
      }
      console.log('FP vinculados:', q5b.rows.length);
      q5b.rows.forEach(r => console.log('  -', r.id.slice(0,8), 'R$', r.valor, 'status:', r.status));

      // Check baixa
      const q5c = await client.query(`
        SELECT id, valor_baixado, data_baixa
        FROM financeiro_baixas
        WHERE titulo_tabela = 'financeiro_pagar' AND titulo_id = $1
      `, [FECH_ID]);
      console.log('Baixas FP:', q5c.rows.length);
      q5c.rows.forEach(r => console.log('  -', r.id.slice(0,8), 'R$', r.valor_baixado));
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. SANEAMENTO 02M.2
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══ 6. SANEAMENTO 02M.2 ═══');
    const TARGET = 'f83a3249-acf4-49cb-8ddb-21ddbfe77a4b';
    const q6 = await client.query(`
      SELECT id, valor, status, data_pagamento, updated_at
      FROM financeiro_pagar WHERE id = $1
    `, [TARGET]);
    if (q6.rows.length === 0) {
      console.log('ALVO NÃO ENCONTRADO');
    } else {
      const t = q6.rows[0];
      console.log('status:', t.status, t.status === 'cancelado' ? 'PASS' : 'DIVERGENTE');
      console.log('valor:', t.valor, Number(t.valor) === 137.89 ? 'PASS' : 'DIVERGENTE');
      console.log('data_pagamento:', t.data_pagamento);
      console.log('updated_at:', t.updated_at);
      // Baixas
      const q6b = await client.query(`
        SELECT COUNT(*) as cnt FROM financeiro_baixas
        WHERE titulo_tabela = 'financeiro_pagar' AND titulo_id = $1
      `, [TARGET]);
      console.log('baixas:', q6b.rows[0].cnt, Number(q6b.rows[0].cnt) === 0 ? 'PASS' : 'DIVERGENTE');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. M66/M80/NOTIFICAÇÃO
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══ 8. M66/M80/NOTIFICAÇÃO ═══');
    const q8a = await client.query(`
      SELECT tgname, tgrelid::regclass, tgtype, tgenabled
      FROM pg_trigger WHERE NOT tgisinternal
      AND tgrelid::regclass::text IN (
        'alocacoes_escala', 'ordens_servico', 'financeiro_pagar'
      )
      ORDER BY tgrelid, tgname
    `);
    console.log('Triggers em tabelas-chave:');
    q8a.rows.forEach(r => console.log('  -', r.tgname, 'ON', r.tgrelid, 'enabled:', r.tgenabled));

    // Check specific functions
    const q8b = await client.query(`
      SELECT proname, provolatile, proconfig
      FROM pg_proc WHERE proname IN (
        'f_trg_propagar_financeiro_alocacao',
        'f_trg_propagar_financeiro_os',
        'f_trg_notificar_os_para_app'
      )
      ORDER BY proname
    `);
    console.log('Funções de trigger:');
    q8b.rows.forEach(r => console.log('  -', r.proname, 'volatility:', r.provolatile));

    // ═══════════════════════════════════════════════════════════════════
    // 9. MIGRATION HISTORY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n═══ 9. MIGRATION HISTORY ═══');
    const q9 = await client.query(`
      SELECT version, name, statements, success
      FROM schema_migrations
      WHERE version LIKE '%02K%' OR version LIKE '%02L%' OR version LIKE '%02M%'
         OR version LIKE '%m80%' OR version LIKE '%m66%'
      ORDER BY version DESC
      LIMIT 10
    `);
    console.log('Migrations relevantes:');
    q9.rows.forEach(r => console.log('  -', r.version, r.name?.slice(0,60), 'ok:', r.success));

    // Total migrations
    const q9b = await client.query(`SELECT COUNT(*) as cnt FROM schema_migrations WHERE applied = true`);
    console.log('Total migrations aplicadas:', q9b.rows[0].cnt);

    console.log('\n═══ FIM DAS CONSULTAS ═══');
  } catch (err) {
    console.error('ERRO:', err.message);
  } finally {
    await client.end();
  }
})();
