import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { toOSInsert } from './src/lib/dbMappers.js';
import { guardHarness } from './scripts/_guard.mjs';

// TMS-FIN-DATA-04D3A — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness('test_os_cep_horario.mjs');

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function runTest() {
  console.log("Iniciando teste de salvamento de OS (TESTE CEP E HORÁRIO)...");
  
  const payloadFrontend = {
    numero: `OS-TEST-${Date.now()}`,
    data: new Date().toISOString(),
    status: "rascunho",
    dataProgramada: "2026-06-20",
    previsaoInicio: "14:30",
    previsaoTermino: "16:00",
    enderecos: [
      {
        tipo: "coleta",
        cep: "01001-000",
        logradouro: "Praça da Sé",
        numero: "s/n",
        bairro: "Sé", // Bairro preenchido manualmente
        cidade: "São Paulo",
        estado: "SP",
        nomeLocal: "Ponto A",
        janelaInicio: "14:30",
        janelaFim: "16:00"
      }
    ]
  };

  try {
    const payloadDB = toOSInsert(payloadFrontend);
    delete payloadDB.cliente;
    delete payloadDB.cliente_id;
    
    const { data, error } = await supabase
      .from('ordens_servico')
      .insert([payloadDB])
      .select();

    if (error) {
      console.error("ERRO AO SALVAR OS:", error);
    } else {
      console.log("SUCESSO! OS SALVA COM SUCESSO.");
      console.log("ID DA OS GERADA:", data[0].id);
      console.log("DADOS GRAVADOS DE DATA/HORA:", {
         data_programada: data[0].data_programada,
         previsao_inicio: data[0].previsao_inicio,
         previsao_termino: data[0].previsao_termino
      });
      console.log("ENDERECO GRAVADO (JSONB):", JSON.stringify(data[0].enderecos, null, 2));
    }
  } catch (err) {
    console.error("EXCEÇÃO:", err);
  }
}

runTest();
