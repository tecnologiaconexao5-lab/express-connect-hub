// GD-02 - dry-run transacional da migration de blindagem RLS.
// Executa a migration, prova as policies com usuarios reais e faz ROLLBACK.
// Nenhuma alteracao persiste em producao. Uso: node scripts/_gd02_dry_run_rls.cjs
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261105000001_blindagem_rls_documentos_metadata.sql",
);
const TENANT = "00000000-0000-0000-0000-000000000001";
const USERS = {
  super_admin: "323878d3-861f-4257-a0ef-8ee26f526ce0",
  financeiro: "de1c77e0-1818-431c-8503-ebe08bd95e80",
  comercial: "0d3e308d-8812-466f-8fad-0ebdf010088d",
  operacional: "730560d9-e8ce-4315-bada-e9d43f7ab4a4",
  atendimento: "e123a9ec-ec1c-49b3-837b-3549467fa5d3",
  cliente: "ea38c1b4-c6af-44ba-9560-8f6b1c8f4590",
};
const MARK = "teste_gd02_rls";

function carregarDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.resolve(__dirname, "..", ".env");
  const linha = fs
    .readFileSync(env, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  return linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const checks = [];
function ok(rotulo, detalhe = "") {
  checks.push({ ok: true, rotulo });
  console.log(`  OK   ${rotulo}${detalhe ? ` - ${detalhe}` : ""}`);
}
function fail(rotulo, detalhe = "") {
  checks.push({ ok: false, rotulo });
  console.log(`  FAIL ${rotulo}${detalhe ? ` - ${detalhe}` : ""}`);
}

async function comoUsuario(client, userId) {
  await client.query("RESET ROLE");
  await client.query(`SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: userId })}'`);
  await client.query("SET LOCAL ROLE authenticated");
}

async function contarVisiveis(client) {
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM public.documentos_metadata WHERE modulo_origem = $1",
    [MARK],
  );
  return rows[0].n;
}

async function main() {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new pg.Client({
    connectionString: carregarDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    console.log("DRY-RUN GD-02 (BEGIN) - nada sera persistido.");
    await client.query(sql);
    console.log("Migration executada dentro da transacao. Provas:");

    const { rows: policies } = await client.query(`
      SELECT policyname, cmd, qual, with_check
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'documentos_metadata'
       ORDER BY policyname`);
    if (policies.length === 4) ok("4 policies de documentos_metadata", policies.map((p) => p.policyname).join(", "));
    else fail("4 policies de documentos_metadata", `encontradas=${policies.length}`);
    if (policies.every((p) => !/\btrue\b/i.test(String(p.qual || "")) || p.cmd === "INSERT")) {
      ok("policies SELECT/UPDATE/DELETE nao usam USING (true)");
    } else {
      fail("policies SELECT/UPDATE/DELETE nao usam USING (true)");
    }
    const del = policies.find((p) => p.policyname === "documentos_metadata_delete");
    if (del && /f_documentos_usuario_admin/i.test(String(del.qual || ""))) {
      ok("DELETE restrito a f_documentos_usuario_admin()");
    } else {
      fail("DELETE restrito a f_documentos_usuario_admin()");
    }

    const { rows: funcs } = await client.query(`
      SELECT proname, prosecdef
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('f_documentos_usuario_admin', 'f_documentos_pode_departamento')
       ORDER BY proname`);
    if (funcs.length === 2 && funcs.every((f) => f.prosecdef)) {
      ok("funcoes auxiliares SECURITY DEFINER", funcs.map((f) => f.proname).join(", "));
    } else {
      fail("funcoes auxiliares SECURITY DEFINER", JSON.stringify(funcs));
    }

    const { rows: trigger } = await client.query(`
      SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'public.documentos_prestadores'::regclass
         AND tgname = 'trg_documentos_prestadores_metadata'`);
    if (trigger.length === 1) ok("trigger trg_documentos_prestadores_metadata preservado");
    else fail("trigger trg_documentos_prestadores_metadata preservado");

    // Documentos de prova (inseridos como postgres, sem passar por RLS).
    await client.query(
      `INSERT INTO public.documentos_metadata
         (url, nome, tipo, modulo_origem, entidade_id, status_ia, data_inclusao, tenant_id,
          categoria, departamento, responsavel, ativo, versao)
       VALUES
         ($1, 'GD02 Financeiro', 'Teste', $2, NULL, 'pendente', now(), $3, 'Financeiro', 'Financeiro', 'TMS', true, 1),
         ($4, 'GD02 Comercial', 'Teste', $2, NULL, 'pendente', now(), $3, 'Comercial', 'Comercial', 'TMS', true, 1),
         ($5, 'GD02 Publico', 'Teste', $2, NULL, 'pendente', now(), $3, 'Administrativo', NULL, 'TMS', true, 1)`,
      [
        `documentos_operacionais/gd02_financeiro_${Date.now()}.pdf`,
        MARK,
        TENANT,
        `documentos_operacionais/gd02_comercial_${Date.now()}.pdf`,
        `documentos_operacionais/gd02_publico_${Date.now()}.pdf`,
      ],
    );

    const esperado = {
      super_admin: 3,
      financeiro: 2,
      comercial: 2,
      operacional: 2,
      atendimento: 2,
      cliente: 0,
    };
    for (const [papel, userId] of Object.entries(USERS)) {
      await comoUsuario(client, userId);
      const n = await contarVisiveis(client);
      if (n === esperado[papel]) ok(`visibilidade ${papel}`, `ve ${n}/3 documentos de teste`);
      else fail(`visibilidade ${papel}`, `esperado ${esperado[papel]}, veio ${n}`);
    }

    // DELETE: financeiro nao pode; super_admin pode.
    await comoUsuario(client, USERS.financeiro);
    const delFin = await client.query(
      "DELETE FROM public.documentos_metadata WHERE modulo_origem = $1 AND departamento = 'Financeiro'",
      [MARK],
    );
    if (delFin.rowCount === 0) ok("DELETE bloqueado para financeiro (RLS)");
    else fail("DELETE bloqueado para financeiro (RLS)", `rowCount=${delFin.rowCount}`);

    // INSERT: financeiro pode no proprio departamento, mas nao em Comercial.
    const insFin = await client.query(
      `INSERT INTO public.documentos_metadata
         (url, nome, tipo, modulo_origem, status_ia, data_inclusao, tenant_id, categoria, departamento, ativo, versao)
       VALUES ($1, 'GD02 Ins Fin', 'Teste', $2, 'pendente', now(), $3, 'Financeiro', 'Financeiro', true, 1)`,
      [`documentos_operacionais/gd02_ins_fin_${Date.now()}.pdf`, MARK, TENANT],
    );
    if (insFin.rowCount === 1) ok("INSERT permitido para financeiro no departamento Financeiro");
    else fail("INSERT permitido para financeiro no departamento Financeiro");
    let bloqueouComercial = false;
    await client.query("SAVEPOINT sp_comercial");
    try {
      await client.query(
        `INSERT INTO public.documentos_metadata
           (url, nome, tipo, modulo_origem, status_ia, data_inclusao, tenant_id, categoria, departamento, ativo, versao)
         VALUES ($1, 'GD02 Ins Com', 'Teste', $2, 'pendente', now(), $3, 'Comercial', 'Comercial', true, 1)`,
        [`documentos_operacionais/gd02_ins_com_${Date.now()}.pdf`, MARK, TENANT],
      );
    } catch {
      bloqueouComercial = true;
      await client.query("ROLLBACK TO SAVEPOINT sp_comercial");
    }
    if (bloqueouComercial) ok("INSERT bloqueado para financeiro no departamento Comercial");
    else fail("INSERT bloqueado para financeiro no departamento Comercial");

    await comoUsuario(client, USERS.cliente);
    let bloqueouCliente = false;
    await client.query("SAVEPOINT sp_cliente");
    try {
      await client.query(
        `INSERT INTO public.documentos_metadata
           (url, nome, tipo, modulo_origem, status_ia, data_inclusao, tenant_id, categoria, departamento, ativo, versao)
         VALUES ($1, 'GD02 Cliente', 'Teste', $2, 'pendente', now(), $3, 'Financeiro', 'Financeiro', true, 1)`,
        [`documentos_operacionais/gd02_ins_cli_${Date.now()}.pdf`, MARK, TENANT],
      );
    } catch {
      bloqueouCliente = true;
      await client.query("ROLLBACK TO SAVEPOINT sp_cliente");
    }
    if (bloqueouCliente) ok("INSERT bloqueado para perfil cliente");
    else fail("INSERT bloqueado para perfil cliente");

    await comoUsuario(client, USERS.super_admin);
    const delAdmin = await client.query(
      "DELETE FROM public.documentos_metadata WHERE modulo_origem = $1 AND departamento = 'Financeiro'",
      [MARK],
    );
    if (delAdmin.rowCount >= 1) ok("DELETE permitido para super_admin", `rowCount=${delAdmin.rowCount}`);
    else fail("DELETE permitido para super_admin", `rowCount=${delAdmin.rowCount}`);

    await client.query("RESET ROLE");
    const falhas = checks.filter((c) => !c.ok);
    console.log(`\nResumo GD-02: ${checks.length - falhas.length}/${checks.length} provas OK`);
    if (falhas.length) process.exitCode = 3;
  } catch (err) {
    console.error("ERRO NO DRY-RUN:", err.message);
    process.exitCode = 1;
  } finally {
    try {
      await client.query("ROLLBACK");
      console.log("ROLLBACK executado - nenhuma alteracao persistida.");
    } catch {}
    await client.end();
  }
}

main();
