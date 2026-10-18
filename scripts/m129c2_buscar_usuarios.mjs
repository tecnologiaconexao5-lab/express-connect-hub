import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Prestadores com auth_user_id
const res = await client.query("SELECT id, nome_completo, auth_user_id FROM public.prestadores WHERE auth_user_id IS NOT NULL LIMIT 10;");
console.log('=== PRESTADORES COM AUTH_USER_ID ===');
if (res.rows.length === 0) console.log('  (nenhum)');
res.rows.forEach(r => console.log(`  ${r.nome_completo} | auth: ${r.auth_user_id} | id: ${r.id}`));

// Auth users
const users = await client.query("SELECT id, email, raw_user_meta_data->>'full_name' AS nome FROM auth.users ORDER BY email LIMIT 20;");
console.log('\n=== AUTH USERS ===');
users.rows.forEach(r => console.log(`  ${r.email} (${r.nome || 'sem nome'}) | id: ${r.id}`));

await client.end();
