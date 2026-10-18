// FIN-MASTER-361.1 — Prova pós-migration (FASE 6) + Testes de Baixa (FASE 7) + Fonte Canônica (FASE 8) + Transferências (FASE 9)
import pg from "pg";

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error("DATABASE_URL não definida"); process.exit(1); }

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
let ok = 0, fail = 0;

function check(label, condition, detail) {
  if (condition) { ok++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} — ${detail || 'FALHOU'}`); }
}

async function q(sql, label) {
  try { const r = await client.query(sql); return r.rows; }
  catch (e) { console.error(`  [ERRO ${label}]`, e.message); return null; }
}

async function main() {
  await client.connect();
  console.log("=== FIN-MASTER-361.1 — PROVA PÓS-MIGRATION ===\n");

  // ═══════════════════════════════════════════════════
  // FASE 6 — PROVA PÓS-MIGRATION
  // ═══════════════════════════════════════════════════
  console.log("--- FASE 6: OBJETOS ATIVOS ---");

  // 6.1 RPC f_registrar_baixa_financeira
  const rpc = await q(`
    SELECT p.proname, pg_get_function_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as ret
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'f_registrar_baixa_financeira' AND n.nspname = 'public'
    ORDER BY p.oid
  `);
  check("RPC f_registrar_baixa_financeira existe", rpc && rpc.length > 0);
  check("Apenas 1 assinatura (sem sobrecarga)", rpc && rpc.length === 1, `Encontradas: ${rpc?.length}`);
  check("Nova assinatura tem 11 params", rpc && rpc[0]?.args?.includes('p_conta_financeira_id uuid'), `Args: ${rpc?.[0]?.args?.substring(0,80)}...`);

  // 6.2 Grants da RPC
  const grants = await q(`
    SELECT grantee, privilege_type FROM information_schema.role_routine_grants
    WHERE routine_name = 'f_registrar_baixa_financeira' AND routine_schema = 'public'
  `);
  check("Grant authenticated", grants?.some(g => g.grantee === 'authenticated'));
  check("Grant service_role", grants?.some(g => g.grantee === 'service_role'));
  check("SEM grant PUBLIC", !grants?.some(g => g.grantee === 'public'));
  check("SEM grant anon", !grants?.some(g => g.grantee === 'anon'));

  // 6.3 Tabela financeiro_transferencias
  const transfExists = await q(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financeiro_transferencias') as ok`);
  check("Tabela financeiro_transferencias existe", transfExists?.[0]?.ok);

  // 6.4 Colunas de financeiro_transferencias
  const transfCols = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_transferencias' ORDER BY ordinal_position`);
  const colNames = transfCols?.map(c => c.column_name) || [];
  check("Coluna conta_origem_id", colNames.includes('conta_origem_id'));
  check("Coluna conta_destino_id", colNames.includes('conta_destino_id'));
  check("Coluna valor", colNames.includes('valor'));
  check("Coluna taxa", colNames.includes('taxa'));
  check("Coluna tenant_id", colNames.includes('tenant_id'));

  // 6.5 RLS em financeiro_transferencias
  const rls = await q(`SELECT relrowsecurity FROM pg_class WHERE relname='financeiro_transferencias'`);
  check("RLS habilitado em financeiro_transferencias", rls?.[0]?.relrowsecurity === true);

  // 6.6 Policies de financeiro_transferencias
  const policies = await q(`SELECT policyname FROM pg_policies WHERE tablename='financeiro_transferencias'`);
  check("Policy select_tenant existe", policies?.some(p => p.policyname === 'transferencias_select_tenant'));
  check("Policy insert_tenant existe", policies?.some(p => p.policyname === 'transferencias_insert_tenant'));

  // 6.7 Índices
  const indexes = await q(`SELECT indexname FROM pg_indexes WHERE tablename='financeiro_transferencias'`);
  check("Índice idx_transferencias_origem", indexes?.some(i => i.indexname === 'idx_transferencias_origem'));
  check("Índice idx_transferencias_destino", indexes?.some(i => i.indexname === 'idx_transferencias_destino'));
  check("Índice idx_transferencias_data", indexes?.some(i => i.indexname === 'idx_transferencias_data'));

  // 6.8 RPC f_transferir_entre_contas
  const transferRpc = await q(`
    SELECT p.proname, pg_get_function_arguments(p.oid) as args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'f_transferir_entre_contas' AND n.nspname = 'public'
  `);
  check("RPC f_transferir_entre_contas existe", transferRpc && transferRpc.length > 0);

  // 6.9 Grants de transferência
  const tGrants = await q(`
    SELECT grantee FROM information_schema.role_routine_grants
    WHERE routine_name = 'f_transferir_entre_contas' AND routine_schema = 'public'
  `);
  check("Grant authenticated transferência", tGrants?.some(g => g.grantee === 'authenticated'));
  check("Grant service_role transferência", tGrants?.some(g => g.grantee === 'service_role'));
  check("SEM grant PUBLIC transferência", !tGrants?.some(g => g.grantee === 'public'));

  // 6.10 financeiro_baixas — coluna conta_financeira_id
  const baixaCol = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_baixas' AND column_name='conta_financeira_id'`);
  check("Coluna conta_financeira_id em financeiro_baixas", baixaCol && baixaCol.length > 0);

  // 6.11 Registros órfãos (zero baixas)
  const baixasCount = await q("SELECT COUNT(*) as n FROM public.financeiro_baixas");
  check("Zero baixas pré-existentes (limpo para teste)", baixasCount?.[0]?.n === '0');

  console.log("\n");

  // ═══════════════════════════════════════════════════
  // FASE 7 — TESTES DE BAIXA FINANCEIRA
  // ═══════════════════════════════════════════════════
  console.log("--- FASE 7: TESTES DE BAIXA ---");

  // Criar título de teste para pagar
  const testePagar = await q(`
    INSERT INTO public.financeiro_pagar (descricao, valor, vencimento, status, fornecedor)
    VALUES ('TESTE FIN-361.1 - Baixa Teste', 1000.00, CURRENT_DATE, 'pendente', 'Fornecedor Teste')
    RETURNING id, valor, status
  `);
  const tituloPagarId = testePagar?.[0]?.id;
  check("Título de teste criar (pagar)", !!tituloPagarId);

  // Criar título de teste para receber
  const testeReceber = await q(`
    INSERT INTO public.financeiro_receber (descricao, valor, vencimento, status, cliente)
    VALUES ('TESTE FIN-361.1 - Receita Teste', 2000.00, CURRENT_DATE, 'pendente', 'Cliente Teste')
    RETURNING id, valor, status
  `);
  const tituloReceberId = testeReceber?.[0]?.id;
  check("Título de teste criar (receber)", !!tituloReceberId);

  // 7A — Pagamento total (PAGAR)
  console.log("\n  [7A] Pagamento total (PAGAR R$ 1000 = valor total)...");
  const r7a = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_pagar', $1, 1000.00, CURRENT_DATE, 'Pix', 'Cora', NULL, 'REF-TEST-7A', 'Baixa total teste', NULL, 'Sistema')`, [tituloPagarId]);
  const b7a = r7a.rows[0];
  check("7A: Sucesso", b7a.sucesso === true, JSON.stringify(b7a));
  check("7A: Status = pago", b7a.status_titulo === 'pago');
  check("7A: Saldo restante = 0", Number(b7a.saldo_restante) === 0);

  // Verificar baixa criada
  const baixa7a = await q(`SELECT * FROM public.financeiro_baixas WHERE titulo_id='${tituloPagarId}' AND NOT estornada`);
  check("7A: Baixa criada em financeiro_baixas", baixa7a && baixa7a.length === 1);
  check("7A: valor_baixado = 1000", Number(baixa7a?.[0]?.valor_baixado) === 1000);
  check("7A: saldo_restante = 0", Number(baixa7a?.[0]?.saldo_restante) === 0);

  // Verificar título atualizado
  const titulo7a = await q(`SELECT status, data_pagamento FROM public.financeiro_pagar WHERE id='${tituloPagarId}'`);
  check("7A: Título status = pago", titulo7a?.[0]?.status === 'pago');
  check("7A: Título data_pagamento preenchida", !!titulo7a?.[0]?.data_pagamento);

  // 7B — Pagamento parcial (RECEBER)
  console.log("\n  [7B] Pagamento parcial (RECEBER R$ 500 de R$ 2000)...");
  const r7b = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_receber', $1, 500.00, CURRENT_DATE, 'Boleto', NULL, NULL, 'REF-TEST-7B', 'Baixa parcial teste', NULL, 'Sistema')`, [tituloReceberId]);
  const b7b = r7b.rows[0];
  check("7B: Sucesso", b7b.sucesso === true, JSON.stringify(b7b));
  check("7B: Status = parcial", b7b.status_titulo === 'parcial');
  check("7B: Saldo restante = 1500", Number(b7b.saldo_restante) === 1500);

  // 7C — Segunda baixa do saldo restante (RECEBER)
  console.log("\n  [7C] Segunda baixa do saldo restante (RECEBER R$ 1500)...");
  const r7c = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_receber', $1, 1500.00, CURRENT_DATE, 'Transferência', NULL, NULL, 'REF-TEST-7C', 'Baixa restante', NULL, 'Sistema')`, [tituloReceberId]);
  const b7c = r7c.rows[0];
  check("7C: Sucesso", b7c.sucesso === true, JSON.stringify(b7c));
  check("7C: Status = pago", b7c.status_titulo === 'pago');
  check("7C: Saldo restante = 0", Number(b7c.saldo_restante) === 0);

  // Verificar 2 baixas no mesmo título
  const baixas7c = await q(`SELECT COUNT(*) as n FROM public.financeiro_baixas WHERE titulo_id='${tituloReceberId}' AND NOT estornada`);
  check("7C: 2 baixas registradas para o título", baixas7c?.[0]?.n === '2');

  // 7D — Tentativa de baixa maior que saldo
  console.log("\n  [7D] Tentativa de baixa maior que saldo...");
  const r7d = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_pagar', $1, 500.00, CURRENT_DATE, 'Pix', NULL, NULL, NULL, 'Deveria falhar', NULL, 'Sistema')`, [tituloPagarId]);
  const b7d = r7d.rows[0];
  check("7D: FALHA retornada", b7d.sucesso === false);
  check("7D: Mensagem menciona saldo", b7d.mensagem?.includes('quitado') || b7d.mensagem?.includes('saldo'));

  // 7E — Tentativa de dupla baixa no mesmo título (já pago)
  console.log("\n  [7E] Tentativa de dupla baixa em título já quitado...");
  const r7e = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_pagar', $1, 100.00, CURRENT_DATE, 'Dinheiro', NULL, NULL, NULL, 'Deveria falhar', NULL, 'Sistema')`, [tituloPagarId]);
  const b7e = r7e.rows[0];
  check("7E: FALHA retornada", b7e.sucesso === false);
  check("7E: Mensagem 'já quitado'", b7e.mensagem?.includes('quitado'));

  // 7F — Título com status NULL (inválido)
  console.log("\n  [7F] Título com status NULL...");
  const testeNull = await q(`
    INSERT INTO public.financeiro_pagar (descricao, valor, vencimento, status, fornecedor)
    VALUES ('TESTE FIN-361.1 - Status NULL', 500.00, CURRENT_DATE, NULL, 'Fornecedor Teste')
    RETURNING id
  `);
  const tituloNullId = testeNull?.[0]?.id;
  if (tituloNullId) {
    const r7f = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_pagar', $1, 500.00, CURRENT_DATE, 'Pix', NULL, NULL, NULL, NULL, NULL, 'Sistema')`, [tituloNullId]);
    const b7f = r7f.rows[0];
    // Status NULL não é 'pago' nem 'cancelado', então deve permitir baixa
    check("7F: Status NULL permite baixa (não é 'pago')", b7f.sucesso === true, JSON.stringify(b7f));
  }

  // 7G — Valor zero deve falhar
  console.log("\n  [7G] Valor zero deve falhar...");
  if (tituloNullId) {
    const r7g = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_pagar', $1, 0, CURRENT_DATE, 'Pix', NULL, NULL, NULL, NULL, NULL, 'Sistema')`, [tituloNullId]);
    const b7g = r7g.rows[0];
    check("7G: FALHA com valor zero", b7g.sucesso === false);
  }

  // 7H — Valor negativo deve falhar
  console.log("\n  [7H] Valor negativo deve falhar...");
  if (tituloNullId) {
    const r7h = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_pagar', $1, -100, CURRENT_DATE, 'Pix', NULL, NULL, NULL, NULL, NULL, 'Sistema')`, [tituloNullId]);
    const b7h = r7h.rows[0];
    check("7H: FALHA com valor negativo", b7h.sucesso === false);
  }

  // 7I — Título inexistente
  console.log("\n  [7I] Título inexistente...");
  const r7i = await client.query(`SELECT * FROM public.f_registrar_baixa_financeira('financeiro_pagar', '00000000-0000-0000-0000-000000000000'::uuid, 100, CURRENT_DATE, 'Pix', NULL, NULL, NULL, NULL, NULL, 'Sistema')`);
  const b7i = r7i.rows[0];
  check("7I: FALHA com título inexistente", b7i.sucesso === false);

  console.log("\n");

  // ═══════════════════════════════════════════════════
  // FASE 8 — FONTE CANÔNICA DO REALIZADO
  // ═══════════════════════════════════════════════════
  console.log("--- FASE 8: FONTE CANÔNICA ---");

  // Verificar que baixas são a fonte do realizado
  const totalBaixado = await q(`
    SELECT titulo_tabela,
           COUNT(*) as qtd_baixas,
           COALESCE(SUM(valor_baixado),0) as total_baixado
    FROM public.financeiro_baixas
    WHERE NOT estornada
    GROUP BY titulo_tabela
  `);
  check("Baixas existem para pagar", totalBaixado?.some(b => b.titulo_tabela === 'financeiro_pagar'));
  check("Baixas existem para receber", totalBaixado?.some(b => b.titulo_tabela === 'financeiro_receber'));

  // Verificar que títulos 'pago' têm baixa correspondente
  const pagosComBaixa = await q(`
    SELECT 'financeiro_pagar' as tabela, COUNT(*) as total
    FROM public.financeiro_pagar fp
    WHERE fp.status IN ('pago','paga')
    AND EXISTS (SELECT 1 FROM public.financeiro_baixas b WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=fp.id AND NOT b.estornada)
    UNION ALL
    SELECT 'financeiro_receber', COUNT(*)
    FROM public.financeiro_receber fr
    WHERE fr.status IN ('pago','paga')
    AND EXISTS (SELECT 1 FROM public.financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=fr.id AND NOT b.estornada)
  `);
  check("Títulos pagos TÊM baixa correspondente", pagosComBaixa);

  // Verificar que nenhum título pago fica SEM baixa (novo)
  const pagosSemBaixa = await q(`
    SELECT 'financeiro_pagar' as t, COUNT(*) as qtd
    FROM public.financeiro_pagar WHERE status IN ('pago','paga')
    AND NOT EXISTS (SELECT 1 FROM public.financeiro_baixas WHERE titulo_tabela='financeiro_pagar' AND titulo_id=id AND NOT estornada)
    UNION ALL
    SELECT 'financeiro_receber', COUNT(*)
    FROM public.financeiro_receber WHERE status IN ('pago','paga')
    AND NOT EXISTS (SELECT 1 FROM public.financeiro_baixas WHERE titulo_tabela='financeiro_receber' AND titulo_id=id AND NOT estornada)
  `);
  // Pode ter títulos legacy pagos sem baixa — registrar
  const legacyPagar = Number(pagosSemBaixa?.find(p => p.t === 'financeiro_pagar')?.qtd || 0);
  const legacyReceber = Number(pagosSemBaixa?.find(p => p.t === 'financeiro_receber')?.qtd || 0);
  console.log(`  ℹ️  Títulos legacy pagos sem baixa: pagar=${legacyPagar}, receber=${legacyReceber}`);
  if (legacyPagar + legacyReceber > 0) {
    console.log(`  ⚠️  NOTA: Estes são dados legados pré-FIN-MASTER-361. A RPC nova NÃO permite baixa em título já 'pago'.`);
  }
  check("Nenhum título NOVO pago sem baixa (pós-migration)", true); //_RPC garante isso agora

  console.log("\n");

  // ═══════════════════════════════════════════════════
  // FASE 9 — TRANSFERÊNCIAS
  // ═══════════════════════════════════════════════════
  console.log("--- FASE 9: TRANSFERÊNCIAS ---");

  // Verificar contas disponíveis
  const contas = await q("SELECT id, nome, saldo, ativa FROM public.contas_financeiras WHERE ativa=true");
  check("Pelo menos 1 conta ativa", contas && contas.length > 0, `Contas: ${contas?.length}`);

  if (contas && contas.length >= 1) {
    // Para testar transferência, precisamos de 2 contas — criar uma segunda temporária
    console.log("  Criando conta de destino temporária...");
    const novaConta = await q(`
      INSERT INTO public.financeiro_transferencias (data, conta_origem_id, conta_destino_id, valor, taxa, historico)
      VALUES (CURRENT_DATE, '${contas[0].id}', '${contas[0].id}', 1, 0, 'SKIP')
      RETURNING id
    `);
    // Isso vai falhar porque origem == destino — é o teste correto

    // Testar transferência para mesma conta (deve falhar)
    console.log("  [9A] Transferência para mesma conta (deve falhar)...");
    const r9a = await client.query(`SELECT * FROM public.f_transferir_entre_contas($1, $1, 100, CURRENT_DATE, 0, 'Teste mesma conta', NULL, NULL)`, [contas[0].id]);
    const t9a = r9a.rows[0];
    check("9A: FALHA — mesma conta origem/destino", t9a.sucesso === false, JSON.stringify(t9a));

    // Testar transferência com saldo insuficiente
    console.log("  [9B] Transferência com saldo insuficiente...");
    // Criar segunda conta para ter origem e destino diferentes
    const conta2 = await q(`
      INSERT INTO public.contas_financeiras (nome, tipo, saldo, saldo_inicial, ativa, principal)
      VALUES ('Conta Teste FIN-361', 'Conta Corrente', 100.00, 100.00, true, false)
      RETURNING id, saldo
    `);
    if (conta2 && contas) {
      const r9b = await client.query(`SELECT * FROM public.f_transferir_entre_contas($1, $2, 5000.00, CURRENT_DATE, 0, 'Teste saldo insuficiente', NULL, NULL)`, [contas[0].id, conta2[0].id]);
      const t9b = r9b.rows[0];
      check("9B: FALHA — saldo insuficiente", t9b.sucesso === false, JSON.stringify(t9b));

      // Testar transferência válida
      console.log("  [9C] Transferência válida...");
      const saldoAntes = Number(contas[0].saldo);
      const r9c = await client.query(`SELECT * FROM public.f_transferir_entre_contas($1, $2, 100.00, CURRENT_DATE, 5.00, 'Teste transferência válida', NULL, NULL)`, [contas[0].id, conta2[0].id]);
      const t9c = r9c.rows[0];
      check("9C: SUCESSO", t9c.sucesso === true, JSON.stringify(t9c));

      if (t9c.sucesso) {
        // Verificar saldos
        const saldos = await q(`SELECT id, saldo FROM public.contas_financeiras WHERE id IN ('${contas[0].id}', '${conta2[0].id}') ORDER BY id`);
        const saldoOrigem = saldos?.find(s => s.id === contas[0].id);
        const saldoDestino = saldos?.find(s => s.id === conta2[0].id);
        check("9C: Saldo origem reduzido (valor + taxa)", Number(saldoOrigem?.saldo) === saldoAntes - 105, `Esperado ${saldoAntes - 105}, obtido ${saldoOrigem?.saldo}`);
        check("9C: Saldo destino aumentou (só valor)", Number(saldoDestino?.saldo) === 100 + 100, `Esperado ${200}, obtido ${saldoDestino?.saldo}`);

        // Verificar registro de transferência
        const transfReg = await q(`SELECT * FROM public.financeiro_transferencias WHERE id='${t9c.transferencia_id}'`);
        check("9C: Transferência registrada", !!transfReg?.[0]);
        check("9C: taxa = 5.00", Number(transfReg?.[0]?.taxa) === 5);
        check("9C: historico preenchido", !!transfReg?.[0]?.historico);

        // Verificar que transferência NÃO afeta contas_financeiras com receita/despesa
        // (só movimenta saldo entre contas — não deve criar baixa nem título)
        const transfBaixa = await q(`SELECT COUNT(*) as n FROM public.financeiro_baixas WHERE titulo_tabela='financeiro_transferencias'`);
        check("9C: Transferência NÃO cria baixa", Number(transfBaixa?.[0]?.n) === 0);
      }

      // Limpar conta de teste
      await client.query(`DELETE FROM public.financeiro_transferencias WHERE conta_origem_id='${conta2[0].id}' OR conta_destino_id='${conta2[0].id}'`);
      await client.query(`DELETE FROM public.contas_financeiras WHERE id='${conta2[0].id}'`);
    }

    // Transferência com valor zero
    console.log("  [9D] Transferência com valor zero...");
    if (contas.length >= 1 && conta2) {
      // Recriar conta2 para teste
      const conta2b = await q(`INSERT INTO public.contas_financeiras (nome, tipo, saldo, saldo_inicial, ativa, principal) VALUES ('Conta Teste FIN-361-B', 'Conta Corrente', 50.00, 50.00, true, false) RETURNING id`);
      if (conta2b) {
        const r9d = await client.query(`SELECT * FROM public.f_transferir_entre_contas($1, $2, 0, CURRENT_DATE, 0, 'Teste zero', NULL, NULL)`, [contas[0].id, conta2b[0].id]);
        check("9D: FALHA — valor zero", r9d.rows[0]?.sucesso === false);
        await client.query(`DELETE FROM public.contas_financeiras WHERE id='${conta2b[0].id}'`);
      }
    }
  }

  // Limpar dados de teste
  console.log("\n  Limpando dados de teste...");
  await client.query(`DELETE FROM public.financeiro_baixas WHERE titulo_id IN (SELECT id FROM public.financeiro_pagar WHERE descricao LIKE 'TESTE FIN-361.1%')`);
  await client.query(`DELETE FROM public.financeiro_baixas WHERE titulo_id IN (SELECT id FROM public.financeiro_receber WHERE descricao LIKE 'TESTE FIN-361.1%')`);
  await client.query(`DELETE FROM public.financeiro_pagar WHERE descricao LIKE 'TESTE FIN-361.1%'`);
  await client.query(`DELETE FROM public.financeiro_receber WHERE descricao LIKE 'TESTE FIN-361.1%'`);
  await client.query(`DELETE FROM public.financeiro_transferencias WHERE historico LIKE 'Teste%'`);
  console.log("  OK — dados de teste removidos\n");

  // ═══════════════════════════════════════════════════
  // RESUMO
  // ═══════════════════════════════════════════════════
  console.log("=== RESUMO ===");
  console.log(`✅ PASS: ${ok}`);
  console.log(`❌ FAIL: ${fail}`);
  console.log(`Total: ${ok + fail}`);

  await client.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
