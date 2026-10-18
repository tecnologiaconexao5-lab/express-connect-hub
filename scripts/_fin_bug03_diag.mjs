/**
 * FIN-BUG-03 — Diagnóstico READ-ONLY do fluxo Rascunho -> Aprovada -> Emitida.
 * NÃO altera nenhum dado (apenas SELECT).
 * Saida: scripts\_fin_bug03_diag.json
 */
import fs from "node:fs";
import { Client } from "pg";

const DB = (fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1];
if (!DB) { console.error("DATABASE_URL ausente no .env"); process.exit(1); }

const out = { ts: new Date().toISOString(), checks: [] };
const add = (name, ok, detail) => {
  out.checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"} ${name} — ${detail}`);
};

const pg = new Client({ connectionString: DB.trim() });
await pg.connect();

// 1) Existem as 3 funcoes?
const fns = await pg.query(`
  SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
         (p.prosrc LIKE '%FATURA_NAO_APROVADA%') AS tem_guarda_aprovada,
         (p.prosrc LIKE '%SEM_PERMISSAO_PERFIL%') AS tem_guarda_perfil,
         (p.prosrc LIKE '%TRANSICAO_INVALIDA%') AS tem_transicoes,
         p.provolatile AS vol, p.prosecdef AS definer
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname IN
    ('f_mover_fatura_status','f_emitir_fatura','f_gerar_numero_fatura')
  ORDER BY p.proname`);
out.funcoes = fns.rows;
add("1_existe_f_mover_fatura_status", fns.rows.some(r => r.proname === "f_mover_fatura_status"),
  JSON.stringify(fns.rows.filter(r => r.proname === "f_mover_fatura_status")));
add("1_existe_f_emitir_fatura", fns.rows.some(r => r.proname === "f_emitir_fatura"),
  JSON.stringify(fns.rows.filter(r => r.proname === "f_emitir_fatura")));
add("1_existe_f_gerar_numero_fatura", fns.rows.some(r => r.proname === "f_gerar_numero_fatura"), "sequencial FAT-YYYY-XXXXXX");
const emitir = fns.rows.find(r => r.proname === "f_emitir_fatura");
add("1b_emitir_exige_aprovada (FAT-URG-04)", !!emitir?.tem_guarda_aprovada,
  emitir ? `tem guarda FATURA_NAO_APROVADA = ${emitir.tem_guarda_aprovada}` : "funcao ausente");
const mover = fns.rows.find(r => r.proname === "f_mover_fatura_status");
add("1c_mover_tem_transicoes_e_perfil", !!mover && mover.tem_transicoes && mover.tem_guarda_perfil,
  mover ? `transicoes=${mover.tem_transicoes} perfil=${mover.tem_guarda_perfil}` : "funcao ausente");

// 2) Contagem de faturas por status
const byStatus = await pg.query(`SELECT status, count(*)::int AS qtd FROM public.faturas GROUP BY status ORDER BY status`);
out.faturas_por_status = byStatus.rows;
add("2_tem_faturas_rascunho", byStatus.rows.some(r => r.status === "rascunho"), JSON.stringify(byStatus.rows));

// 3) Faturas manuais recentes (origem manual) com status/numero
const manuais = await pg.query(`
  SELECT id, status, numero, numero_cliente, cliente_id, valor_total,
         metadata->>'numeroManual' AS numero_manual, metadata->>'origem' AS origem,
         criado_em, atualizado_em
  FROM public.faturas
  WHERE metadata->>'origem' = 'manual' OR metadata ? 'numeroManual'
  ORDER BY criado_em DESC LIMIT 15`);
out.faturas_manuais = manuais.rows;
add("3_faturas_manuais_listadas", manuais.rows.length >= 0, `${manuais.rows.length} faturas manuais recentes`);

// 4) Manuais travadas (sem numero, status nao emitida)
const travadas = await pg.query(`
  SELECT status, count(*)::int AS qtd FROM public.faturas
  WHERE (metadata->>'origem' = 'manual' OR metadata ? 'numeroManual') AND numero IS NULL
  GROUP BY status ORDER BY status`);
out.manuais_sem_numero = travadas.rows;
add("4_manuais_sem_numero", true, JSON.stringify(travadas.rows));

// 5) Perfis autorizados (quem pode aprovar)
const perfis = await pg.query(`
  SELECT u.email, tu.papel, tu.status, tu.tenant_id
  FROM public.tenant_usuarios tu LEFT JOIN auth.users u ON u.id = tu.user_id
  ORDER BY tu.papel, u.email LIMIT 30`);
out.tenant_usuarios = perfis.rows;
const autorizados = perfis.rows.filter(r => ["super_admin","admin_tenant","financeiro"].includes(r.papel) && r.status === "ativo");
add("5_ha_perfis_autorizados", autorizados.length > 0, `${autorizados.length} perfis (super_admin/admin_tenant/financeiro) ativos: ${autorizados.map(a => `${a.email||"?"}(${a.papel})`).join(", ")}`);

// 6) RLS + policies de faturas (quem consegue ler/atualizar direto)
const rls = await pg.query(`SELECT relrowsecurity, relforcerowsecurity, relname FROM pg_class WHERE relname='faturas'`);
out.faturas_rls = rls.rows;
const pol = await pg.query(`
  SELECT policyname, cmd, qual, with_check FROM pg_policies
  WHERE tablename='faturas' ORDER BY policyname`);
out.faturas_policies = pol.rows;
add("6_policies_faturas", pol.rows.length >= 0, `${pol.rows.length} policies (RLS ativo = ${rls.rows[0]?.relrowsecurity})`);

// 7) Triggers de guarda em faturas
const trg = await pg.query(`
  SELECT tgname, pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
  WHERE tgrelid = 'public.faturas'::regclass AND NOT tgisinternal`);
out.faturas_triggers = trg.rows;
add("7_triggers_faturas", true, `${trg.rows.length}: ${trg.rows.map(t => t.tgname).join(", ") || "nenhum"}`);

// 8) Sequencial atual (ultimo numero FAT-2026-*)
const seq = await pg.query(`
  SELECT count(*)::int AS total, max(numero) AS ultimo
  FROM public.faturas WHERE numero ~ '^FAT-'`);
out.sequencial = seq.rows[0];
add("8_faturas_com_numero_oficial", seq.rows[0].total > 0,
  `total=${seq.rows[0].total} ultimo=${seq.rows[0].ultimo}`);

// 9) Conta a Receber vinculada a faturas
const ar = await pg.query(`SELECT count(*)::int AS qtd FROM public.financeiro_receber WHERE fatura_id IS NOT NULL`);
add("9_titles_com_fatura_id", true, `financeiro_receber com fatura_id = ${ar.rows[0].qtd}`);

await pg.end();
fs.writeFileSync("scripts/_fin_bug03_diag.json", JSON.stringify(out, null, 2));
console.log("\nSalvo em scripts/_fin_bug03_diag.json");
