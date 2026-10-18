import { createClient } from '@supabase/supabase-js';

const sup = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468';

async function main() {
  const a = await sup.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (!a?.data?.session) { console.log('FALHA_AUTH:', a?.error?.message); return; }

  const out: Record<string, any> = {};

  // 1. OS
  const os = await sup.from('ordens_servico').select('*').eq('id', OS_ID).single();
  out.ordens_servico = os.data;
  console.log('OS:', JSON.stringify(os.data, null, 2));
  console.log('OS_ERR:', os.error?.message || '');

  // 2. Financeiro Receber
  const fr = await sup.from('financeiro_receber').select('*').eq('os_id', OS_ID).maybeSingle();
  out.financeiro_receber = fr.data;
  console.log('\nFR:', JSON.stringify(fr.data, null, 2));

  // 3. Financeiro Pagar
  const fp = await sup.from('financeiro_pagar').select('*').eq('os_id', OS_ID).maybeSingle();
  out.financeiro_pagar = fp.data;
  console.log('\nFP:', JSON.stringify(fp.data, null, 2));

  // 4. Pagamentos Prestadores
  const pp = await sup.from('pagamentos_prestadores').select('*').eq('os_id', OS_ID).maybeSingle();
  out.pagamentos_prestadores = pp.data;
  console.log('\nPP:', JSON.stringify(pp.data, null, 2));

  // 5. Composicao Financeira OS
  const cf = await sup.from('composicao_financeira_os').select('*').eq('os_id', OS_ID).maybeSingle();
  out.composicao_financeira_os = cf.data;
  console.log('\nCF:', JSON.stringify(cf.data, null, 2));

  // 6. Eventos Oficiais
  const ev = await sup.from('eventos_oficiais').select('*').eq('entity_id', OS_ID).order('created_at', { ascending: false }).limit(5);
  out.eventos_oficiais = ev.data;
  console.log('\nEV:', JSON.stringify(ev.data, null, 2));

  // 7. Alocacoes Escala (any vinculadas?)
  const al = await sup.from('alocacoes_escala').select('id, os_vinculada, status').eq('os_vinculada', OS_ID).limit(5);
  out.alocacoes_escala = al.data;
  console.log('\nAL:', JSON.stringify(al.data, null, 2));

  // 8. Check if OS has existing cliente/prestador/veiculo
  console.log('\nos.cliente:', os.data?.cliente);
  console.log('os.prestador:', os.data?.prestador);
  console.log('os.veiculo:', os.data?.veiculo);

  // Save snapshot
  const fs = await import('fs');
  fs.writeFileSync('scripts/_snapshot_atual.json', JSON.stringify(out, null, 2));
  console.log('\nSnapshot salvo em scripts/_snapshot_atual.json');
}
main().catch(e => console.error('ERR:', e));
