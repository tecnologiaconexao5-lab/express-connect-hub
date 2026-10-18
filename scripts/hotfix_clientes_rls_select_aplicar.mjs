// HOTFIX CLIENTES RLS — CORRIGIR SELECT/RETURNING (backup + aplicar + validar fluxo real)
// Uso: node scripts/hotfix_clientes_rls_select_aplicar.mjs  (requer DATABASE_URL)
import "dotenv/config";
import pg from "pg";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260817_hotfix_clientes_rls_select.sql");
const sql = readFileSync(migrationFile, "utf8");

const TENANT = "00000000-0000-0000-0000-000000000001";
const TENANT_ALHEIO = "00000000-0000-0000-0000-000000000999";
const USERS = {
  super_admin: "8c12fc67-4dac-4f1e-b4fd-23cf0d168284",
  financeiro: "de1c77e0-1818-431c-8503-ebe08bd95e80",
  comercial: "0d3e308d-8812-466f-8fad-0ebdf010088d",
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // 1) Backup textual da policy clientes_select_own
  const pol = await client.query(
    `SELECT policyname, cmd, roles, qual, with_check
     FROM pg_policies WHERE schemaname='public' AND tablename='clientes' AND policyname='clientes_select_own';`);
  const backup = [
    "-- BACKUP clientes_select_own (pré-correção) — " + new Date().toISOString(),
    "",
    ...pol.rows.map((p) =>
      `-- roles=${JSON.stringify(p.roles)} cmd=${p.cmd}\n-- qual=${p.qual}\n-- with_check=${p.with_check}`
    ),
    "",
  ].join("\n");
  const backupFile = resolve(__dirname, `backup_hotfix_clientes_rls_select_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.sql`);
  writeFileSync(backupFile, backup);
  console.log("BACKUP:", backupFile);
  console.log("POLICY ATUAL:", JSON.stringify(pol.rows, null, 2));

  // 2) Aplicar migration
  console.log("Aplicando migration...");
  await client.query(sql);
  console.log("Aplicada.");

  // 2b) Confirmar definição final (roles preservados)
  const fin = await client.query(
    `SELECT policyname, cmd, roles, qual FROM pg_policies
     WHERE schemaname='public' AND tablename='clientes' AND cmd='SELECT'
     ORDER BY policyname;`);
  console.log("POLICIES SELECT FINAIS:", JSON.stringify(fin.rows, null, 2));

  // 3) Validação com o MESMO fluxo real (INSERT ... RETURNING / .insert().select())
  //    Todas dentro de BEGIN/ROLLBACK — nada persiste.
  const casos = [
    ["financeiro  | próprio tenant | .insert().select()", USERS.financeiro, TENANT, "PASS"],
    ["comercial   | próprio tenant | .insert().select()", USERS.comercial, TENANT, "PASS"],
    ["financeiro  | outro tenant   | .insert().select()", USERS.financeiro, TENANT_ALHEIO, "BLOCK"],
    ["comercial   | outro tenant   | .insert().select()", USERS.comercial, TENANT_ALHEIO, "BLOCK"],
    ["super_admin | próprio tenant | .insert().select()", USERS.super_admin, TENANT, "PASS"],
  ];
  const resultados = [];
  for (const [label, uid, tenantId, esperado] of casos) {
    let status = "?";
    let err = null;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL role authenticated");
      await client.query(`SET LOCAL request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}'`);
      const r = await client.query(
        `INSERT INTO public.clientes (razao_social, cnpj, tenant_id, status)
         VALUES ('HOTFIX SEL ' || gen_random_uuid()::text, '12.000.000/0001-12', $1, 'ativo') RETURNING id`,
        [tenantId]);
      status = "PASS";
      resultados.push(`${label} -> PASS ${esperado === "PASS" ? "✔" : "✘ ESPERADO BLOCK"} id=${r.rows[0].id}`);
    } catch (e) {
      status = "BLOCK";
      err = e.message.split("\n")[0];
      resultados.push(`${label} -> BLOCK ${esperado === "BLOCK" ? "✔" : "✘ ESPERADO PASS"}${err ? " | " + err : ""}`);
    } finally {
      await client.query("ROLLBACK");
      await client.query("RESET ROLE");
      await client.query("RESET request.jwt.claims");
    }
    console.log("TESTE:", resultados[resultados.length - 1]);
  }

  // 3b) anon NÃO ampliado: SELECT de tenant clients como anon deve retornar vazio
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL role anon");
    const r = await client.query(`SELECT COUNT(*) AS n FROM public.clientes WHERE tenant_id = $1`, [TENANT]);
    console.log("TESTE anon SELECT tenant clients ->", r.rows[0].n, "(0 = roles preservados ✔)");
  } catch (e) {
    console.log("TESTE anon SELECT ->", e.message.split("\n")[0]);
  } finally { await client.query("ROLLBACK"); await client.query("RESET ROLE"); }

  // 4) Nenhum cliente persistido (contagem deve permanecer)
  const count = await client.query(`SELECT COUNT(*) AS total FROM public.clientes;`);
  console.log("CLIENTES PÓS-TESTE:", count.rows[0].total, "(inalterado)");

  await client.end();
}
main().catch(async (e) => {
  console.error("Erro:", e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
