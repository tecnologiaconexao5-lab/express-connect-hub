// FIN-MASTER-361.1 — Pre-flight do banco real
// Coleta estado ANTES da migration para gate de segurança
import pg from "pg";

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error("DATABASE_URL não definida"); process.exit(1); }

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function query(sql, label) {
  try {
    const r = await client.query(sql);
    return r.rows;
  } catch (e) {
    console.error(`[ERRO] ${label}: ${e.message}`);
    return null;
  }
}

async function main() {
  await client.connect();
  console.log("=== FIN-MASTER-361.1 PRE-FLIGHT ===\n");

  // 1. Confirmação do projeto
  const proj = await query("SELECT current_database(), version()", "projeto");
  console.log("1. PROJETO:");
  console.log(JSON.stringify(proj, null, 2));

  // 2. Estado atual de f_registrar_baixa_financeira
  const rpc = await query(`
    SELECT p.proname, pg_get_function_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as ret,
           p.prosecdef as security_definer,
           p.provolatile as volatility
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'f_registrar_baixa_financeira'
    AND n.nspname = 'public'
    ORDER BY p.oid
  `, "rpc_baixa");
  console.log("\n2. RPC f_registrar_baixa_financeira (ANTES):");
  console.log(JSON.stringify(rpc, null, 2));

  // 3. Grants atuais da RPC
  const rpcGrants = await query(`
    SELECT grantee, privilege_type
    FROM information_schema.role_routine_grants
    WHERE routine_name = 'f_registrar_baixa_financeira'
    AND routine_schema = 'public'
    ORDER BY grantee
  `, "rpc_grants");
  console.log("\n3. GRANTS f_registrar_baixa_financeira (ANTES):");
  console.log(JSON.stringify(rpcGrants, null, 2));

  // 4. Existência de f_transferir_entre_contas
  const transferRpc = await query(`
    SELECT p.proname, pg_get_function_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'f_transferir_entre_contas'
    AND n.nspname = 'public'
  `, "transfer_rpc");
  console.log("\n4. RPC f_transferir_entre_contas (ANTES):");
  console.log(JSON.stringify(transferRpc, null, 2));

  // 5. Existência de financeiro_transferencias
  const transfTable = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'financeiro_transferencias'
    ) as existe
  `, "transf_table");
  console.log("\n5. Tabela financeiro_transferencias (ANTES):");
  console.log(JSON.stringify(transfTable, null, 2));

  // 6. Contas financeiras
  const contas = await query(`
    SELECT id, nome, saldo, ativa, tipo_conta
    FROM public.contas_financeiras
    ORDER BY nome
  `, "contas");
  console.log("\n6. contas_financeiras:");
  console.log(JSON.stringify(contas, null, 2));

  // 7. financeiro_baixas
  const baixasCount = await query("SELECT COUNT(*) as total FROM public.financeiro_baixas", "baixas_count");
  const baixasEstorno = await query("SELECT COUNT(*) as estornadas FROM public.financeiro_baixas WHERE estornada = true", "baixas_estorno");
  const baixasNullValor = await query("SELECT COUNT(*) as nulos FROM public.financeiro_baixas WHERE valor_baixado IS NULL", "baixas_null");
  console.log("\n7. financeiro_baixas:");
  console.log("  Total:", JSON.stringify(baixasCount));
  console.log("  Estornadas:", JSON.stringify(baixasEstorno));
  console.log("  Valor NULL:", JSON.stringify(baixasNullValor));

  // 8. Colunas de financeiro_baixas
  const baixasCols = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financeiro_baixas'
    ORDER BY ordinal_position
  `, "baixas_cols");
  console.log("\n8. Colunas financeiro_baixas:");
  console.log(JSON.stringify(baixasCols, null, 2));

  // 9. financeiro_pagar
  const pagarCount = await query("SELECT COUNT(*) as total FROM public.financeiro_pagar", "pagar_count");
  const pagarStatus = await query("SELECT status, COUNT(*) as qtd FROM public.financeiro_pagar GROUP BY status ORDER BY qtd DESC", "pagar_status");
  const pagarNullValor = await query("SELECT COUNT(*) as nulos FROM public.financeiro_pagar WHERE valor IS NULL", "pagar_null_valor");
  const pagarNullFornecedor = await query("SELECT COUNT(*) as nulos FROM public.financeiro_pagar WHERE fornecedor_id IS NULL", "pagar_null_forn");
  console.log("\n9. financeiro_pagar:");
  console.log("  Total:", JSON.stringify(pagarCount));
  console.log("  Por status:", JSON.stringify(pagarStatus, null, 2));
  console.log("  Valor NULL:", JSON.stringify(pagarNullValor));
  console.log("  Fornecedor NULL:", JSON.stringify(pagarNullFornecedor));

  // 10. Colunas de financeiro_pagar
  const pagarCols = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financeiro_pagar'
    ORDER BY ordinal_position
  `, "pagar_cols");
  console.log("\n10. Colunas financeiro_pagar:");
  console.log(JSON.stringify(pagarCols, null, 2));

  // 11. financeiro_receber
  const receberCount = await query("SELECT COUNT(*) as total FROM public.financeiro_receber", "receber_count");
  const receberStatus = await query("SELECT status, COUNT(*) as qtd FROM public.financeiro_receber GROUP BY status ORDER BY qtd DESC", "receber_status");
  const receberNullValor = await query("SELECT COUNT(*) as nulos FROM public.financeiro_receber WHERE valor IS NULL", "receber_null");
  console.log("\n11. financeiro_receber:");
  console.log("  Total:", JSON.stringify(receberCount));
  console.log("  Por status:", JSON.stringify(receberStatus, null, 2));
  console.log("  Valor NULL:", JSON.stringify(receberNullValor));

  // 12. Colunas de financeiro_receber
  const receberCols = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financeiro_receber'
    ORDER BY ordinal_position
  `, "receber_cols");
  console.log("\n12. Colunas financeiro_receber:");
  console.log(JSON.stringify(receberCols, null, 2));

  // 13. Constraints de financeiro_pagar (UNIQUE, FK)
  const pagarConstraints = await query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.financeiro_pagar'::regclass
    ORDER BY contype
  `, "pagar_constraints");
  console.log("\n13. Constraints financeiro_pagar:");
  console.log(JSON.stringify(pagarConstraints, null, 2));

  // 14. Constraints de financeiro_receber
  const receberConstraints = await query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.financeiro_receber'::regclass
    ORDER BY contype
  `, "receber_constraints");
  console.log("\n14. Constraints financeiro_receber:");
  console.log(JSON.stringify(receberConstraints, null, 2));

  // 15. Baixas sem título
  const baixasOrfas = await query(`
    SELECT COUNT(*) as orfas FROM public.financeiro_baixas b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagar WHERE id = b.titulo_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_receber WHERE id = b.titulo_id
    )
  `, "baixas_orfas");
  console.log("\n15. Baixas sem título válido (órfãs):");
  console.log(JSON.stringify(baixasOrfas, null, 2));

  // 16. Títulos com status 'pago'/'paga' mas sem baixa
  const pagosSemBaixa = await query(`
    SELECT 'financeiro_pagar' as tabela, COUNT(*) as qtd
    FROM public.financeiro_pagar fp
    WHERE fp.status IN ('pago','paga')
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_baixas b
      WHERE b.titulo_tabela = 'financeiro_pagar' AND b.titulo_id = fp.id AND NOT b.estornada
    )
    UNION ALL
    SELECT 'financeiro_receber', COUNT(*)
    FROM public.financeiro_receber fr
    WHERE fr.status IN ('pago','paga')
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_baixas b
      WHERE b.titulo_tabela = 'financeiro_receber' AND b.titulo_id = fr.id AND NOT b.estornada
    )
  `, "pagos_sem_baixa");
  console.log("\n16. Títulos com status pago mas SEM baixa registrada:");
  console.log(JSON.stringify(pagosSemBaixa, null, 2));

  // 17. Duplicidade de baixa
  const duplicidade = await query(`
    SELECT titulo_tabela, titulo_id, COUNT(*) as qtd_baixas
    FROM public.financeiro_baixas
    WHERE NOT estornada
    GROUP BY titulo_tabela, titulo_id
    HAVING COUNT(*) > 1
  `, "duplicidade");
  console.log("\n17. Títulos com múltiplas baixas (possível duplicidade):");
  console.log(JSON.stringify(duplicidade, null, 2));

  // 18. Registros com valor negativo inesperado
  const negativos = await query(`
    SELECT 'financeiro_pagar' as tabela, COUNT(*) as negativos
    FROM public.financeiro_pagar WHERE valor < 0
    UNION ALL
    SELECT 'financeiro_receber', COUNT(*)
    FROM public.financeiro_receber WHERE valor < 0
    UNION ALL
    SELECT 'financeiro_baixas', COUNT(*)
    FROM public.financeiro_baixas WHERE valor_baixado < 0
  `, "negativos");
  console.log("\n18. Registros com valor negativo:");
  console.log(JSON.stringify(negativos, null, 2));

  // 19. Triggers envolvidos
  const triggers = await query(`
    SELECT t.tgname, t.tgenabled,
           c.relname as tabela,
           p.proname as funcao
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND c.relname IN ('financeiro_pagar','financeiro_receber','financeiro_baixas','contas_financeiras')
    AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `, "triggers");
  console.log("\n19. Triggers nas tabelas financeiras:");
  console.log(JSON.stringify(triggers, null, 2));

  // 20. Colunas de contas_financeiras
  const contasCols = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contas_financeiras'
    ORDER BY ordinal_position
  `, "contas_cols");
  console.log("\n20. Colunas contas_financeiras:");
  console.log(JSON.stringify(contasCols, null, 2));

  // 21. Colunas de faturas
  const faturasCols = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'faturas'
    ORDER BY ordinal_position
  `, "faturas_cols");
  console.log("\n21. Colunas faturas:");
  console.log(JSON.stringify(faturasCols, null, 2));

  // 22. Colunas de fatura_itens
  const faturaItensCols = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fatura_itens'
    ORDER BY ordinal_position
  `, "fatura_itens_cols");
  console.log("\n22. Colunas fatura_itens:");
  console.log(JSON.stringify(faturaItensCols, null, 2));

  // 23. Verificar se RLS está ativo em financeiro_transferencias (antes = não existe)
  const rlsCheck = await query(`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname = 'financeiro_transferencias'
  `, "rls_check");
  console.log("\n23. RLS financeiro_transferencias (ANTES):");
  console.log(JSON.stringify(rlsCheck, null, 2));

  // 24. Resumo financeiro consolidado
  const resumo = await query(`
    SELECT
      (SELECT COUNT(*) FROM public.financeiro_pagar WHERE status IN ('pendente','pendente_pgto')) as pagar_pendente,
      (SELECT COUNT(*) FROM public.financeiro_pagar WHERE status IN ('pago','paga','parcial')) as pagar_pago,
      (SELECT COUNT(*) FROM public.financeiro_pagar WHERE status IN ('cancelado','cancelada')) as pagar_cancelado,
      (SELECT COUNT(*) FROM public.financeiro_receber WHERE status IN ('pendente','emitida')) as receber_pendente,
      (SELECT COUNT(*) FROM public.financeiro_receber WHERE status IN ('pago','paga','parcial')) as receber_pago,
      (SELECT COUNT(*) FROM public.financeiro_receber WHERE status IN ('cancelado','cancelada')) as receber_cancelado,
      (SELECT COALESCE(SUM(valor),0) FROM public.financeiro_pagar WHERE status IN ('pendente','pendente_pgto')) as pagar_valor_pendente,
      (SELECT COALESCE(SUM(valor_baixado),0) FROM public.financeiro_baixas WHERE titulo_tabela='financeiro_pagar' AND NOT estornada) as pagar_total_baixado,
      (SELECT COALESCE(SUM(valor),0) FROM public.financeiro_receber WHERE status IN ('pendente','emitida')) as receber_valor_pendente,
      (SELECT COALESCE(SUM(valor_baixado),0) FROM public.financeiro_baixas WHERE titulo_tabela='financeiro_receber' AND NOT estornada) as receber_total_baixado
  `, "resumo");
  console.log("\n24. Resumo financeiro consolidado:");
  console.log(JSON.stringify(resumo, null, 2));

  console.log("\n=== PRE-FLIGHT CONCLUÍDO ===");
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
