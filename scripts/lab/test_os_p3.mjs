import { createClient } from '@supabase/supabase-js';
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3C3B2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/test_os_p3.mjs");


const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const timestamp = Date.now();

async function testA_RotaRapida() {
  console.log('\n=== TESTE A: Rota mais rapida ===');
  
  const payload = {
    numero: `OS-P3-TEST-A-${timestamp}`,
    data: new Date().toISOString().split('T')[0],
    tipo_operacao: 'Coleta e Entrega',
    status: 'rascunho',
    distancia_rota: {
      distancia_km: 12.5,
      duracao_min: 25,
      distancia_texto: "12,5 km",
      duracao_texto: "25 min",
      tipo_rota: "rapida",
      alternativas: {
        rapida: { distanciaKm: 12.5, duracaoMin: 25, distanciaTexto: "12,5 km", duracaoTexto: "25 min" },
        curta: { distanciaKm: 11.8, duracaoMin: 30, distanciaTexto: "11,8 km", duracaoTexto: "30 min" },
        operacional: { distanciaKm: 12.5, duracaoMin: 25, distanciaTexto: "12,5 km", duracaoTexto: "25 min" }
      }
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('ordens_servico').insert([payload]).select('id, numero, distancia_rota').single();
  if (error) { console.error('ERRO:', error.message); return null; }
  
  console.log('OS criada:', data.id);
  console.log('distancia_rota.tipo_rota:', data.distancia_rota?.tipo_rota);
  console.log('distancia_rota.distancia_km:', data.distancia_rota?.distancia_km);
  console.log('distancia_rota.alternativas:', data.distancia_rota?.alternativas ? 'present' : 'absent');
  
  const { data: reloaded } = await supabase.from('ordens_servico').select('distancia_rota').eq('id', data.id).single();
  console.log('Recarregado - tipo_rota:', reloaded?.distancia_rota?.tipo_rota);
  console.log('Recarregado - distancia:', reloaded?.distancia_rota?.distancia_km, 'km');
  return data.id;
}

async function testB_RotaCurta() {
  console.log('\n=== TESTE B: Rota mais curta ===');
  
  const payload = {
    numero: `OS-P3-TEST-B-${timestamp}`,
    data: new Date().toISOString().split('T')[0],
    tipo_operacao: 'Entrega',
    status: 'rascunho',
    distancia_rota: {
      distancia_km: 8.3,
      duracao_min: 22,
      distancia_texto: "8,3 km",
      duracao_texto: "22 min",
      tipo_rota: "curta",
      alternativas: {
        rapida: { distanciaKm: 10.2, duracaoMin: 18, distanciaTexto: "10,2 km", duracaoTexto: "18 min" },
        curta: { distanciaKm: 8.3, duracaoMin: 22, distanciaTexto: "8,3 km", duracaoTexto: "22 min" },
        operacional: { distanciaKm: 8.3, duracaoMin: 22, distanciaTexto: "8,3 km", duracaoTexto: "22 min" }
      }
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('ordens_servico').insert([payload]).select('id, distancia_rota').single();
  if (error) { console.error('ERRO:', error.message); return null; }
  
  console.log('OS criada:', data.id);
  console.log('tipo_rota:', data.distancia_rota?.tipo_rota);
  console.log('distancia:', data.distancia_rota?.distancia_km, 'km');
  
  const { data: reloaded } = await supabase.from('ordens_servico').select('distancia_rota').eq('id', data.id).single();
  console.log('Recarregado - tipo_rota:', reloaded?.distancia_rota?.tipo_rota);
  return data.id;
}

async function testC_TrocaManual() {
  console.log('\n=== TESTE C: Troca manual veiculo/tabela ===');
  
  const payload = {
    numero: `OS-P3-TEST-C-${timestamp}`,
    data: new Date().toISOString().split('T')[0],
    tipo_operacao: 'Coleta',
    status: 'rascunho',
    veiculo_tipo: "Moto",
    tabela_aplicada: "Tabela Padrao SP Moto",
    valor_cliente: 35,
    custo_prestador: 25,
    distancia_rota: {
      distancia_km: 5,
      duracao_min: 15,
      distancia_texto: "5,0 km",
      duracao_texto: "15 min",
      tipo_rota: "curta",
      ajuste_manual: {
        motivo: "Veiculo substituido",
        tabela_original: "Tabela Padrao SP Fiorino",
        veiculo_original: "Fiorino",
        valor_cliente_original: 55,
        custo_prestador_original: 40,
        usuario: "Operador",
        data: new Date().toISOString()
      }
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('ordens_servico').insert([payload]).select('id, veiculo_tipo, tabela_aplicada, valor_cliente, custo_prestador, distancia_rota').single();
  if (error) { console.error('ERRO:', error.message); return null; }
  
  console.log('OS criada:', data.id);
  console.log('veiculo_tipo:', data.veiculo_tipo);
  console.log('tabela_aplicada:', data.tabela_aplicada);
  console.log('valor_cliente:', data.valor_cliente);
  console.log('custo_prestador:', data.custo_prestador);
  console.log('distancia_rota.ajuste_manual:', JSON.stringify(data.distancia_rota?.ajuste_manual));
  
  const { data: reloaded } = await supabase.from('ordens_servico').select('distancia_rota').eq('id', data.id).single();
  console.log('Recarregado - motivo:', reloaded?.distancia_rota?.ajuste_manual?.motivo);
  console.log('Recarregado - veic_original:', reloaded?.distancia_rota?.ajuste_manual?.veiculo_original);
  console.log('Recarregado - valor_original:', reloaded?.distancia_rota?.ajuste_manual?.valor_cliente_original);
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
  ids.push(await testA_RotaRapida());
  ids.push(await testB_RotaCurta());
  ids.push(await testC_TrocaManual());
  
  console.log('\n=== LIMPEZA ===');
  await limpar(ids);
  console.log('\nTodos os testes concluidos.');
}

main();
