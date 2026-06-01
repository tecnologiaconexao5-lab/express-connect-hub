import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: p } = await supabase.from('prestadores').select('id, nome_completo').ilike('nome_completo', '%FRANKLIN%').limit(1).single();
  const { data: c } = await supabase.from('clientes').select('id, nome_fantasia').ilike('nome_fantasia', '%DVL%').limit(1).single();
  
  if(!p || !c) {
     console.log('Prestador ou Cliente não encontrado');
     return;
  }

  const payload = {
    prestador_id: p.id,
    cliente_id: c.id,
    data_escala: '2026-06-15', // Data futura
    turno: 'integral',
    tipo_veiculo: 'fiorino',
    placa: 'AAA1111',
    status: 'planejada',
    status_pagamento: 'pendente',
    valor_fixo: 0,
    valor_repasse: 0,
    valor_frete: 37.80,
    valor_pedagio: 0,
    valor_combustivel: 0,
    valor_ajudante: 0,
    valor_adicional: 0,
    valor_desconto: 0,
    km_realizados: 118,
    metadata: {
      tipo: 'reserva',
      kmInicial: 0,
      kmFinal: 118,
      prestadorNome: p.nome_completo,
      clienteNome: c.nome_fantasia,
      observacoes: 'Teste inserção inicial'
    }
  };

  // 1. TESTE DE INSERT
  console.log('--- 1. TESTE INSERT ---');
  const { data: inserted, error } = await supabase.from('alocacoes_escala').insert([payload]).select('id').single();
  if (error) {
     console.log('ERRO INSERT:', error);
     return;
  }
  const idReal = inserted.id;
  console.log('ID CRIADO NO BANCO:', idReal);

  // 2. TESTE DE PERSISTÊNCIA (RELOAD)
  console.log('\n--- 2. TESTE PERSISTÊNCIA (SIMULAÇÃO RELOAD/F5) ---');
  const { data: fetched1 } = await supabase.from('alocacoes_escala').select('*').eq('id', idReal).single();
  console.log('Prestador persistido:', fetched1.prestador_id === p.id ? 'SIM' : 'NÃO');
  console.log('Cliente persistido:', fetched1.cliente_id === c.id ? 'SIM' : 'NÃO');
  console.log('Tipo persistido (necessário para o controle diário):', fetched1.metadata.tipo === 'reserva' ? 'SIM' : 'NÃO');
  console.log('KM Final:', fetched1.metadata.kmFinal);

  // 3. TESTE DE UPDATE
  console.log('\n--- 3. TESTE DE UPDATE REAL ---');
  const payloadUpdate = {
     km_realizados: 200,
     metadata: { ...fetched1.metadata, kmFinal: 200, observacoes: 'Alterado via Update' }
  };
  const { error: errorUpdate } = await supabase.from('alocacoes_escala').update(payloadUpdate).eq('id', idReal);
  if (errorUpdate) {
     console.log('ERRO UPDATE:', errorUpdate);
     return;
  }
  const { data: fetched2 } = await supabase.from('alocacoes_escala').select('metadata, km_realizados').eq('id', idReal).single();
  console.log('Update funcionou e NÃO duplicou registro?', fetched2.km_realizados === 200 ? 'SIM' : 'NAO');
  console.log('Nova observação:', fetched2.metadata.observacoes);

  // 4. TESTE DE DELETE
  console.log('\n--- 4. TESTE DE DELETE REAL ---');
  const { error: deleteErr } = await supabase.from('alocacoes_escala').delete().eq('id', idReal);
  if (deleteErr) {
     console.log('ERRO DELETE:', deleteErr);
     return;
  }
  
  const { data: fetched3 } = await supabase.from('alocacoes_escala').select('id').eq('id', idReal).maybeSingle();
  console.log('Registro excluído fisicamente e sumiu de todas as visões?', fetched3 === null ? 'SIM' : 'NAO');
  
  console.log('\n--- VALIDAÇÃO TOTAL CONCLUÍDA ---');
}
run();
