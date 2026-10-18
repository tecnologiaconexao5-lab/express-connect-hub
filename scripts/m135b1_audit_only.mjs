// MISSÃO 135-B.1 — Auditoria apenas (sem alterações)
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});

async function query(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=== ETAPA 3 — Confirmar Schema Remoto (somente leitura) ===\n');

  // 1. portal_pedidos
  console.log('--- portal_pedidos ---');
  const pp = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'portal_pedidos' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  for (const r of pp.rows) {
    console.log(`  ${r.column_name}: ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}${r.column_default ? ' DEFAULT ' + r.column_default : ''}`);
  }

  // 2. ordens_servico (colunas cliente)
  console.log('\n--- ordens_servico (colunas cliente) ---');
  const os = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ordens_servico' AND table_schema = 'public'
    AND column_name IN ('cliente', 'cliente_id', 'pedido_portal_id', 'numero', 'status', 'origem', 'destino')
    ORDER BY ordinal_position
  `);
  for (const r of os.rows) {
    console.log(`  ${r.column_name}: ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
  }

  // 3. RPC
  console.log('\n--- RPC converter_pedido_para_os ---');
  const rpc = await query(`
    SELECT proname, proargnames, prosecdef, prolang::text
    FROM pg_proc WHERE proname = 'converter_pedido_para_os'
  `);
  if (rpc.rows.length > 0) {
    console.log(`  STATUS: JÁ EXISTE`);
    console.log(`  Args: ${rpc.rows[0].proargnames?.join(', ') || 'N/A'}`);
    console.log(`  SECURITY DEFINER: ${rpc.rows[0].prosecdef ? 'SIM' : 'NÃO'}`);
  } else {
    console.log(`  STATUS: NÃO EXISTE — será criada pela migration`);
  }

  // 4. Índices únicos
  console.log('\n--- Índices em portal_pedidos ---');
  const idx = await query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'portal_pedidos'
    ORDER BY indexname
  `);
  for (const r of idx.rows) {
    console.log(`  ${r.indexname}`);
    if (r.indexdef) console.log(`    ${r.indexdef.substring(0, 120)}`);
  }

  // 5. Constraints CHECK
  console.log('\n--- CHECK constraints portal_pedidos ---');
  const cons = await query(`
    SELECT con.conname, pg_get_constraintdef(con.oid) as def
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    WHERE cls.relname = 'portal_pedidos' AND contype = 'c'
  `);
  for (const r of cons.rows) {
    console.log(`  ${r.conname}: ${r.def?.substring(0, 200)}`);
  }

  // 6. Colunas já existentes da migration
  console.log('\n--- Colunas da migration que já existem ---');
  const colsToCheck = ['os_vinculada_id', 'converted_at', 'erro_processamento', 'codigo_erro', 
                        'tentativas_processamento', 'ultima_tentativa_em', 'solicitacao_via', 'data_solicitada',
                        'pedido_portal_id'];
  for (const col of colsToCheck) {
    const r = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name IN ('portal_pedidos', 'ordens_servico') AND column_name = $1
    `, [col]);
    const tbl = r.rows.length > 0 ? 
      (await query(`SELECT table_name FROM information_schema.columns WHERE column_name = $1`, [col])).rows.map(x => x.table_name).join(', ') 
      : '-';
    console.log(`  ${col}: ${r.rows.length > 0 ? `✅ JÁ EXISTE em [${tbl}]` : '❌ AUSENTE'}`);
  }

  // 7. Tenant
  console.log('\n--- tenant_id em portal_pedidos? ---');
  const ten = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'portal_pedidos' AND column_name = 'tenant_id'
  `);
  console.log(`  ${ten.rows.length > 0 ? 'SIM' : 'NÃO (usa RLS com current_tenant_id_safe)'}`);

  // 8. Contagem de pedidos
  const cnt = await query('SELECT COUNT(*)::int AS total FROM portal_pedidos');
  console.log(`\n--- Total de pedidos no banco: ${cnt.rows[0].total} ---`);

  // 9. Pedidos por status
  const stats = await query(`
    SELECT status, COUNT(*)::int AS qtd
    FROM portal_pedidos GROUP BY status ORDER BY status
  `);
  console.log('\n--- Pedidos por status ---');
  for (const r of stats.rows) {
    console.log(`  ${r.status}: ${r.qtd}`);
  }

  // 10. RLS
  console.log('\n--- RLS policies portal_pedidos ---');
  const rls = await query(`
    SELECT pol.polname, pol.polcmd, pol.polpermissive
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    WHERE cls.relname = 'portal_pedidos'
  `);
  for (const r of rls.rows) {
    console.log(`  ${r.polname} (cmd=${r.polcmd}, permissive=${r.polpermissive})`);
  }

  await pool.end();
  console.log('\n✅ Auditoria concluída — nenhuma alteração foi feita.');
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message);
  pool.end().catch(() => {});
  process.exit(1);
});
