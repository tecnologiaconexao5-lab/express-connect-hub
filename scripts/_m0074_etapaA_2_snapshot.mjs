import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (authErr || !auth?.session) { console.log('FALHA_AUTH:', authErr?.message); process.exit(1); }
  console.log('=== SNAPSHOT PRE-FINALIZACAO ===\n');

  // 1. OS
  const { data: os } = await supabase.from('ordens_servico').select('*').eq('id', OS_ID).single();
  console.log('--- OS ---');
  const camposChave = {
    id: os.id,
    numero: os.numero,
    status: os.status,
    cliente: os.cliente,
    cliente_id: os.cliente_id,
    prestador: os.prestador,
    prestador_id: os.prestador_id,
    valor_cliente: os.valor_cliente,
    custo_prestador: os.custo_prestador,
    valor_prestador_calculado: os.valor_prestador_calculado,
    pedagio: os.pedagio,
    adicionais: os.adicionais,
    ajudante: os.ajudante,
    descontos: os.descontos,
    outros_custos: os.outros_custos,
    margem_bruta: os.margem_bruta,
    margem_liquida: os.margem_liquida,
    distancia_km: os.distancia_km,
    tenant_id: os.tenant_id,
    updated_at: os.updated_at,
  };
  console.log(JSON.stringify(camposChave, null, 2));

  // 2. Financeiro Receber
  const { data: fr } = await supabase.from('financeiro_receber').select('*').eq('os_id', OS_ID);
  console.log('\n--- FINANCEIRO_RECEBER ---');
  console.log(JSON.stringify(fr, null, 2) || '(vazio)');

  // 3. Financeiro Pagar
  const { data: fp } = await supabase.from('financeiro_pagar').select('*').eq('os_id', OS_ID);
  console.log('\n--- FINANCEIRO_PAGAR ---');
  console.log(JSON.stringify(fp, null, 2) || '(vazio)');

  // 4. Pagamentos Prestadores
  const { data: pp } = await supabase.from('pagamentos_prestadores').select('*').eq('os_id', OS_ID);
  console.log('\n--- PAGAMENTOS_PRESTADORES ---');
  console.log(JSON.stringify(pp, null, 2) || '(vazio)');

  // 5. Composicao Financeira OS
  const { data: cf } = await supabase.from('composicao_financeira_os').select('*').eq('os_id', OS_ID).maybeSingle();
  console.log('\n--- COMPOSICAO_FINANCEIRA_OS ---');
  console.log(JSON.stringify(cf, null, 2) || '(vazio)');

  // 6. Check clientes table
  const { data: cli } = await supabase.from('clientes').select('id, nome_fantasia, razao_social').eq('id', os.cliente_id).maybeSingle();
  console.log('\n--- CLIENTE (by cliente_id) ---');
  console.log(JSON.stringify(cli, null, 2) || '(nao encontrado por cliente_id)');

  if (os.cliente) {
    const { data: cli2 } = await supabase.from('clientes').select('id, nome_fantasia').eq('id', os.cliente).maybeSingle();
    console.log('\n--- CLIENTE (by cliente UUID) ---');
    console.log(JSON.stringify(cli2, null, 2) || '(nao encontrado)');
  }

  // 7. Check prestadores
  const { data: pre } = await supabase.from('prestadores').select('id, nome_completo, cpf_cnpj').eq('id', os.prestador_id).maybeSingle();
  console.log('\n--- PRESTADOR ---');
  console.log(JSON.stringify(pre, null, 2) || '(nao encontrado)');
}
main().catch(e => { console.error(e); process.exit(1); });
