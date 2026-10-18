const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
const UUID_FP = '49042fec-2376-41d4-8ece-f1efe3d48dfc';
const UUID_OS = 'f9b37431-0b9b-4ff6-a5e1-d1b581a926c0';
const OS_ID = 'a2ac3c46-b36f-4352-a1e7-dfecc1200387';

(async () => {
  await c.connect();

  // 1. Does OS prestador_id exist?
  console.log('--- PRESTADOR DA OS (f9b37431) ---');
  const p1 = await c.query(`SELECT id, nome_completo, cpf_cnpj FROM prestadores WHERE id = $1`, [UUID_OS]);
  console.log(p1.rows.length ? JSON.stringify(p1.rows[0]) : 'NAO EXISTE');

  // 2. Search for 49042fec in prestadores history or any other table
  console.log('\n--- 49042fec EM PRESTADORES (qualquer coluna) ---');
  const p2 = await c.query(`SELECT id, nome_completo, cpf_cnpj, created_at FROM prestadores WHERE id::text = $1 OR cpf_cnpj = $1`, [UUID_FP]);
  console.log(p2.rows.length ? JSON.stringify(p2.rows[0]) : 'NAO EXISTE EM PRESTADORES');

  // 3. Check if 49042fec was ever used as prestador_id elsewhere
  console.log('\n--- 49042fec EM COMPOSICAO (detalhes) ---');
  const comp = await c.query(`SELECT id, os_id, prestador_id, valor_prestador, cliente_id, created_at, origem_calculo FROM composicao_financeira_os WHERE prestador_id::text = $1`, [UUID_FP]);
  comp.rows.forEach(r => console.log(`  ${r.id}: os=${r.os_id}, valor=${r.valor_prestador}, origem=${r.origem_calculo}, created=${r.created_at}`));

  // 4. Check all FP with this prestador UUID
  console.log('\n--- TODOS FP COM PRESTADOR 49042fec ---');
  const fps = await c.query(`SELECT id, os_id, valor, status, descricao, is_teste, created_at FROM financeiro_pagar WHERE prestador = $1`, [UUID_FP]);
  fps.rows.forEach(r => console.log(`  ${r.id}: os=${r.os_id}, valor=${r.valor}, status=${r.status}, teste=${r.is_teste}, desc=${r.descricao}`));

  // 5. Check if 49042fec appears in any other table via text search
  console.log('\n--- 49042fec EM QUERIES DIVERSAS ---');
  const q1 = await c.query(`SELECT 'alocacoes_escala' AS t, id FROM alocacoes_escala WHERE prestador_id::text = $1 UNION ALL SELECT 'veiculos', id FROM veiculos WHERE prestador_vinculado::text = $1`, [UUID_FP]);
  q1.rows.forEach(r => console.log(`  ${r.t}: ${r.id}`));

  // 6. Check FP.is_teste and FP.descricao more carefully
  console.log('\n--- ANALISE FP TESTE ---');
  const fp = await c.query(`SELECT id, descricao, is_teste, tipo_documento, conta_pagadora, despesa_fixa_base, valor_bruto, valor_liquido FROM financeiro_pagar WHERE id = $1`, ['9b2e56ba-0457-42a7-b731-2daba9d6ea26']);
  const f = fp.rows[0];
  console.log(`  is_teste: ${f.is_teste}`);
  console.log(`  descricao: ${f.descricao}`);
  console.log(`  tipo_documento: ${f.tipo_documento}`);
  console.log(`  conta_pagadora: ${f.conta_pagadora}`);
  console.log(`  despesa_fixa_base: ${f.despesa_fixa_base}`);
  console.log(`  valor_bruto: ${f.valor_bruto}`);
  console.log(`  valor_liquido: ${f.valor_liquido}`);

  // 7. Check who created this OS - was it from UI or test?
  console.log('\n--- OS CRIACAO ---');
  const os = await c.query(`SELECT id, numero, prestador_id, cliente_id, created_at, faturamento_status, repasse_status FROM ordens_servico WHERE id = $1`, [OS_ID]);
  console.log(`  numero: ${os.rows[0].numero}`);
  console.log(`  prestador_id: ${os.rows[0].prestador_id}`);
  console.log(`  cliente_id: ${os.rows[0].cliente_id}`);
  console.log(`  faturamento_status: ${os.rows[0].faturamento_status}`);
  console.log(`  repasse_status: ${os.rows[0].repasse_status}`);

  // 8. Check OS prestador_id f9b37431
  console.log('\n--- PRESTADOR f9b37431 (DA OS) ---');
  const p3 = await c.query(`SELECT id, nome_completo, cpf_cnpj, created_at FROM prestadores WHERE id = $1`, [UUID_OS]);
  console.log(p3.rows.length ? JSON.stringify(p3.rows[0]) : 'NAO EXISTE');

  // 9. Check all OS with prestador_id = f9b37431
  console.log('\n--- TODAS OS COM PRESTADOR f9b37431 ---');
  const osList = await c.query(`SELECT id, numero, status, prestador_id, created_at FROM ordens_servico WHERE prestador_id = $1`, [UUID_OS]);
  osList.rows.forEach(r => console.log(`  ${r.numero}: status=${r.status}, created=${r.created_at}`));

  // 10. Check all composicoes with prestador_id = 49042fec
  console.log('\n--- TODAS COMPOSICOES COM PRESTADOR 49042fec ---');
  const compList = await c.query(`SELECT id, os_id, prestador_id, valor_prestador, origem_calculo, created_at FROM composicao_financeira_os WHERE prestador_id::text = $1`, [UUID_FP]);
  compList.rows.forEach(r => console.log(`  ${r.id}: os=${r.os_id}, valor=${r.valor_prestador}, origem=${r.origem_calculo}, created=${r.created_at}`));

  // 11. Check if there's a PP for OS prestador_id f9b37431
  console.log('\n--- PP COM PRESTADOR f9b37431 ---');
  const ppList = await c.query(`SELECT id, os_id, prestador_id, valor_liquido, status_pagamento FROM pagamentos_prestadores WHERE prestador_id = $1`, [UUID_OS]);
  ppList.rows.forEach(r => console.log(`  ${r.id}: os=${r.os_id}, valor=${r.valor_liquido}, status=${r.status_pagamento}`));

  // 12. Check FP total count with is_teste = true
  console.log('\n--- FP COM is_teste = true ---');
  const testFPs = await c.query(`SELECT count(*) AS n FROM financeiro_pagar WHERE is_teste = true`);
  console.log(`  Total: ${testFPs.rows[0].n}`);

  // 13. Check all FP with is_teste = true
  const allTest = await c.query(`SELECT id, os_id, prestador, valor, status, descricao FROM financeiro_pagar WHERE is_teste = true`);
  allTest.rows.forEach(r => console.log(`  ${r.id}: os=${r.os_id}, prest=${r.prestador}, valor=${r.valor}, status=${r.status}, desc=${r.descricao}`));

  await c.end();
  console.log('\n=== FIM DEEP CHECK ===');
})();
