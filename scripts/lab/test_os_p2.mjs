import { createClient } from '@supabase/supabase-js';
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3C3B2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/test_os_p2.mjs");


const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const timestamp = Date.now();

async function testA_CEPPrimeiro() {
  console.log('\n=== TESTE A: CEP primeiro ===');
  
  const enderecos = [{
    tipo: "coleta",
    cep: "01001-000",
    logradouro: "Praça da Sé",
    numero: "100",
    complemento: "Sala 1",
    bairro: "Sé",
    cidade: "São Paulo",
    estado: "SP",
    referencia: "Próximo à catedral",
    nomeLocal: "CD Matriz",
    responsavel: "João",
    telefone: "11999999999",
    email: "teste@teste.com",
    observacaoPonto: "Entrar pela lateral"
  }, {
    tipo: "entrega",
    cep: "01310-100",
    logradouro: "Avenida Paulista",
    numero: "2000",
    complemento: "",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    referencia: "",
    nomeLocal: "Cliente Teste",
    responsavel: "Maria",
    telefone: "11988888888",
    email: "",
    observacaoPonto: ""
  }];

  const payload = {
    numero: `OS-P2-TEST-A-${timestamp}`,
    data: new Date().toISOString().split('T')[0],
    tipo_operacao: 'Coleta e Entrega',
    status: 'rascunho',
    enderecos,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('ordens_servico').insert([payload]).select('id, numero, enderecos').single();
  
  if (error) {
    console.error('ERRO:', error.message);
    return null;
  }
  
  console.log('OS criada:', data.id);
  console.log('Numero:', data.numero);
  
  // Verify data
  const endDB = data.enderecos || [];
  console.log('Enderecos salvos:', endDB.length, 'paradas');
  if (endDB[0]) {
    console.log('  [0] CEP:', endDB[0].cep, '| Bairro:', endDB[0].bairro, '| Cidade:', endDB[0].cidade, '| UF:', endDB[0].estado);
    console.log('  [0] Logradouro:', endDB[0].logradouro, '| Numero:', endDB[0].numero);
  }
  if (endDB[1]) {
    console.log('  [1] CEP:', endDB[1].cep, '| Bairro:', endDB[1].bairro, '| Cidade:', endDB[1].cidade, '| UF:', endDB[1].estado);
  }
  
  // Recarregar para confirmar persistencia
  const { data: reloaded } = await supabase.from('ordens_servico').select('enderecos').eq('id', data.id).single();
  console.log('Recarregado OK:', reloaded?.enderecos?.length, 'paradas');
  
  return data.id;
}

async function testB_EnderecoManual() {
  console.log('\n=== TESTE B: Endereco manual ===');
  
  const enderecos = [{
    tipo: "coleta",
    logradouro: "Rua Augusta",
    numero: "500",
    bairro: "Consolação",
    cidade: "São Paulo",
    estado: "SP",
    cep: "",
    nomeLocal: "Origem Manual",
    responsavel: "Pedro",
    telefone: "11977777777"
  }];

  const payload = {
    numero: `OS-P2-TEST-B-${timestamp}`,
    data: new Date().toISOString().split('T')[0],
    tipo_operacao: 'Coleta',
    status: 'rascunho',
    enderecos,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('ordens_servico').insert([payload]).select('id, numero, enderecos').single();
  
  if (error) {
    console.error('ERRO:', error.message);
    return null;
  }
  
  console.log('OS criada:', data.id);
  const endDB = data.enderecos || [];
  console.log('Bairro salvo:', endDB[0]?.bairro || '(vazio)');
  console.log('Cidade salva:', endDB[0]?.cidade || '(vazia)');
  console.log('Logradouro:', endDB[0]?.logradouro || '(vazio)');
  
  const { data: reloaded } = await supabase.from('ordens_servico').select('enderecos').eq('id', data.id).single();
  console.log('Recarregado - Bairro:', reloaded?.enderecos?.[0]?.bairro);
  
  return data.id;
}

async function testC_ServicoProgramado() {
  console.log('\n=== TESTE C: Servico programado ===');
  
  const agora = new Date();
  const dataProg = agora.toISOString().split('T')[0];
  const horaInicio = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`;
  const horaFim = `${(agora.getHours()+2).toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`;

  const payload = {
    numero: `OS-P2-TEST-C-${timestamp}`,
    data: new Date().toISOString().split('T')[0],
    tipo_operacao: 'Entrega',
    status: 'agendada',
    data_programada: dataProg,
    previsao_inicio: horaInicio,
    previsao_termino: horaFim,
    janela_operacional: `${horaInicio} às ${horaFim}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('ordens_servico').insert([payload]).select('id, numero, data_programada, previsao_inicio, previsao_termino').single();
  
  if (error) {
    console.error('ERRO:', error.message);
    return null;
  }
  
  console.log('OS criada:', data.id);
  console.log('Data programada:', data.data_programada);
  console.log('Horario inicio:', data.previsao_inicio);
  console.log('Horario fim:', data.previsao_termino);
  
  // Recarregar
  const { data: reloaded } = await supabase.from('ordens_servico').select('data_programada, previsao_inicio, previsao_termino').eq('id', data.id).single();
  console.log('Recarregado - Data:', reloaded?.data_programada);
  console.log('Recarregado - Inicio:', reloaded?.previsao_inicio);
  console.log('Recarregado - Fim:', reloaded?.previsao_termino);
  
  return data.id;
}

async function limpar(ids) {
  for (const id of ids) {
    if (id) {
      await supabase.from('ordens_servico').delete().eq('id', id);
      console.log('Deletado:', id);
    }
  }
}

async function main() {
  const ids = [];
  
  ids.push(await testA_CEPPrimeiro());
  ids.push(await testB_EnderecoManual());
  ids.push(await testC_ServicoProgramado());
  
  console.log('\n=== LIMPEZA ===');
  await limpar(ids);
  console.log('\nTodos os testes concluidos.');
}

main();
