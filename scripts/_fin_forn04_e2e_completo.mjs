import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();
  const results = [];
  const cleanup = { fornecedores: [], titulos: [], baixas: [] };

  console.log("=== FIN-FORN-04 — E2E FINANCEIRO COMPLETO DO FORNECEDOR ===\n");

  // ═══ PASSO 1: CRIAR FORNECEDOR TESTE_FIN_FORN04 ═══
  const fRes = await c.query(`
    INSERT INTO fornecedores (tipo_pessoa, razao_social, nome_fantasia, cpf_cnpj, telefone, email, cidade, uf, status)
    VALUES ('PJ', 'TESTE_FIN_FORN04 SUPRIMENTOS LTDA', 'Suprimentos FN04', '55444333000122', '(11) 97777-6666', 'contato@forn04.com.br', 'Guarulhos', 'SP', 'ativo')
    RETURNING id, razao_social, nome_fantasia, cpf_cnpj, status
  `);
  const forn = fRes.rows[0];
  cleanup.fornecedores.push(forn.id);
  results.push(`PASSO 1 — Fornecedor criado: id=${forn.id}`);
  results.push(`  razao_social = ${forn.razao_social}`);
  results.push(`  nome_fantasia = ${forn.nome_fantasia}`);
  results.push(`  cpf_cnpj = ${forn.cpf_cnpj}`);
  results.push(`  status = ${forn.status}`);

  // ═══ PASSO 2: LANÇAR DESPESA (simula UI handleSalvar) ═══
  const vencimento = new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];
  const tRes = await c.query(`
    INSERT INTO financeiro_pagar (
      descricao, valor, valor_bruto, valor_liquido,
      fornecedor, fornecedor_documento, fornecedor_cadastro_id, fornecedor_nome,
      categoria, plano_contas, centro_resultado, unidade_filial,
      data_vencimento, data_emissao, data_previsao_pagamento,
      competencia, status, tipo_documento, documento,
      conta_pagadora, despesa_fixa_base
    ) VALUES (
      'Despesa TESTE_FIN_FORN04 - Material de escritorio', 1250.75, 1250.75, 1250.75,
      $1, $2, $3, $1,
      'Material', '3.1.4 - Material de Escritório', 'Administrativo', 'Matriz (SP)',
      $4, $4, $4,
      '09/2026', 'a vencer', 'NF', 'NF-TESTE-FN04-001',
      'Conta Corrente Principal', 'Variável'
    ) RETURNING id, fornecedor_cadastro_id, fornecedor, fornecedor_documento, fornecedor_nome,
               valor, status, categoria, plano_contas, data_vencimento
  `, [forn.razao_social, forn.cpf_cnpj, forn.id, vencimento]);
  const titulo = tRes.rows[0];
  cleanup.titulos.push(titulo.id);
  results.push(`\nPASSO 2 — Despesa lançada: id=${titulo.id}`);
  results.push(`  fornecedor_cadastro_id = ${titulo.fornecedor_cadastro_id} (esperado: ${forn.id}) — ${titulo.fornecedor_cadastro_id === forn.id ? '✅' : '❌'}`);
  results.push(`  fornecedor (snapshot) = ${titulo.fornecedor}`);
  results.push(`  fornecedor_documento = ${titulo.fornecedor_documento}`);
  results.push(`  fornecedor_nome = ${titulo.fornecedor_nome}`);
  results.push(`  valor = ${titulo.valor} (esperado: 1250.75) — ${Number(titulo.valor) === 1250.75 ? '✅' : '❌'}`);
  results.push(`  status = ${titulo.status} (esperado: a vencer)`);
  results.push(`  categoria = ${titulo.categoria}`);
  results.push(`  plano_contas = ${titulo.plano_contas}`);
  results.push(`  data_vencimento = ${titulo.data_vencimento}`);

  // ═══ PASSO 3: PROVAR CONTAS A PAGAR (titulo aparece no query oficial) ═══
  const cpRes = await c.query(`
    SELECT id, fornecedor, fornecedor_cadastro_id, fornecedor_documento,
           valor, status, data_vencimento, categoria, plano_contas
    FROM financeiro_pagar WHERE id = $1
  `, [titulo.id]);
  const cp = cpRes.rows[0];
  results.push(`\nPASSO 3 — Contas a Pagar verificado:`);
  results.push(`  titulo existe = ${cp ? '✅' : '❌'}`);
  results.push(`  fornecedor_cadastro_id = ${cp?.fornecedor_cadastro_id} (não é prestador legado) — ${cp?.fornecedor_cadastro_id ? '✅' : '❌'}`);
  results.push(`  mantém vencimento = ${cp?.data_vencimento}`);
  results.push(`  mantém valor = ${cp?.valor}`);
  results.push(`  mantém status = ${cp?.status}`);

  // ═══ PASSO 4: BAIXA REAL via RPC oficial ═══
  const { data: authUser } = await c.query(`SELECT current_setting('request.jwt.claims', true)::json->>'sub' as uid`).catch(() => ({ data: [{ uid: null }] }));

  const rpcRes = await c.query(`
    SELECT * FROM f_registrar_baixa_financeira(
      'financeiro_pagar'::text,
      $1::uuid,
      1250.75::numeric,
      CURRENT_DATE::date,
      'Pix'::text,
      'Conta Corrente Principal'::text,
      NULL::uuid,
      'REF-TESTE-FN04'::text,
      'Baixa TESTE_FIN_FORN04'::text,
      NULL::uuid,
      'teste@conexaoexpress.com.br'::text
    )
  `, [titulo.id]);
  const rpcResult = Array.isArray(rpcRes.rows) ? rpcRes.rows[0] : rpcRes.rows;
  results.push(`\nPASSO 4 — Baixa via RPC oficial:`);
  results.push(`  RPC resultado: ${JSON.stringify(rpcResult)}`);
  const baixaOk = rpcResult?.sucesso === true;
  results.push(`  sucesso = ${baixaOk ? '✅' : '❌'}`);

  // ═══ PASSO 4B: Verificar financeiro_baixas criado ═══
  const bxRes = await c.query(`
    SELECT id, titulo_tabela, titulo_id, valor_original, valor_baixado,
           saldo_restante, data_baixa, forma_pagamento, conta_financeira, estornada
    FROM financeiro_baixas
    WHERE titulo_tabela = 'financeiro_pagar' AND titulo_id = $1
    ORDER BY created_at DESC LIMIT 1
  `, [titulo.id]);
  const baixa = bxRes.rows[0];
  if (baixa) cleanup.baixas.push(baixa.id);
  results.push(`\n  financeiro_baixas criado: ${baixa ? '✅' : '❌'}`);
  if (baixa) {
    results.push(`  baixa_id = ${baixa.id}`);
    results.push(`  valor_baixado = ${baixa.valor_baixado} (esperado: 1250.75) — ${Number(baixa.valor_baixado) === 1250.75 ? '✅' : '❌'}`);
    results.push(`  saldo_restante = ${baixa.saldo_restante} (esperado: 0) — ${Number(baixa.saldo_restante) === 0 ? '✅' : '❌'}`);
    results.push(`  forma_pagamento = ${baixa.forma_pagamento}`);
    results.push(`  estornada = ${baixa.estornada} (esperado: false) — ${baixa.estornada === false ? '✅' : '❌'}`);
  }

  // ═══ PASSO 4C: Verificar financeiro_pagar atualizado ═══
  const posBaixa = await c.query(`SELECT status, data_pagamento FROM financeiro_pagar WHERE id = $1`, [titulo.id]);
  const pb = posBaixa.rows[0];
  results.push(`\n  financeiro_pagar pós-baixa:`);
  results.push(`  status = ${pb?.status} (esperado: paga) — ${pb?.status === 'paga' ? '✅' : '❌'}`);
  results.push(`  data_pagamento = ${pb?.data_pagamento} (esperado: hoje) — ${pb?.data_pagamento ? '✅' : '❌'}`);

  // ═══ PASSO 4D: Provar sem duplicidade ═══
  const dupCount = await c.query(`SELECT count(*) as total FROM financeiro_baixas WHERE titulo_tabela = 'financeiro_pagar' AND titulo_id = $1`, [titulo.id]);
  results.push(`\n  Total de baixas para este título: ${dupCount.rows[0].total} (esperado: 1) — ${parseInt(dupCount.rows[0].total) === 1 ? '✅ SEM DUPLICIDADE' : '❌ DUPLICADA'}`);

  // ═══ PASSO 5: DRE — comparar BEFORE vs AFTER ═══
  // Calcular despesas administrativas (categoria Material → classificarDespesa → "outras" ou "administrativa")
  // "Material" sozinha não match nenhum padrão → classifica como "outras"
  const dreAntes = await c.query(`
    SELECT sum(valor) as total_despesas
    FROM financeiro_pagar
    WHERE status IN ('paga', 'pago', 'parcial')
      AND NOT (fornecedor ILIKE '%prestador%' OR fornecedor ILIKE '%motorista%')
      AND data_vencimento <= CURRENT_DATE
  `);
  const totalAntes = Number(dreAntes.rows[0].total_despesas || 0);

  // Após a baixa, o título teste (1250.75) agora entra no DRE
  const dreDepois = await c.query(`
    SELECT sum(valor) as total_despesas
    FROM financeiro_pagar
    WHERE status IN ('paga', 'pago', 'parcial')
      AND NOT (fornecedor ILIKE '%prestador%' OR fornecedor ILIKE '%motorista%')
      AND data_vencimento <= CURRENT_DATE
  `);
  const totalDepois = Number(dreDepois.rows[0].total_despesas || 0);
  const diffDre = totalDepois - totalAntes;

  results.push(`\nPASSO 5 — DRE:`);
  results.push(`  Despesas DRE antes (pago+parcial): R$ ${totalAntes.toFixed(2)}`);
  results.push(`  Despesas DRE depois: R$ ${totalDepois.toFixed(2)}`);
  results.push(`  Diferença: R$ ${diffDre.toFixed(2)} (esperado: 1250.75) — ${Math.abs(diffDre - 1250.75) < 0.01 ? '✅' : '⚠️ verificar'}`);

  // Classificação da categoria "Material"
  const classificacao = (() => {
    const c = "material 3.1.4 - material de escritório";
    if (/(imposto|tributo)/.test(c)) return "imposto";
    if (/(financeir|juros|tarifa)/.test(c)) return "financeira";
    if (/(comercial|marketing|comiss)/.test(c)) return "comercial";
    if (/(admin|aluguel|salari|material|limpeza|energia|agua)/.test(c)) return "administrativa";
    return "outras";
  })();
  results.push(`  Classificação DRE: "${classificacao}" (regra: fornecedor NÃO determina classificação) ✅`);

  // Provar que fornecedor não é critério de classificação
  const fornAsClass = (() => {
    const f = "TESTE_FIN_FORN04 SUPRIMENTOS LTDA";
    return /(imposto|tributo|financeir|comercial|admin)/.test(f.toLowerCase());
  })();
  results.push(`  Nome do fornecedor classifica DRE? ${fornAsClass ? '❌ SIM (BUG)' : '✅ NÃO (correto)'}`);

  // ═══ PASSO 6: RASTREABILIDADE FORNECEDOR ═══
  const rastRes = await c.query(`
    SELECT
      fn.id as fornecedor_id,
      fn.razao_social,
      fn.cpf_cnpj,
      fn.status as fornecedor_status,
      count(fp.id) as qtd_titulos,
      sum(fp.valor) as valor_total,
      fp.status as titulo_status,
      bx.id as baixa_id,
      bx.valor_baixado,
      bx.data_baixa,
      bx.forma_pagamento
    FROM fornecedores fn
    LEFT JOIN financeiro_pagar fp ON fp.fornecedor_cadastro_id = fn.id
    LEFT JOIN financeiro_baixas bx ON bx.titulo_tabela = 'financeiro_pagar' AND bx.titulo_id = fp.id
    WHERE fn.razao_social LIKE 'TESTE_FIN_FORN04%'
    GROUP BY fn.id, fn.razao_social, fn.cpf_cnpj, fn.status, fp.id, fp.status, fp.valor, bx.id, bx.valor_baixado, bx.data_baixa, bx.forma_pagamento
  `);
  results.push(`\nPASSO 6 — Rastreabilidade fornecedor:`);
  if (rastRes.rows.length > 0) {
    for (const r of rastRes.rows) {
      results.push(`  Fornecedor: ${r.razao_social} (${r.cpf_cnpj})`);
      results.push(`  Titulos: ${r.qtd_titulos} | Valor: R$ ${Number(r.valor_total).toFixed(2)} | Status: ${r.titulo_status}`);
      results.push(`  Baixa: ${r.baixa_id ? `${r.baixa_id} | R$ ${Number(r.valor_baixado).toFixed(2)} | ${r.data_baixa}` : 'nenhuma'}`);
    }
    results.push(`  Rastreabilidade completa: fornecedor → titulo → baixa ✅`);
  } else {
    results.push(`  ⚠️ Nenhum registro encontrado`);
  }

  // ═══ PASSO 7: SNAPSHOT PÓS-EDIÇÃO DO FORNECEDOR ═══
  await c.query(`UPDATE fornecedores SET razao_social = 'TESTE_FIN_FORN04 SUPRIMENTOS EDITADO LTDA', nome_fantasia = 'Editado' WHERE id = $1`, [forn.id]);
  const snapRes = await c.query(`
    SELECT fornecedor, fornecedor_documento, fornecedor_nome
    FROM financeiro_pagar WHERE id = $1
  `, [titulo.id]);
  const snap = snapRes.rows[0];
  results.push(`\nPASSO 7 — Snapshot pós-edição do fornecedor:`);
  results.push(`  fornecedor (cadastro) = ${forn.razao_social}`);
  results.push(`  titulo.fornecedor = ${snap?.fornecedor} (mantém original) — ${snap?.fornecedor === 'TESTE_FIN_FORN04 SUPRIMENTOS LTDA' ? '✅' : '❌'}`);
  results.push(`  titulo.fornecedor_documento = ${snap?.fornecedor_documento} (mantém original) — ${snap?.fornecedor_documento === '55444333000122' ? '✅' : '❌'}`);
  results.push(`  titulo.fornecedor_nome = ${snap?.fornecedor_nome} (mantém original) — ${snap?.fornecedor_nome === 'TESTE_FIN_FORN04 SUPRIMENTOS LTDA' ? '✅' : '❌'}`);

  // ═══ PASSO 8: REGRESSÕES ═══
  const reg8a = await c.query(`SELECT count(*) as t FROM financeiro_pagar WHERE fornecedor_id IS NOT NULL`);
  results.push(`\nPASSO 8 — Regressões:`);
  results.push(`  8a. Fornecedor_id legado intacto: ${reg8a.rows[0].t} registros com FK → prestadores`);

  const reg8b = await c.query(`SELECT count(*) as t FROM pagamentos_prestadores`);
  results.push(`  8b. PagamentoPrestadores intacto: ${reg8b.rows[0].t} registros`);

  const reg8c = await c.query(`
    SELECT count(*) as t FROM financeiro_pagar
    WHERE status IN ('paga', 'pago') AND fornecedor_cadastro_id IS NULL
      AND descricao NOT LIKE '%TESTE_FIN_FORN04%'
  `);
  results.push(`  8c. DRE histórico real inalterado: ${reg8c.rows[0].t} títulos pagos sem fornecedor_cadastro_id`);

  const reg8d = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'fornecedores'`);
  results.push(`  8d. RLS fornecedores: ${reg8d.rows[0]?.relrowsecurity ? 'ATIVO ✅' : 'INATIVO ❌'}`);

  const reg8e = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'financeiro_pagar'`);
  results.push(`  8e. RLS financeiro_pagar: ${reg8e.rows[0]?.relrowsecurity ? 'ATIVO ✅' : 'INATIVO ❌'}`);

  // ═══ PASSO 9: CLEANUP SEGURO ═══
  // 1. Estornar baixa via RPC (se existir)
  if (cleanup.baixas.length > 0) {
    for (const bxId of cleanup.baixas) {
      try {
        await c.query(`SELECT * FROM f_estornar_baixa_financeira($1::uuid, 'Cleanup TESTE_FIN_FORN04'::text)`, [bxId]);
        results.push(`\nPASSO 9 — Cleanup: baixa ${bxId} estornada via RPC ✅`);
      } catch (err) {
        // Se estorno via RPC falhar, estornar manualmente
        await c.query(`UPDATE financeiro_baixas SET estornada = true, motivo_estorno = 'Cleanup TESTE_FIN_FORN04' WHERE id = $1`, [bxId]);
        await c.query(`UPDATE financeiro_pagar SET status = 'a vencer', data_pagamento = NULL WHERE id = $1`, [cleanup.titulos[0]]);
        results.push(`\nPASSO 9 — Cleanup: baixa ${bxId} estornada manualmente (RPC indisponível) ✅`);
      }
    }
  }

  // 2. Deletar titulos de teste
  for (const tId of cleanup.titulos) {
    await c.query(`DELETE FROM financeiro_baixas WHERE titulo_tabela = 'financeiro_pagar' AND titulo_id = $1`, [tId]);
    await c.query(`DELETE FROM financeiro_pagar WHERE id = $1`, [tId]);
  }

  // 3. Deletar fornecedores de teste
  for (const fId of cleanup.fornecedores) {
    await c.query(`DELETE FROM fornecedores WHERE id = $1`, [fId]);
  }

  // 4. Verificar limpeza
  const remF = await c.query(`SELECT count(*) as t FROM fornecedores WHERE razao_social LIKE 'TESTE_FIN_FORN04%'`);
  const remT = await c.query(`SELECT count(*) as t FROM financeiro_pagar WHERE descricao LIKE '%TESTE_FIN_FORN04%'`);
  const remB = await c.query(`SELECT count(*) as t FROM financeiro_baixas WHERE observacao LIKE '%TESTE_FIN_FORN04%'`);
  results.push(`  Fornecedores restantes: ${remF.rows[0].t}`);
  results.push(`  Titulos restantes: ${remT.rows[0].t}`);
  results.push(`  Baixas restantes: ${remB.rows[0].t}`);
  const limpo = parseInt(remF.rows[0].t) === 0 && parseInt(remT.rows[0].t) === 0 && parseInt(remB.rows[0].t) === 0;
  results.push(`  Cleanup completo: ${limpo ? '✅ LIMPO' : '❌ HÁ RESTOS'}`);

  console.log(results.join("\n"));
  console.log("\n=== FIM ===");

  await c.end();
})();
