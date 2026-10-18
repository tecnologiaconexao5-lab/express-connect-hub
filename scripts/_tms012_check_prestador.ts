import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) { console.error('DATABASE_URL not found'); process.exit(1); }
const DATABASE_URL = match[1].replace(/^["']|["']$/g, '');

const sup = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  const a = await sup.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (!a?.data?.session) { console.log('FALHA_AUTH:', a?.error?.message); return; }
  console.log('Auth OK');

  const PREST_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

  // Full prestador details via supabase
  const p = await sup.from('prestadores').select('*').eq('id', PREST_ID).single();
  console.log('\nPRESTADOR COMPLETO:');
  for (const [k, v] of Object.entries(p.data || {})) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('ERR:', p.error?.message || '');

  // Check auth_user_id existence and if it links to an auth user
  const authUserId = (p.data as any)?.auth_user_id;
  console.log('\nauth_user_id:', authUserId);

  // Check auth schema via pg direct
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check columns of prestadores
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'prestadores'
    ORDER BY ordinal_position
  `);
  console.log('\nCOLUNAS PRESTADORES:');
  for (const c of cols.rows) {
    console.log(`  ${c.column_name} (${c.data_type})`);
  }

  // Check if there's a prestador with auth_user_id set
  const prestAuth = await client.query(`
    SELECT id, nome_completo, email, auth_user_id 
    FROM prestadores 
    WHERE auth_user_id IS NOT NULL 
    LIMIT 10
  `);
  console.log('\nPRESTADORES COM AUTH_USER_ID:');
  for (const r of prestAuth.rows) {
    console.log(`  ${r.id} | ${r.nome_completo} | ${r.email} | auth_user:${r.auth_user_id}`);
  }

  // Check for any existing OS with status disponivel or pendente with this prestador
  const oss = await client.query(`
    SELECT id, numero, status, cliente_id, prestador_id, created_at 
    FROM ordens_servico 
    WHERE prestador_id = '${PREST_ID}'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('\nOSS VINCULADAS A ESTE PRESTADOR:');
  for (const r of oss.rows) {
    console.log(`  ${r.id} | ${r.numero} | ${r.status} | ${r.created_at}`);
  }

  // Check if any alocacoes_escala for this prestador
  const aloc = await client.query(`
    SELECT id, os_vinculada, status, created_at
    FROM alocacoes_escala 
    WHERE prestador_id = '${PREST_ID}'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('\nALOCACOES DESTE PRESTADOR:');
  for (const r of aloc.rows) {
    console.log(`  ${r.id} | os:${r.os_vinculada} | ${r.status} | ${r.created_at}`);
  }

  // Check auth.users for test user
  const users = await client.query(`
    SELECT id, email, raw_user_meta_data 
    FROM auth.users 
    WHERE email LIKE '%teste%'
    LIMIT 5
  `);
  console.log('\nAUTH USERS TESTE:');
  for (const r of users.rows) {
    console.log(`  ${r.id} | ${r.email} | meta:${JSON.stringify(r.raw_user_meta_data)}`);
  }

  await client.end();
}
main().catch(e => console.error('ERR:', e));
