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
    data_escala: '2026-05-29',
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
      clienteNome: c.nome_fantasia
    }
  };

  const { data: inserted, error } = await supabase.from('alocacoes_escala').insert([payload]).select('id').single();
  if (error) {
     console.log('ERRO INSERT:', error);
     return;
  }
  
  console.log('--- SUCESSO! ---');
  console.log('ID CRIADO:', inserted.id);
  
  // Agora simulando o loadAlocacoes
  const { data: fetched, error: fetchErr } = await supabase.from('alocacoes_escala').select('metadata').eq('id', inserted.id).single();
  if (fetchErr) {
      console.log('ERRO FETCH:', fetchErr);
      return;
  }
  
  console.log('TIPO RECUPERADO (GARANTE EXIBIÇÃO NO CONTROLE DIÁRIO):', fetched.metadata.tipo);
  
  // Cleanup para não sujar seu banco
  await supabase.from('alocacoes_escala').delete().eq('id', inserted.id);
  console.log('TESTE CONCLUIDO (registro removido após validação)');
}
run();
