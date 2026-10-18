import pg from "pg";
import "dotenv/config";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function q(sql, params) {
  const r = await c.query(sql, params);
  return r.rows;
}

async function main() {
  await c.connect();

  // ── A) Estrutura (read-only) ──
  const tbl = await q("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='financeiro_baixas'");
  console.log("1) tabela + RLS:", JSON.stringify(tbl));
  if (tbl.length !== 1 || tbl[0].rowsecurity !== true) throw new Error("Tabela/RLS não criados corretamente");

  const pols = await q("SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='financeiro_baixas' ORDER BY policyname");
  console.log("2) policies:", JSON.stringify(pols));
  const hasAnon = pols.some((p) => String(p.roles).includes("anon") || String(p.roles).includes("public"));
  if (hasAnon) throw new Error("EXISTE policy anon/public em financeiro_baixas!");
  const hasDelete = pols.some((p) => p.cmd === "DELETE");
  if (hasDelete) throw new Error("EXISTE policy DELETE em financeiro_baixas!");

  const grantsTbl = await q(
    "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='financeiro_baixas' AND grantee IN ('authenticated','service_role','anon') ORDER BY grantee, privilege_type"
  );
  console.log("3) grants tabela:", JSON.stringify(grantsTbl));
  if (grantsTbl.some((g) => g.grantee === "anon")) throw new Error("anon tem grant na tabela!");

  const rpcPrivs = await q(
    "SELECT p.proname, g.grantee, g.privilege_type FROM pg_proc p JOIN information_schema.routine_privileges g ON g.routine_name = p.proname WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('f_registrar_baixa_financeira','f_estornar_baixa_financeira') ORDER BY p.proname, g.grantee"
  );
  console.log("4) grants RPCs:", JSON.stringify(rpcPrivs));
  const anonRpc = rpcPrivs.some((r) => r.grantee === "anon");
  const pubRpc = rpcPrivs.some((r) => r.grantee === "PUBLIC");
  if (anonRpc || pubRpc) throw new Error("RPCs com grant PUBLIC/anon!");

  const trg = await q("SELECT tgname FROM pg_trigger WHERE tgrelid='public.financeiro_baixas'::regclass AND NOT tgisinternal");
  console.log("5) triggers:", JSON.stringify(trg));

  const consts = await q(
    "SELECT conname FROM pg_constraint WHERE conrelid='public.financeiro_baixas'::regclass AND contype='c' ORDER BY conname"
  );
  console.log("6) check constraints:", JSON.stringify(consts));

  const fks = await q(
    "SELECT conname FROM pg_constraint WHERE contype='f' AND (conrelid='public.financeiro_baixas'::regclass OR confrelid='public.financeiro_baixas'::regclass)"
  );
  console.log("7) FKs envolvendo financeiro_baixas:", JSON.stringify(fks));
  if (fks.length > 0) throw new Error("FK fixa criada (mission exige vínculo polimórfico sem FK)!");

  const fkpagar = await q("SELECT conname FROM pg_constraint WHERE contype='f' AND confrelid='public.financeiro_pagar'::regclass");
  console.log("8) FKs existentes para financeiro_pagar (antes):", JSON.stringify(fkpagar));

  const before = await q("SELECT COUNT(*)::int AS n FROM public.financeiro_pagar");
  console.log("9) financeiro_pagar COUNT antes:", before[0].n);

  // ── B) Teste transacional da matemática (BEGIN/ROLLBACK — zero footprint) ──
  const mathSql = `
  BEGIN;
  CREATE TEMP TABLE _f0c4_results (chk text PRIMARY KEY, ok boolean NOT NULL, detail text) ON COMMIT DROP;
  DO $$
  DECLARE
    t1 uuid; t2 uuid; t3 uuid;
    r RECORD;
    baixa1 uuid; baixa2 uuid; baixa3 uuid;
    n int;
  BEGIN
    INSERT INTO public.financeiro_pagar (descricao, valor, valor_bruto, valor_liquido, fornecedor, data_vencimento, status, observacoes)
    VALUES ('[F0C4-TESTE] Titulo 1000', 1000, 1000, 1000, 'Fornecedor F0C4', CURRENT_DATE, 'aberto', '[F0C4-MARK]')
    RETURNING id INTO t1;

    INSERT INTO public.financeiro_pagar (descricao, valor, valor_bruto, valor_liquido, fornecedor, data_vencimento, status, observacoes)
    VALUES ('[F0C4-TESTE] Titulo Multiplo 700', 700, 700, 700, 'Fornecedor F0C4', CURRENT_DATE, 'aberto', '[F0C4-MARK]')
    RETURNING id INTO t2;

    INSERT INTO public.financeiro_pagar (descricao, valor, valor_bruto, valor_liquido, fornecedor, data_vencimento, status, observacoes)
    VALUES ('[F0C4-TESTE] Titulo Cancelado', 500, 500, 500, 'Fornecedor F0C4', CURRENT_DATE, 'cancelado', '[F0C4-MARK]')
    RETURNING id INTO t3;

    -- 1) baixa 300 (parcial)
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t1, 300, CURRENT_DATE, 'pix', 'CC Principal', NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('baixa1_300', r.sucesso AND r.saldo_restante=700 AND r.status_titulo='parcial', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);
    baixa1 := r.baixa_id;

    -- 2) segunda baixa 200 (múltiplas parciais)
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t1, 200, CURRENT_DATE, 'ted', 'CC Principal', 'REF-X', NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('baixa2_200', r.sucesso AND r.saldo_restante=500 AND r.status_titulo='parcial', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);
    baixa2 := r.baixa_id;

    -- 3) baixa 500 (quita)
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t1, 500, CURRENT_DATE, 'dinheiro', 'CC Principal', NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('baixa3_500_pago', r.sucesso AND r.saldo_restante=0 AND r.status_titulo='pago', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);
    baixa3 := r.baixa_id;

    -- 4) nova baixa em quitado -> rejeitada
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t1, 100, CURRENT_DATE, 'pix', 'CC Principal', NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('baixa_apos_quitado', (NOT r.sucesso) AND (r.mensagem ILIKE '%quitado%' OR r.mensagem ILIKE '%saldo%'), 'sucesso='||r.sucesso||' msg='||r.mensagem);

    -- 5) baixa > saldo -> rejeitada
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t2, 800, CURRENT_DATE, 'pix', NULL, NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('baixa_excede_saldo', (NOT r.sucesso) AND (r.mensagem ILIKE '%excede%' OR r.mensagem ILIKE '%saldo%'), 'sucesso='||r.sucesso||' msg='||r.mensagem);

    -- 6) baixa <= 0 -> rejeitada
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t2, 0, CURRENT_DATE, NULL, NULL, NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('baixa_zero', (NOT r.sucesso) AND r.mensagem ILIKE '%maior que zero%', 'sucesso='||r.sucesso||' msg='||r.mensagem);

    -- 7) múltiplas parciais num título sem parciais (300 + 400 = 700 = pago)
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t2, 300, CURRENT_DATE, 'pix', 'CC Principal', NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('multi_parcial_1', r.sucesso AND r.saldo_restante=400 AND r.status_titulo='parcial', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t2, 400, CURRENT_DATE, 'pix', 'CC Principal', NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('multi_parcial_2_pago', r.sucesso AND r.saldo_restante=0 AND r.status_titulo='pago', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);

    -- 8) baixa em título cancelado -> rejeitada
    SELECT * INTO r FROM public.f_registrar_baixa_financeira('financeiro_pagar', t3, 100, CURRENT_DATE, 'pix', NULL, NULL, NULL, NULL, NULL);
    INSERT INTO _f0c4_results VALUES ('baixa_cancelado', (NOT r.sucesso) AND r.mensagem ILIKE '%cancelad%', 'sucesso='||r.sucesso||' msg='||r.mensagem);

    -- 9) estorno da baixa2 (200) de título pago -> volta para parcial (saldo 200)
    SELECT * INTO r FROM public.f_estornar_baixa_financeira(baixa2, 'teste estorno');
    INSERT INTO _f0c4_results VALUES ('estorno_parcial', r.sucesso AND r.saldo_restante=200 AND r.status_titulo='parcial', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);

    -- 10) estorno da baixa3 (500) -> resta 300 (parcial)
    SELECT * INTO r FROM public.f_estornar_baixa_financeira(baixa3, 'teste estorno 2');
    INSERT INTO _f0c4_results VALUES ('estorno_resta_300', r.sucesso AND r.saldo_restante=700 AND r.status_titulo='parcial', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);

    -- 11) estorno da baixa1 (300) -> sem baixas válidas, título aberto
    SELECT * INTO r FROM public.f_estornar_baixa_financeira(baixa1, 'teste estorno 3');
    INSERT INTO _f0c4_results VALUES ('estorno_aberto', r.sucesso AND r.saldo_restante=1000 AND r.status_titulo='aberto', 'sucesso='||r.sucesso||' saldo='||r.saldo_restante||' status='||r.status_titulo||' msg='||r.mensagem);

    -- 12) registros preservados (nenhum DELETE): 3 baixas, todas estornadas
    SELECT COUNT(*) INTO n FROM public.financeiro_baixas WHERE titulo_id = t1;
    INSERT INTO _f0c4_results VALUES ('baixas_preservadas', n = 3, 'n='||n);
    SELECT COUNT(*) INTO n FROM public.financeiro_baixas WHERE titulo_id = t1 AND estornada;
    INSERT INTO _f0c4_results VALUES ('todas_estornadas', n = 3, 'n='||n);

    -- 13) título após todos os estornos: aberto e sem datas de pagamento
    SELECT COUNT(*) INTO n FROM public.financeiro_pagar WHERE id = t1 AND status='aberto' AND data_pagamento IS NULL AND data_efetiva_pgto IS NULL;
    INSERT INTO _f0c4_results VALUES ('titulo_aberto_limpo', n = 1, 'n='||n);

    -- 14) forma/conta/referencia persistidas na baixa
    SELECT COUNT(*) INTO n FROM public.financeiro_baixas WHERE titulo_id = t2 AND forma_pagamento='pix' AND conta_financeira='CC Principal';
    INSERT INTO _f0c4_results VALUES ('forma_conta_persistidas', n >= 2, 'n='||n);
    SELECT COUNT(*) INTO n FROM public.financeiro_baixas WHERE titulo_id = t1 AND forma_pagamento='ted' AND conta_financeira='CC Principal' AND referencia_bancaria='REF-X';
    INSERT INTO _f0c4_results VALUES ('referencia_persistida', n = 1, 'n='||n);
  END $$;
  SELECT chk, ok, detail FROM _f0c4_results ORDER BY chk;
  ROLLBACK;
  `;
  const math = await c.query(mathSql);
  const rows = math[math.length - 1].rows;
  console.log("10) teste transacional (BEGIN/ROLLBACK):");
  let allOk = true;
  for (const row of rows) {
    const ok = row.ok === true || row.ok === "true" || row.ok === true;
    if (!ok) allOk = false;
    console.log(`   ${row.chk}: ${ok ? "OK" : "FALHOU"} -> ${row.detail}`);
  }
  if (!allOk) throw new Error("Testes transacionais falharam");

  // ── C) Zero footprint pós-teste ──
  const after = await q("SELECT COUNT(*)::int AS n FROM public.financeiro_pagar");
  const phantom = await q("SELECT COUNT(*)::int AS n FROM public.financeiro_pagar WHERE observacoes LIKE '%F0C4-MARK%' OR descricao LIKE '%F0C4-TESTE%'");
  const baixas = await q("SELECT COUNT(*)::int AS n FROM public.financeiro_baixas");
  console.log("11) financeiro_pagar COUNT depois:", after[0].n, "| phantoms:", phantom[0].n, "| financeiro_baixas:", baixas[0].n);
  if (after[0].n !== before[0].n) throw new Error("Quantidade de títulos mudou (footprint!)");
  if (phantom[0].n !== 0) throw new Error("Registros fictícios persistentes detectados!");
  if (baixas[0].n !== 0) throw new Error("Baixas fictícias persistentes detectadas!");

  console.log("\nVALIDACAO F0-C4: TODAS AS CHECAGENS PASSARAM");
  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});