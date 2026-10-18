const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. RLS policies
  console.log('=== RLS POLICIES ===');
  const rls = await c.query(
    "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename='financeiro_receber' ORDER BY policyname"
  );
  rls.rows.forEach(r => console.log(`${r.policyname} | ${r.cmd} | ${(r.qual||'NULL').substring(0,200)}`));

  // 2. Check if sentinela exists
  console.log('\n=== SENTINELAS FIN3623B ===');
  const sent = await c.query(
    "SELECT id, fatura, cliente_nome, status, valor FROM financeiro_receber WHERE fatura ILIKE '%FIN3623B%' ORDER BY created_at DESC LIMIT 5"
  );
  sent.rows.forEach(r => console.log(`${r.id} | ${r.fatura} | ${r.cliente_nome} | ${r.status} | R$ ${r.valor}`));

  // 3. Count all financeiro_receber
  console.log('\n=== TOTAL financeiro_receber ===');
  const total = await c.query("SELECT COUNT(*) as n FROM financeiro_receber");
  console.log(`Total: ${total.rows[0].n}`);

  // 4. Check what AuthContext resolves as tenant for this user
  console.log('\n=== TENANT USUARIOS ===');
  const tu = await c.query(
    "SELECT user_id, papel, tenant_id FROM tenant_usuarios WHERE user_id IN (SELECT id FROM auth.users WHERE email='tamiris.castilho@conexaoexpress.com.br')"
  );
  tu.rows.forEach(r => console.log(`user=${r.user_id} | papel=${r.papel} | tenant=${r.tenant_id}`));

  // 5. Last 5 records
  console.log('\n=== ULTIMOS 5 registros ===');
  const last = await c.query("SELECT id, fatura, cliente_nome, status, valor FROM financeiro_receber ORDER BY created_at DESC LIMIT 5");
  last.rows.forEach(r => console.log(`${r.id} | ${r.fatura} | ${r.cliente_nome} | ${r.status} | R$ ${r.valor}`));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
