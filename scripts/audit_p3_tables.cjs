const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const connStr = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8").match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();

  // 1. Current policies for the 3 target tables + current_tenant_id_safe function source
  for (const fn of ["current_tenant_id_safe", "f_usuario_pode_acessar_cliente", "f_obter_cliente_id_do_usuario", "obter_cliente_id_do_usuario"]) {
    const r = await c.query("SELECT proname, prosecdef::int, prosrc, proconfig FROM pg_proc WHERE proname=$1", [fn]);
    if (r.rows.length > 0) {
      console.log("\n=== FUNCTION " + fn + " ===");
      console.log("SECURITY_DEFINER: " + r.rows[0].prosecdef);
      console.log("config: " + JSON.stringify(r.rows[0].proconfig));
      console.log("source: " + (r.rows[0].prosrc || "N/A"));
    }
  }

  // 2. Full policies for alocacoes_escala
  console.log("\n=== POLICIES alocacoes_escala ===");
  const ae = await c.query("SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename='alocacoes_escala' ORDER BY policyname");
  for (const row of ae.rows) {
    console.log("Policy: " + row.policyname + " | CMD: " + row.cmd + " | Roles: " + JSON.stringify(row.roles));
    console.log("  USING: " + (row.qual || "(none)"));
    console.log("  CHECK: " + (row.with_check || "(none)"));
  }

  // 3. Full policies for ordens_servico
  console.log("\n=== POLICIES ordens_servico ===");
  const os = await c.query("SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename='ordens_servico' ORDER BY policyname");
  for (const row of os.rows) {
    console.log("Policy: " + row.policyname + " | CMD: " + row.cmd + " | Roles: " + JSON.stringify(row.roles));
    console.log("  USING: " + (row.qual || "(none)"));
    console.log("  CHECK: " + (row.with_check || "(none)"));
  }

  // 4. Full policies for clientes
  console.log("\n=== POLICIES clientes ===");
  const cl = await c.query("SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename='clientes' ORDER BY policyname");
  for (const row of cl.rows) {
    console.log("Policy: " + row.policyname + " | CMD: " + row.cmd + " | Roles: " + JSON.stringify(row.roles));
    console.log("  USING: " + (row.qual || "(none)"));
    console.log("  CHECK: " + (row.with_check || "(none)"));
  }

  // 5. Check column types for the 3 tables
  for (const tbl of ["alocacoes_escala", "ordens_servico", "clientes"]) {
    console.log("\n=== COLUMNS " + tbl + " ===");
    const cols = await c.query(
      "SELECT column_name, data_type, is_nullable, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [tbl]
    );
    for (const row of cols.rows) {
      console.log(row.column_name + " " + row.data_type + "(" + row.udt_name + ") nullable=" + row.is_nullable);
    }
  }

  // 6. Check clientes RLS status
  const rls = await c.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('alocacoes_escala','ordens_servico','clientes') AND relnamespace='public'::regnamespace");
  console.log("\n=== RLS STATUS ===");
  for (const row of rls.rows) {
    console.log(row.relname + " RLS=" + row.relrowsecurity + " FORCE=" + row.relforcerowsecurity);
  }

  // 7. Check if prestadores have auth_user_id = some auth.users entry
  const samplePrest = await c.query("SELECT id, nome_completo, auth_user_id FROM prestadores WHERE auth_user_id IS NOT NULL LIMIT 5");
  console.log("\n=== PRESTADORES WITH AUTH ===");
  for (const row of samplePrest.rows) {
    const authExists = await c.query("SELECT id FROM auth.users WHERE id=$1", [row.auth_user_id]);
    console.log("prestador.id=" + row.id + " nome=" + (row.nome_completo||"").substring(0,30) + " auth_user_id=" + row.auth_user_id + " found_in_auth.users=" + (authExists.rows.length>0));
  }

  // 8. Check usuarios_cliente sample
  const uc = await c.query("SELECT id, auth_user_id, cliente_id FROM usuarios_cliente LIMIT 5");
  console.log("\n=== USUARIOS_CLIENTE ===");
  for (const row of uc.rows) {
    const authExists = await c.query("SELECT id FROM auth.users WHERE id=$1", [row.auth_user_id]);
    console.log("id=" + row.id + " auth_user_id=" + row.auth_user_id + " cliente_id=" + row.cliente_id + " found=" + (authExists.rows.length>0));
  }

  // 9. Check tenant_usuarios sample
  const tu = await c.query("SELECT id, user_id, tenant_id FROM tenant_usuarios LIMIT 5");
  console.log("\n=== TENANT_USUARIOS ===");
  for (const row of tu.rows) {
    const authExists = await c.query("SELECT id FROM auth.users WHERE id=$1", [row.user_id]);
    console.log("id=" + row.id + " user_id=" + row.user_id + " tenant_id=" + row.tenant_id + " found=" + (authExists.rows.length>0));
  }

  await c.end();
})();
