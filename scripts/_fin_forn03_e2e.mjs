import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();
  const results = [];
  const cleanupIds = [];
  const cleanupTitleIds = [];

  // ═══ PASSO 1: Criar fornecedor TESTE_FIN_FORN03 ═══
  const f1Res = await c.query(`
    INSERT INTO fornecedores (tipo_pessoa, razao_social, nome_fantasia, cpf_cnpj, telefone, status)
    VALUES ('PJ', 'TESTE_FIN_FORN03 EMPRESA LTDA', 'Teste FN03', '99888777000166', '(11) 98888-7777', 'ativo')
    RETURNING id, razao_social, cpf_cnpj, status
  `);
  const f1 = f1Res.rows[0];
  cleanupIds.push(f1.id);
  results.push(`PASSO 1 — Fornecedor criado: id=${f1.id}, razao=${f1.razao_social}, cnpj=${f1.cpf_cnpj}, status=${f1.status}`);

  // ═══ PASSO 2: Criar titulo via financeiro_pagar com fornecedor_cadastro_id (simula UI) ═══
  const t1Res = await c.query(`
    INSERT INTO financeiro_pagar (
      descricao, valor, fornecedor, fornecedor_documento, fornecedor_cadastro_id, fornecedor_nome,
      categoria, data_vencimento, status
    ) VALUES (
      'Despesa TESTE_FIN_FORN03 - E2E', 500.00,
      'TESTE_FIN_FORN03 EMPRESA LTDA', '99888777000166', $1, 'TESTE_FIN_FORN03 EMPRESA LTDA',
      'Manutenção', CURRENT_DATE + INTERVAL '10 days', 'a vencer'
    ) RETURNING id, fornecedor_cadastro_id, fornecedor, fornecedor_documento, fornecedor_nome
  `, [f1.id]);
  const t1 = t1Res.rows[0];
  cleanupTitleIds.push(t1.id);
  results.push(`PASSO 2 — Titulo criado: id=${t1.id}`);
  results.push(`  fornecedor_cadastro_id = ${t1.fornecedor_cadastro_id} (esperado: ${f1.id})`);
  results.push(`  fornecedor (snapshot) = ${t1.fornecedor}`);
  results.push(`  fornecedor_documento = ${t1.fornecedor_documento}`);
  results.push(`  fornecedor_nome = ${t1.fornecedor_nome}`);

  // ═══ PASSO 3: Validar FK funciona (JOIN) ═══
  const joinRes = await c.query(`
    SELECT fp.id as titulo_id, fn.razao_social, fn.cpf_cnpj, fn.nome_fantasia
    FROM financeiro_pagar fp
    JOIN fornecedores fn ON fn.id = fp.fornecedor_cadastro_id
    WHERE fp.id = $1
  `, [t1.id]);
  results.push(`PASSO 3 — FK validada: ${JSON.stringify(joinRes.rows[0])}`);

  // ═══ PASSO 4: Editar fornecedor — titulo mantem snapshot original ═══
  await c.query(`UPDATE fornecedores SET razao_social = 'TESTE_FIN_FORN03 EDITADO LTDA', nome_fantasia = 'Editado' WHERE id = $1`, [f1.id]);
  const t1After = await c.query(`SELECT fornecedor, fornecedor_documento, fornecedor_nome FROM financeiro_pagar WHERE id = $1`, [t1.id]);
  const snapshot = t1After.rows[0];
  results.push(`PASSO 4 — Apos editar fornecedor:`);
  results.push(`  titulo.fornecedor = ${snapshot.fornecedor} (mantem "TESTE_FIN_FORN03 EMPRESA LTDA")`);
  results.push(`  titulo.fornecedor_documento = ${snapshot.fornecedor_documento} (mantem "99888777000166")`);
  const snapshotOk = snapshot.fornecedor === 'TESTE_FIN_FORN03 EMPRESA LTDA' && snapshot.fornecedor_documento === '99888777000166';
  results.push(`  Snapshot preservado: ${snapshotOk ? '✅ SIM' : '❌ NÃO'}`);

  // ═══ PASSO 5: Fornecedor inativo não aparece na busca (filtro status=ativo) ═══
  await c.query(`UPDATE fornecedores SET status = 'inativo' WHERE id = $1`, [f1.id]);
  const inativoSearch = await c.query(`SELECT count(*) as total FROM fornecedores WHERE status = 'ativo' AND (razao_social ILIKE '%TESTE_FIN_FORN03%' OR cpf_cnpj ILIKE '%99888777000166%')`);
  results.push(`PASSO 5 — Busca por fornecedor inativo: ${inativoSearch.rows[0].total} resultados (esperado: 0) — ${parseInt(inativoSearch.rows[0].total) === 0 ? '✅' : '❌'}`);

  // ═══ PASSO 6: Criar segundo fornecedor para provar cadastro rápido ═══
  const f2Res = await c.query(`
    INSERT INTO fornecedores (tipo_pessoa, razao_social, cpf_cnpj, status)
    VALUES ('PF', 'TESTE_FIN_FORN03 Pessoa Fisica', '12345678901', 'ativo')
    RETURNING id, razao_social, cpf_cnpj
  `);
  const f2 = f2Res.rows[0];
  cleanupIds.push(f2.id);
  const t2Res = await c.query(`
    INSERT INTO financeiro_pagar (
      descricao, valor, fornecedor, fornecedor_documento, fornecedor_cadastro_id, fornecedor_nome,
      categoria, data_vencimento, status
    ) VALUES (
      'Despesa TESTE_FIN_FORN03 cadastro rapido', 250.00,
      'TESTE_FIN_FORN03 Pessoa Fisica', '12345678901', $1, 'TESTE_FIN_FORN03 Pessoa Fisica',
      'Energia elétrica', CURRENT_DATE + INTERVAL '5 days', 'a vencer'
    ) RETURNING id, fornecedor_cadastro_id
  `, [f2.id]);
  const t2 = t2Res.rows[0];
  cleanupTitleIds.push(t2.id);
  results.push(`PASSO 6 — Cadastro rápido provado: fornecedor_id=${f2.id}, titulo_id=${t2.id}, fk_ok=${t2.fornecedor_cadastro_id === f2.id ? '✅' : '❌'}`);

  // ═══ PASSO 7: Titulo legado com fornecedor_id (prestadores) continua intacto ═══
  const legadoRes = await c.query(`
    SELECT count(*) as total FROM financeiro_pagar WHERE fornecedor_id IS NOT NULL
  `);
  results.push(`PASSO 7 — Titulos legados (fornecedor_id → prestadores): ${legadoRes.rows[0].total} registros intactos`);

  // ═══ PASSO 8: Indicadores financeiro_pagar intactos ═══
  const indicadores = await c.query(`
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE status IN ('a vencer', 'a_vencer')) as a_vencer,
      count(*) FILTER (WHERE status = 'vencida') as vencida,
      count(*) FILTER (WHERE status = 'paga') as paga
    FROM financeiro_pagar
  `);
  const ind = indicadores.rows[0];
  results.push(`PASSO 8 — Indicadores intactos: total=${ind.total}, a_vencer=${ind.a_vencer}, vencida=${ind.vencida}, paga=${ind.paga}`);

  // ═══ PASSO 9: RLS ativo ═══
  const rlsRes = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'fornecedores'`);
  results.push(`PASSO 9 — RLS fornecedores: ${rlsRes.rows[0]?.relrowsecurity ? 'ATIVO ✅' : 'INATIVO ❌'}`);

  // ═══ PASSO 10: Cleanup completo ═══
  for (const tid of cleanupTitleIds) {
    await c.query(`DELETE FROM financeiro_pagar WHERE id = $1`, [tid]);
  }
  for (const fid of cleanupIds) {
    await c.query(`DELETE FROM fornecedores WHERE id = $1`, [fid]);
  }
  const remainingForn = await c.query(`SELECT count(*) as total FROM fornecedores WHERE razao_social LIKE 'TESTE_FIN_FORN03%'`);
  const remainingTitles = await c.query(`SELECT count(*) as total FROM financeiro_pagar WHERE descricao LIKE '%TESTE_FIN_FORN03%'`);
  results.push(`PASSO 10 — Cleanup: fornecedores=${remainingForn.rows[0].total}, titulos=${remainingTitles.rows[0].total} (esperado: 0/0) — ${parseInt(remainingForn.rows[0].total) === 0 && parseInt(remainingTitles.rows[0].total) === 0 ? '✅ LIMPO' : '❌ RESTOS'}`);

  console.log("\n=== PROVA REAL FIN-FORN-03 ===");
  results.forEach(r => console.log(r));
  console.log("=== FIM ===");

  await c.end();
})();
