import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { guardHarness } from './scripts/_guard.mjs';

// TMS-FIN-DATA-04D3A — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness('test_os_save.mjs');

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testSave() {
  const payload = {
    numero: `OS-TEST-${Date.now()}`,
    data: new Date().toISOString().split('T')[0],
    status: 'pendente',
    tipo_operacao: 'Coleta e Entrega',
    data_programada: new Date().toISOString().split('T')[0],
  };

  const { data: clienteData } = await supabase.from('clientes').select('id, razao_social').limit(1);
  if (clienteData && clienteData.length > 0) {
    payload.cliente_id = clienteData[0].id;
    // DO NOT set payload.cliente if it's uuid and expects ID or just skip it
  }

  const { data, error } = await supabase.from('ordens_servico').insert([payload]).select();
  
  if (error) {
    console.error("ERRO AO SALVAR OS:", error);
  } else {
    console.log("SUCESSO! ID DA OS:", data[0].id);
  }
}

testSave();
