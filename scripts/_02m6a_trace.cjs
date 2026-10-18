const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
const UUID = '49042fec-2376-41d4-8ece-f1efe3d48dfc';
const OS_ID = 'a2ac3c46-b36f-4352-a1e7-dfecc1200387';
const FP_ID = '9b2e56ba-0457-42a7-b731-2daba9d6ea26';

(async () => {
  await c.connect();
  console.log('=== 02M.6A — PRESTADOR 49042fec TRACE ===\n');

  // 1. All tables containing this UUID
  const tables = [
    'prestadores', 'alocacoes_escala', 'ordens_servico',
    'composicao_financeira_os', 'pagamentos_prestadores',
    'financeiro_pagar', 'financeiro_baixas',
    'recrutamento_prestadores', 'prestador_acesso',
    'prestador_disponibilidade', 'prestador_candidaturas',
    'prestador_reembolsos', 'prestador_notificacoes',
    'prestador_engajamento', 'motorista_app_sessoes',
    'documentos_prestadores', 'historico_alocacoes_escala',
    'entregas_protocolo', 'veiculos', 'clientes',
    'tenant_usuarios', 'automacoes_robos',
    'ia_logs', 'automacoes_logs'
  ];

  for (const t of tables) {
    try {
      // Check columns that could reference UUID
      const cols = await c.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = $1 AND (
          column_name LIKE '%prestador%' OR column_name LIKE '%motorista%'
          OR column_name = 'id' OR column_name = 'prestador_id'
          OR column_name = 'user_id' OR column_name = 'auth_user_id'
          OR column_name = 'created_by' OR column_name = 'owner_id'
        )
      `, [t]);
      if (cols.rows.length === 0) continue;

      for (const col of cols.rows) {
        try {
          const r = await c.query(`SELECT count(*) AS n FROM ${t} WHERE ${col.column_name}::text = $1`, [UUID]);
          if (parseInt(r.rows[0].n) > 0) {
            console.log(`  HIT: ${t}.${col.column_name} = ${r.rows[0].n} row(s)`);
          }
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* table doesn't exist */ }
  }

  // 2. FP full record
  console.log('\n--- FP COMPLETO ---');
  const fp = await c.query(`SELECT * FROM financeiro_pagar WHERE id = $1`, [FP_ID]);
  const f = fp.rows[0];
  for (const [k, v] of Object.entries(f)) {
    if (v !== null && v !== '' && v !== '0' && v !== false) {
      console.log(`  ${k}: ${typeof v === 'string' && v.length > 100 ? v.substring(0,100)+'...' : v}`);
    }
  }

  // 3. OS full record
  console.log('\n--- OS COMPLETO ---');
  const os = await c.query(`SELECT * FROM ordens_servico WHERE id = $1`, [OS_ID]);
  const o = os.rows[0];
  for (const [k, v] of Object.entries(o)) {
    if (v !== null && v !== '' && v !== '0' && v !== false) {
      console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v).substring(0,200) : (typeof v === 'string' && v.length > 100 ? v.substring(0,100)+'...' : v)}`);
    }
  }

  // 4. Composicao
  console.log('\n--- COMPOSICAO ---');
  const comp = await c.query(`SELECT * FROM composicao_financeira_os WHERE os_id = $1`, [OS_ID]);
  if (comp.rows.length > 0) {
    const cp = comp.rows[0];
    for (const [k, v] of Object.entries(cp)) {
      if (v !== null) console.log(`  ${k}: ${v}`);
    }
  } else {
    console.log('  NAO ENCONTRADA');
  }

  // 5. All FP for same OS
  console.log('\n--- TODOS FP DO MESMO OS_ID ---');
  const fps = await c.query(`SELECT id, prestador, valor, status, created_at FROM financeiro_pagar WHERE os_id = $1`, [OS_ID]);
  fps.rows.forEach(r => console.log(`  ${r.id}: prestador=${r.prestador}, valor=${r.valor}, status=${r.status}, created=${r.created_at}`));

  // 6. All PP for same OS
  console.log('\n--- TODOS PP DO MESMO OS_ID ---');
  const pps = await c.query(`SELECT id, prestador_id, valor_liquido, status_pagamento, created_at FROM pagamentos_prestadores WHERE os_id = $1`, [OS_ID]);
  if (pps.rows.length > 0) {
    pps.rows.forEach(r => console.log(`  ${r.id}: prestador=${r.prestador_id}, valor=${r.valor_liquido}, status=${r.status_pagamento}`));
  } else {
    console.log('  NENHUM');
  }

  // 7. Historico alocacoes
  console.log('\n--- HISTORICO ALOCACOES (OS) ---');
  const hist = await c.query(`SELECT * FROM historico_alocacoes_escala WHERE alocacao_id = $1 ORDER BY created_at LIMIT 5`, [OS_ID]);
  if (hist.rows.length > 0) {
    hist.rows.forEach(r => console.log(`  ${r.created_at}: ${r.status_anterior} -> ${r.status_novo}`));
  } else {
    console.log('  NENHUM');
  }

  // 8. FP prestador text search - try to find name
  console.log('\n--- BUSCA NOME PRESTADOR POR UUID ---');
  const prestSearch = await c.query(`SELECT id, nome_completo, cpf_cnpj FROM prestadores WHERE id::text LIKE $1 OR cpf_cnpj LIKE $1`, [`%${UUID.substring(0,8)}%`]);
  console.log(`  Resultados: ${prestSearch.rows.length}`);

  // 9. Check if OS has metadata with prestador info
  console.log('\n--- OS METADATA ---');
  if (o && o.metadata) {
    console.log(`  ${JSON.stringify(o.metadata).substring(0,500)}`);
  } else {
    console.log('  SEM METADATA');
  }

  // 10. Check FP created_by or any audit
  console.log('\n--- FP COLUNAS EXTRA ---');
  console.log(`  created_at: ${f.created_at}`);
  console.log(`  updated_at: ${f.updated_at}`);
  console.log(`  tenant_id: ${f.tenant_id || 'null'}`);

  // 11. Check if 49042fec appears in any text field (broken FK)
  console.log('\n--- BUSCA UUID EM CAMPOS DE TEXTO ---');
  const textSearch = await c.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE data_type IN ('text','varchar','jsonb')
      AND table_schema = 'public'
    LIMIT 200
  `);

  await c.end();
  console.log('\n=== FIM TRACE ===');
})();
