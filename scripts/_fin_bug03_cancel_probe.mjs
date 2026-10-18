/**
 * FIN-BUG-03 — Sonda READ-ONLY do caminho de cancelamento (NADA é persistido).
 *  1) auth.uid() via set_config('request.jwt.claims') em sessão pg
 *  2) usuários com perfil autorizado (super_admin/admin_tenant/financeiro) + tenant
 *  3) estado atual da duplicata c4e74e94
 *  4) DRY-RUN da RPC f_cancelar_fatura dentro de transação com ROLLBACK
 * Saida: scripts\_fin_bug03_cancel_probe.json
 */
import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m) || [])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();

const out = { ts: new Date().toISOString() };
const ALVO = "c4e74e94-3482-4a7f-911d-15dc1feadeeb";
const ORIGINAL = "bb645429-b75b-49bb-be55-a612fec08947";

// 1) auth.uid() com claims forjadas (sem transação implícita)
await pg.query("BEGIN");
out.auth_uid_sem_claims = (await pg.query("SELECT auth.uid() AS uid")).rows[0];
out.rpc_existe = (await pg.query(
  `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('f_cancelar_fatura','f_emitir_fatura','f_mover_fatura_status')
   ORDER BY 1`)).rows;
await pg.query("ROLLBACK");

// 2) usuários autorizados
out.usuarios_autorizados = (await pg.query(
  `SELECT tu.user_id, tu.tenant_id, tu.papel, t.nome AS tenant, u.email
   FROM public.tenant_usuarios tu
   LEFT JOIN public.tenants t ON t.id = tu.tenant_id
   LEFT JOIN auth.users u ON u.id = tu.user_id
   WHERE tu.status='ativo' AND tu.papel IN ('super_admin','admin_tenant','financeiro')
   ORDER BY t.nome, tu.papel`)).rows;
console.log("USUARIOS_AUTORIZADOS:", JSON.stringify(out.usuarios_autorizados, null, 2));

// 3) estado das 2 faturas + itens + AR
out.faturas = (await pg.query(
  `SELECT id, status, numero, cliente_id, conta_receber_id, tenant_id, valor_total,
          cancelado_em, cancelado_por, motivo_cancelamento, criado_em
   FROM public.faturas WHERE id = ANY($1::uuid[]) ORDER BY criado_em`,
  [[ALVO, ORIGINAL]])).rows;
console.log("FATURAS:", JSON.stringify(out.faturas, null, 2));
out.itens = (await pg.query(
  `SELECT fatura_id, status, count(*)::int AS qtd FROM public.fatura_itens
   WHERE fatura_id = ANY($1::uuid[]) GROUP BY 1,2 ORDER BY 1,2`, [[ALVO, ORIGINAL]])).rows;
console.log("ITENS:", JSON.stringify(out.itens, null, 2));

// 4) DRY-RUN: auth.uid() + f_cancelar_fatura com ROLLBACK
const candidato = out.usuarios_autorizados.find((u) => u.tenant_id === out.faturas[0].tenant_id);
out.candidato = candidato || null;
if (candidato) {
  const claims = JSON.stringify({ sub: candidato.user_id, role: "authenticated" });
  await pg.query("BEGIN");
  await pg.query("SELECT set_config('request.jwt.claims', $1, false)", [claims]);
  out.auth_uid_com_claims = (await pg.query("SELECT auth.uid() AS uid")).rows[0];
  out.dry_run = (await pg.query(
    "SELECT public.f_cancelar_fatura($1::uuid, $2::text) AS r",
    [ALVO, "FIN-BUG-03 — duplicidade: fatura idêntica à " + ORIGINAL + " (cancelamento assistido, dry-run)"]
  )).rows[0];
  out.dry_run_estado = (await pg.query(
    "SELECT id, status, cancelado_em IS NOT NULL AS cancelado FROM public.faturas WHERE id=$1", [ALVO])).rows[0];
  await pg.query("ROLLBACK");
  out.apos_rollback = (await pg.query(
    "SELECT id, status, cancelado_em IS NOT NULL AS cancelado FROM public.faturas WHERE id=$1", [ALVO])).rows[0];
  out.gatilhos_antes_depois_iguais = JSON.stringify(out.dry_run_estado) === JSON.stringify(out.apos_rollback);
} else {
  out.dry_run = "SEM_CANDIDATO_TENANT";
}

// 5) não alterar a emitida sem número
out.emitida_sem_numero = (await pg.query(
  `SELECT id, status, numero, numero_cliente, conta_receber_id, criado_em, metadata->>'numeroManual' AS numero_manual
   FROM public.faturas WHERE numero IS NULL AND status='emitida'`)).rows;
console.log("EMITIDA_SEM_NUMERO:", JSON.stringify(out.emitida_sem_numero, null, 2));

console.log("\nAUTH_UID_SEM_CLAIMS:", JSON.stringify(out.auth_uid_sem_claims));
console.log("AUTH_UID_COM_CLAIMS:", JSON.stringify(out.auth_uid_com_claims));
console.log("DRY_RUN:", JSON.stringify(out.dry_run));
console.log("ROLLBACK_OK:", out.gatilhos_antes_depois_iguais);

await pg.end();
fs.writeFileSync("scripts/_fin_bug03_cancel_probe.json", JSON.stringify(out, null, 2));
console.log("Salvo scripts/_fin_bug03_cancel_probe.json");
