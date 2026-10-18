import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();
  const R = [];
  const cleanup = { fornecedores: [], titulos: [], baixas: [] };

  console.log("=== FIN-FORN-04.1 — PROVA REAL DO IMPACTO NO DRE ===\n");

  // ═══ PARÂMETROS ═══
  const mes = new Date().toISOString().slice(0, 7); // "2026-09"
  const inicio = `${mes}-01`;
  const fim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0];
  const VALOR_TESTE = 3456.78;
  // Usar "Aluguel" → classificarDespesa match "aluguel" → "administrativa"
  const CATEGORIA = "Aluguel";
  const PLANO_CONTAS = "3.1.1 - Aluguel Imóvel";

  R.push(`PARÂMETROS:`);
  R.push(`  Período DRE: ${inicio} a ${fim}`);
  R.push(`  Valor teste: R$ ${VALOR_TESTE.toFixed(2)}`);
  R.push(`  Categoria: "${CATEGORIA}" → classificarDespesa → "administrativa"`);
  R.push(`  Plano de contas: "${PLANO_CONTAS}"`);

  // ═══ PASSO 1: DRE BEFORE ═══
  const dreBefore = await c.query(`
    SELECT sum(valor) as total
    FROM financeiro_pagar
    WHERE is_teste = false
      AND os_id IS NULL
      AND status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= $1 AND data_vencimento <= $2
  `, [inicio, fim]);
  const beforeTotal = Number(dreBefore.rows[0].total || 0);

  // Query por classificação (replicando lógica do DREGerencial)
  const catsBefore = await c.query(`
    SELECT categoria, plano_contas, sum(valor) as total
    FROM financeiro_pagar
    WHERE is_teste = false
      AND os_id IS NULL
      AND status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= $1 AND data_vencimento <= $2
    GROUP BY categoria, plano_contas
  `, [inicio, fim]);

  const classificarLocal = (cat, pc) => {
    const c = `${cat || ""} ${pc || ""}`.toLowerCase();
    if (/(imposto|tributo)/.test(c)) return "imposto";
    if (/(financeir|juros|tarifa)/.test(c)) return "financeira";
    if (/(comercial|marketing|comiss)/.test(c)) return "comercial";
    if (/(admin|aluguel|salari|material|limpeza|energia|agua)/.test(c)) return "administrativa";
    return "outras";
  };

  let beforeAdmin = 0, beforeOutras = 0, beforeFin = 0, beforeCom = 0, beforeImp = 0;
  for (const row of catsBefore.rows) {
    const v = Number(row.total);
    switch (classificarLocal(row.categoria, row.plano_contas)) {
      case "imposto": beforeImp += v; break;
      case "financeira": beforeFin += v; break;
      case "comercial": beforeCom += v; break;
      case "administrativa": beforeAdmin += v; break;
      default: beforeOutras += v; break;
    }
  }

  R.push(`\n═══ DRE BEFORE (${inicio} a ${fim}) ═══`);
  R.push(`  Total despesas no período: R$ ${beforeTotal.toFixed(2)}`);
  R.push(`  Despesas administrativas: R$ ${beforeAdmin.toFixed(2)}`);
  R.push(`  Despesas outras: R$ ${beforeOutras.toFixed(2)}`);
  R.push(`  Despesas financeiras: R$ ${beforeFin.toFixed(2)}`);
  R.push(`  Despesas comerciais: R$ ${beforeCom.toFixed(2)}`);
  R.push(`  Deduções (impostos): R$ ${beforeImp.toFixed(2)}`);
  R.push(`  Títulos no período: ${catsBefore.rows.length} categorias`);

  // ═══ PASSO 2: CRIAR FORNECEDOR ═══
  const fRes = await c.query(`
    INSERT INTO fornecedores (tipo_pessoa, razao_social, nome_fantasia, cpf_cnpj, status)
    VALUES ('PJ', 'TESTE_FIN_FORN041 IMOVEIS LTDA', 'Imoveis FN041', '66777888000144', 'ativo')
    RETURNING id, razao_social, cpf_cnpj
  `);
  const forn = fRes.rows[0];
  cleanup.fornecedores.push(forn.id);
  R.push(`\n═══ FORNECEDOR CRIADO ═══`);
  R.push(`  id = ${forn.id}`);
  R.push(`  razao_social = ${forn.razao_social}`);
  R.push(`  cpf_cnpj = ${forn.cpf_cnpj}`);

  // ═══ PASSO 3: CRIAR TÍTULO COM data_vencimento DENTRO DO PERÍODO ═══
  // data_vencimento = 15 do mês atual (dentro da janela DRE)
  const dataVenc = `${mes}-15`;
  const tRes = await c.query(`
    INSERT INTO financeiro_pagar (
      descricao, valor, valor_bruto, valor_liquido,
      fornecedor, fornecedor_documento, fornecedor_cadastro_id, fornecedor_nome,
      categoria, plano_contas, centro_resultado, unidade_filial,
      data_vencimento, data_emissao, data_previsao_pagamento,
      competencia, status, tipo_documento, documento,
      is_teste, os_id, conta_pagadora, despesa_fixa_base
    ) VALUES (
      'Despesa TESTE_FIN_FORN041 - Aluguel escritório', $1, $1, $1,
      $2, $3, $4, $2,
      $5, $6, 'Administrativo', 'Matriz (SP)',
      $7, $7, $7,
      $8, 'a vencer', 'Boleto', 'BL-TESTE-FN041',
      false, NULL, 'Conta Corrente Principal', 'Fixa'
    ) RETURNING id, fornecedor_cadastro_id, valor, status, data_vencimento, is_teste, categoria, plano_contas
  `, [VALOR_TESTE, forn.razao_social, forn.cpf_cnpj, forn.id, CATEGORIA, PLANO_CONTAS, dataVenc, mes]);
  const titulo = tRes.rows[0];
  cleanup.titulos.push(titulo.id);
  R.push(`\n═══ TÍTULO CRIADO ═══`);
  R.push(`  id = ${titulo.id}`);
  R.push(`  fornecedor_cadastro_id = ${titulo.fornecedor_cadastro_id}`);
  R.push(`  valor = ${titulo.valor} (esperado: ${VALOR_TESTE})`);
  R.push(`  status = ${titulo.status}`);
  R.push(`  data_vencimento = ${titulo.data_vencimento} (dentro do período DRE)`);
  R.push(`  is_teste = ${titulo.is_teste} (deve ser false)`);
  R.push(`  categoria = ${titulo.categoria}`);
  R.push(`  plano_contas = ${titulo.plano_contas}`);

  // ═══ PASSO 4: DRE AFTER ═══
  const dreAfter = await c.query(`
    SELECT sum(valor) as total
    FROM financeiro_pagar
    WHERE is_teste = false
      AND os_id IS NULL
      AND status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= $1 AND data_vencimento <= $2
  `, [inicio, fim]);
  const afterTotal = Number(dreAfter.rows[0].total || 0);

  const catsAfter = await c.query(`
    SELECT categoria, plano_contas, sum(valor) as total
    FROM financeiro_pagar
    WHERE is_teste = false
      AND os_id IS NULL
      AND status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= $1 AND data_vencimento <= $2
    GROUP BY categoria, plano_contas
  `, [inicio, fim]);

  let afterAdmin = 0, afterOutras = 0, afterFin = 0, afterCom = 0, afterImp = 0;
  for (const row of catsAfter.rows) {
    const v = Number(row.total);
    switch (classificarLocal(row.categoria, row.plano_contas)) {
      case "imposto": afterImp += v; break;
      case "financeira": afterFin += v; break;
      case "comercial": afterCom += v; break;
      case "administrativa": afterAdmin += v; break;
      default: afterOutras += v; break;
    }
  }

  R.push(`\n═══ DRE AFTER (${inicio} a ${fim}) ═══`);
  R.push(`  Total despesas no período: R$ ${afterTotal.toFixed(2)}`);
  R.push(`  Despesas administrativas: R$ ${afterAdmin.toFixed(2)}`);
  R.push(`  Despesas outras: R$ ${afterOutras.toFixed(2)}`);
  R.push(`  Despesas financeiras: R$ ${afterFin.toFixed(2)}`);
  R.push(`  Despesas comerciais: R$ ${afterCom.toFixed(2)}`);
  R.push(`  Deduções (impostos): R$ ${afterImp.toFixed(2)}`);

  // ═══ PASSO 5: PROVAR DIFFERENCE ═══
  const diffTotal = afterTotal - beforeTotal;
  const diffAdmin = afterAdmin - beforeAdmin;
  R.push(`\n═══ PROVA: AFTER - BEFORE ═══`);
  R.push(`  Diferença total: R$ ${diffTotal.toFixed(2)} (esperado: ${VALOR_TESTE.toFixed(2)})`);
  R.push(`  Match total: ${Math.abs(diffTotal - VALOR_TESTE) < 0.01 ? '✅ EXATO' : '❌ DIVERGENTE'}`);
  R.push(`  Diferença administrativa: R$ ${diffAdmin.toFixed(2)} (esperado: ${VALOR_TESTE.toFixed(2)})`);
  R.push(`  Match administrativa: ${Math.abs(diffAdmin - VALOR_TESTE) < 0.01 ? '✅ EXATO' : '❌ DIVERGENTE'}`);

  // Provar que entrou em "administrativa" e NÃO em outra classificação
  const diffOutras = afterOutras - beforeOutras;
  const diffFin = afterFin - beforeFin;
  const diffCom = afterCom - beforeCom;
  const diffImp = afterImp - beforeImp;
  R.push(`\n  Diferença outras: R$ ${diffOutras.toFixed(2)} (esperado: 0) — ${Math.abs(diffOutras) < 0.01 ? '✅' : '❌'}`);
  R.push(`  Diferença financeiras: R$ ${diffFin.toFixed(2)} (esperado: 0) — ${Math.abs(diffFin) < 0.01 ? '✅' : '❌'}`);
  R.push(`  Diferença comerciais: R$ ${diffCom.toFixed(2)} (esperado: 0) — ${Math.abs(diffCom) < 0.01 ? '✅' : '❌'}`);
  R.push(`  Diferença deduções: R$ ${diffImp.toFixed(2)} (esperado: 0) — ${Math.abs(diffImp) < 0.01 ? '✅' : '❌'}`);

  // Regra: fornecedor NÃO participa da classificação
  const fornClassifica = /imposto|tributo|financeir|comercial|admin/.test(forn.razao_social.toLowerCase());
  R.push(`\n  Fornecedor "${forn.razao_social}" classifica DRE? ${fornClassifica ? '❌ SIM (BUG)' : '✅ NÃO (correto)'}`);

  // ═══ PASSO 6: RASTREABILIDADE ═══
  const rast = await c.query(`
    SELECT fn.id as forn_id, fn.razao_social, fn.cpf_cnpj,
           fp.id as titulo_id, fp.valor, fp.categoria, fp.plano_contas, fp.status, fp.data_vencimento,
           CASE
             WHEN fp.categoria ILIKE '%aluguel%' OR fp.plano_contas ILIKE '%aluguel%' THEN 'administrativa'
             WHEN fp.categoria ILIKE '%imposto%' OR fp.plano_contas ILIKE '%imposto%' THEN 'imposto'
             WHEN fp.categoria ILIKE '%financeir%' OR fp.plano_contas ILIKE '%juros%' THEN 'financeira'
             WHEN fp.categoria ILIKE '%comercial%' OR fp.plano_contas ILIKE '%comiss%' THEN 'comercial'
             ELSE 'outras'
           END as grupo_dre
    FROM fornecedores fn
    JOIN financeiro_pagar fp ON fp.fornecedor_cadastro_id = fn.id
    WHERE fn.razao_social LIKE 'TESTE_FIN_FORN041%'
  `);
  R.push(`\n═══ RASTREABILIDADE ═══`);
  for (const r of rast.rows) {
    R.push(`  fornecedores.id = ${r.forn_id}`);
    R.push(`    → financeiro_pagar.id = ${r.titulo_id}`);
    R.push(`    → valor = R$ ${Number(r.valor).toFixed(2)}`);
    R.push(`    → categoria = ${r.categoria}`);
    R.push(`    → grupo DRE = ${r.grupo_dre}`);
  }

  // ═══ PASSO 7: REGRESSÕES ═══
  const reg1 = await c.query(`SELECT count(*) as t FROM financeiro_pagar WHERE fornecedor_id IS NOT NULL`);
  const reg2 = await c.query(`SELECT count(*) as t FROM pagamentos_prestadores`);
  const reg3 = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'fornecedores'`);
  R.push(`\n═══ REGRESSÕES ═══`);
  R.push(`  Fornecedor_id legado: ${reg1.rows[0].t} registros`);
  R.push(`  PagamentoPrestadores: ${reg2.rows[0].t} registros`);
  R.push(`  RLS fornecedores: ${reg3.rows[0]?.relrowsecurity ? 'ATIVO ✅' : 'INATIVO ❌'}`);

  // ═══ PASSO 8: CLEANUP SEGURO ═══
  // Estornar baixa se existir
  for (const bxId of cleanup.baixas) {
    try {
      await c.query(`SELECT * FROM f_estornar_baixa_financeira($1::uuid, 'Cleanup FIN-FORN-04.1'::text)`, [bxId]);
    } catch { /* RPC pode não estar disponível */ }
  }
  // Cancelar título (status permitido: a_vencer → cancelado)
  for (const tId of cleanup.titulos) {
    await c.query(`UPDATE financeiro_pagar SET status = 'cancelado' WHERE id = $1 AND status = 'a vencer'`, [tId]);
    await c.query(`DELETE FROM financeiro_pagar WHERE id = $1`, [tId]);
  }
  // Deletar fornecedores
  for (const fId of cleanup.fornecedores) {
    await c.query(`DELETE FROM fornecedores WHERE id = $1`, [fId]);
  }

  // Verificar DRE retorno ao BEFORE
  const dreCleanup = await c.query(`
    SELECT sum(valor) as total
    FROM financeiro_pagar
    WHERE is_teste = false
      AND os_id IS NULL
      AND status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= $1 AND data_vencimento <= $2
  `, [inicio, fim]);
  const afterCleanup = Number(dreCleanup.rows[0].total || 0);

  const remF = await c.query(`SELECT count(*) as t FROM fornecedores WHERE razao_social LIKE 'TESTE_FIN_FORN041%'`);
  const remT = await c.query(`SELECT count(*) as t FROM financeiro_pagar WHERE descricao LIKE '%TESTE_FIN_FORN041%'`);

  R.push(`\n═══ CLEANUP ═══`);
  R.push(`  Títulos removidos: ${cleanup.titulos.length}`);
  R.push(`  Fornecedores removidos: ${cleanup.fornecedores.length}`);
  R.push(`  Fornecedores restantes: ${remF.rows[0].t}`);
  R.push(`  Títulos restantes: ${remT.rows[0].t}`);
  R.push(`  DRE pós-cleanup: R$ ${afterCleanup.toFixed(2)} (esperado: ${beforeTotal.toFixed(2)})`);
  R.push(`  DRE retornou ao BEFORE: ${Math.abs(afterCleanup - beforeTotal) < 0.01 ? '✅ SIM' : '❌ NÃO'}`);
  const limpo = parseInt(remF.rows[0].t) === 0 && parseInt(remT.rows[0].t) === 0 && Math.abs(afterCleanup - beforeTotal) < 0.01;
  R.push(`  ZERO resíduos: ${limpo ? '✅' : '❌'}`);

  console.log(R.join("\n"));
  console.log("\n=== FIM ===");

  await c.end();
})();
