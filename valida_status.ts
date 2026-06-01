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

  const novoStatus = 'em_rota'; // Novo status semântico validado

  const payload = {
    prestador_id: p.id,
    cliente_id: c.id,
    data_escala: '2026-06-20', 
    turno: 'integral',
    tipo_veiculo: 'fiorino',
    placa: 'AAA1111',
    status: (novoStatus === 'finalizado' || novoStatus === 'cancelado' || novoStatus === 'confirmado') ? novoStatus : 'planejada',
    status_pagamento: 'pendente',
    valor_fixo: 0,
    valor_repasse: 0,
    valor_frete: 37.80,
    km_realizados: 118,
    metadata: {
      tipo: 'reserva',
      kmInicial: 0,
      kmFinal: 118,
      prestadorNome: p.nome_completo,
      clienteNome: c.nome_fantasia,
      observacaoOperacional: 'Motorista em rota de entrega.',
      statusOperacional: novoStatus
    }
  };

  // 1. TESTE DE INSERT
  console.log('--- 1. TESTE INSERT COM STATUS EM ROTA ---');
  const { data: inserted, error } = await supabase.from('alocacoes_escala').insert([payload]).select('id').single();
  if (error) {
     console.log('ERRO INSERT:', error);
     return;
  }
  const idReal = inserted.id;
  console.log('ID CRIADO NO BANCO:', idReal);

  // 2. TESTE DE PERSISTÊNCIA (RELOAD)
  console.log('\\n--- 2. TESTE PERSISTÊNCIA (SIMULAÇÃO F5) ---');
  const { data: fetched1 } = await supabase.from('alocacoes_escala').select('*').eq('id', idReal).single();
  console.log('Status Root Fallback:', fetched1.status);
  console.log('Status Operacional (Real):', fetched1.metadata?.statusOperacional);
  console.log('Observacao Operacional:', fetched1.metadata?.observacaoOperacional);

  // Cleanup
  await supabase.from('alocacoes_escala').delete().eq('id', idReal);
  console.log('\\n--- TESTE FINALIZADO COM SUCESSO ---');
}
run();
