import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Check which auth users are linked to prestadores
const res = await client.query(`
  SELECT p.id AS prestador_id, p.nome_completo, p.auth_user_id,
         au.email, au.raw_user_meta_data->>'full_name' AS nome_usuario
  FROM public.prestadores p
  LEFT JOIN auth.users au ON au.id = p.auth_user_id
  WHERE p.auth_user_id IS NOT NULL
  ORDER BY p.nome_completo
`);
console.log('=== VINCULOS PRESTADOR <-> AUTH ===');
res.rows.forEach(r => console.log(`  ${r.nome_completo} | email: ${r.email || 'SEM EMAIL'} | auth_id: ${r.auth_user_id}`));

// Check OS-202607-426505
const os = await client.query("SELECT id, numero, tenant_id, status FROM public.ordens_servico WHERE numero = 'OS-202607-426505'");
console.log('\n=== OS-202607-426505 ===');
if (os.rows.length === 0) {
  console.log('  NAO ENCONTRADA');
} else {
  os.rows.forEach(r => console.log(`  ID: ${r.id} | status: ${r.status} | tenant: ${r.tenant_id}`));
  
  // Check alocacoes for this OS
  const aloc = await client.query(`
    SELECT a.id, a.prestador_id, p.nome_completo, a.status
    FROM public.alocacoes_escala a
    LEFT JOIN public.prestadores p ON p.id = a.prestador_id
    WHERE a.ordem_servico_id = $1
  `, [os.rows[0].id]);
  console.log('\n  Alocacoes:');
  aloc.rows.forEach(r => console.log(`    ${r.nome_completo || 'sem nome'} | prestador_id: ${r.prestador_id} | status: ${r.status}`));
}

await client.end();
