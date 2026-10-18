// HOTFIX CLIENTES RLS — APLICAR CORREÇÃO MÍNIMA (com backup + validação + teste controlado)
// Uso: node scripts/hotfix_clientes_rls_aplicar.mjs  (requer DATABASE_URL no .env)
import "dotenv/config";
import pg from "pg";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260817_hotfix_clientes_rls_insert.sql");
const sql = readFileSync(migrationFile, "utf8");

const TENANT_PRINCIPAL = "00000000-0000-0000-0000-000000000001";
const TENANT_ALHEIO = "00000000-0000-0000-0000-000000000999";
const USERS = {
  super_admin: "8c12fc67-4dac-4f1e-b4fd-23cf0d168284",
  financeiro: "de1c77e0-1818-431c-8503-ebe08bd95e80",
  comercial: "0d3e308d-8812-466f-8fad-0ebdf010088d",
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

function backupSql(lines) {
  return [
    "-- BACKUP HOTFIX CLIENTES RLS (pré-alteração) — restauração manual em caso de rollback",
    "-- Gerado automaticamente. Estado anterior a aplicar 20260817_hotfix_clientes_rls_insert.sql",
    "-- " + new Date().toISOString(),
    "",
    ...lines,
    "",
  ].join("\n");
}

async function capturarEstado(label) {
  const partes = [`-- ══ ${label} ══`];
  const fn = await client.query(
    `SELECT pg_get_functiondef(oid) AS def, pg_get_function_identity_arguments(oid) AS args
     FROM pg_proc WHERE proname IN ('f_usuario_pode_acessar_cliente','f_usuario_pode_acessar_tenant');`);
  for (const r of fn.rows) {
    if (r.def) partes.push(r.def + ";");
  }
  const pol = await client.query(
    `SELECT policyname, cmd, roles, with_check
     FROM pg_policies WHERE schemaname='public' AND tablename='clientes' AND policyname='clientes_insert_own';`);
  for (const p of pol.rows) {
    partes.push(
      `-- policy clientes_insert_own cmd=${p.cmd} roles=${JSON.stringify(p.roles)} with_check=${p.with_check}`
    );
  }
  return partes.join("\n");
}

async function main() {
  await client.connect();

  // 1) Backup textual do estado atual
  const estado = await capturarEstado("ESTADO ANTERIOR (f_usuario_pode_acessar_cliente / clientes_insert_own)");
  const backupFile = resolve(__dirname, `backup_hotfix_clientes_rls_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.sql`);
  writeFileSync(backupFile, backupSql([estado]));
  console.log("BACKUP SALVO:", backupFile);

  // 2) Aplicar migration (arquivo tem BEGIN/COMMIT)
  console.log("Aplicando migration...");
  await client.query(sql);
  console.log("Migration aplicada!");

  // 3) Validação da definição final
  const fnVal = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef, p.provolatile,
            p.proconfig AS config,
            (SELECT array_agg(DISTINCT g.grantee ORDER BY g.grantee)
               FROM information_schema.role_routine_grants g
              WHERE g.specific_name = pg_get_function_identity_arguments(p.oid)::text AND g.routine_name='f_usuario_pode_acessar_tenant') AS grantees
     FROM pg_proc p WHERE p.proname='f_usuario_pode_acessar_tenant';`);
  console.log("FUNÇÃO FINAL:", JSON.stringify(fnVal.rows, null, 2));

  const polVal = await client.query(
    `SELECT policyname, cmd, roles, with_check
     FROM pg_policies WHERE schemaname='public' AND tablename='clientes' AND cmd='INSERT';`);
  console.log("POLICY INSERT FINAL:", JSON.stringify(polVal.rows, null, 2));

  const grants = await client.query(
    `SELECT 'anon' AS role, has_function_privilege('anon','public.f_usuario_pode_acessar_tenant(uuid)','EXECUTE') AS exe
     UNION ALL SELECT 'public', has_function_privilege('public','public.f_usuario_pode_acessar_tenant(uuid)','EXECUTE')
     UNION ALL SELECT 'authenticated', has_function_privilege('authenticated','public.f_usuario_pode_acessar_tenant(uuid)','EXECUTE')
     UNION ALL SELECT 'service_role', has_function_privilege('service_role','public.f_usuario_pode_acessar_tenant(uuid)','EXECUTE');`);
  console.log("GRANTS:", JSON.stringify(grants.rows));

  // 4) Teste controlado (BEGIN/ROLLBACK — nada persiste)
  const resultados = [];
  for (const [nome, uid] of Object.entries(USERS)) {
    for (const [caso, tenantId, esperado] of [
      ["próprio tenant", TENANT_PRINCIPAL, "OK"],
      ["tenant alheio", TENANT_ALHEIO, "BLOQUEADO"],
    ]) {
      let ok = false, err = null;
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL role authenticated");
        await client.query(`SET LOCAL request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}'`);
        await client.query(
          `INSERT INTO public.clientes (razao_social, cnpj, tenant_id, status)
           VALUES ('HOTFIX TEST ' || gen_random_uuid()::text, '33.333.333/0001-33', $1, 'ativo')`,
          [tenantId]);
        ok = true;
      } catch (e) {
        err = e.message.split("\n")[0];
      } finally {
        await client.query("ROLLBACK");
        await client.query("RESET ROLE");
        await client.query("RESET request.jwt.claims");
      }
      const status = ok ? "OK" : "BLOQUEADO";
      const bate = status === esperado ? "✔" : "✘ ESPERADO " + esperado;
      resultados.push(`${nome} | ${caso} | ${status} ${bate}${err ? " | " + err : ""}`);
      console.log("TESTE:", resultados[resultados.length - 1]);
    }
  }

  // 5) Contagem de clientes não deve ter mudado (nenhum persistido)
  const count = await client.query(`SELECT COUNT(*) AS total FROM public.clientes;`);
  console.log("CLIENTES PÓS-TESTE (deve ser igual ao inicial):", count.rows[0].total);

  await client.end();
}
main().catch(async (e) => {
  console.error("Erro:", e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
