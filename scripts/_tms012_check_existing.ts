import { createClient } from '@supabase/supabase-js';

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

  // 1. Check for existing homologation client
  const clientes = await sup.from('clientes')
    .select('id, razao_social, nome_fantasia, cpf_cnpj, status')
    .ilike('razao_social', '%HOMOLOGA%');
  console.log('\nCLIENTES HOMOLOGA (razao_social):', clientes.data?.length || 0);
  for (const c of clientes.data || []) {
    console.log(`  ${c.id} | ${c.razao_social} | ${c.nome_fantasia} | ${c.cpf_cnpj} | ${c.status}`);
  }

  // Also search by nome_fantasia
  const clientes2 = await sup.from('clientes')
    .select('id, razao_social, nome_fantasia, cpf_cnpj, status')
    .ilike('nome_fantasia', '%HOMOLOGA%');
  console.log('\nCLIENTES HOMOLOGA (nome_fantasia):', clientes2.data?.length || 0);
  for (const c of clientes2.data || []) {
    console.log(`  ${c.id} | ${c.razao_social} | ${c.nome_fantasia} | ${c.cpf_cnpj} | ${c.status}`);
  }

  // 2. Check for test motorista
  const prest = await sup.from('prestadores')
    .select('id, nome_completo, email, cpf_cnpj, status')
    .ilike('email', '%teste@%');
  console.log('\nPRESTADORES TESTE (email ~teste@):', prest.data?.length || 0);
  for (const p of prest.data || []) {
    console.log(`  ${p.id} | ${p.nome_completo} | ${p.email} | ${p.cpf_cnpj} | ${p.status}`);
  }

  const prest2 = await sup.from('prestadores')
    .select('id, nome_completo, email, cpf_cnpj, status')
    .eq('email', 'teste@conexao.com');
  console.log('\nPRESTADOR teste@conexao.com:', prest2.data?.length || 0);
  for (const p of prest2.data || []) {
    console.log(`  ${p.id} | ${p.nome_completo} | ${p.email} | ${p.status}`);
  }

  // 3. Check for existing OS with "HOMOLOG" in numero
  const oss = await sup.from('ordens_servico')
    .select('id, numero, status, cliente_id, prestador_id, created_at')
    .ilike('numero', '%HOMOLOG%')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nOSS HOMOLOG:', oss.data?.length || 0);
  for (const o of oss.data || []) {
    console.log(`  ${o.id} | ${o.numero} | ${o.status} | cliente:${o.cliente_id} | prest:${o.prestador_id} | ${o.created_at}`);
  }

  // 4. Check OS with "TEST" in the number (not our M80 test OS)
  const oss2 = await sup.from('ordens_servico')
    .select('id, numero, status, cliente_id, prestador_id, created_at')
    .ilike('numero', 'HML%')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nOSS HML*:', oss2.data?.length || 0);
  for (const o of oss2.data || []) {
    console.log(`  ${o.id} | ${o.numero} | ${o.status} | criado:${o.created_at}`);
  }

  // 5. Check auth users with teste email
  const { data: usuarios, error: errU } = await sup.rpc('get_usuarios' as any);
  console.log('\nUSUARIOS via RPC error:', errU?.message || 'N/A');
  // Try from auth.users (not possible via anon key)
  // Let's check tenant_usuarios
  const tu = await sup.from('tenant_usuarios')
    .select('id, auth_user_id, nome, email, papel')
    .ilike('email', '%teste%');
  console.log('\nTENANT_USUARIOS teste:', tu.data?.length || 0);
  for (const t of tu.data || []) {
    console.log(`  ${t.id} | email:${t.email} | papel:${t.papel} | nome:${t.nome}`);
  }
}
main().catch(e => console.error('ERR:', e));
