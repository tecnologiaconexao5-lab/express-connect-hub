const { createClient } = require('@supabase/supabase-js');
const { guardHarness } = require("../_guard.cjs");

// TMS-FIN-DATA-04D3C3B2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/teste_os.cjs");


const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function teste() {
  console.log('=== TESTE FINAL ===\n');
  
  const novaOS = {
    numero: `OS-TST-${Date.now()}`,
    data: new Date().toISOString().split('T')[0],
    status: 'rascunho',
    tipo_operacao: 'coleta_entrega',
    veiculo_tipo: 'van',
    distancia_rota: 15.5,
    valor_cliente: 243.00,
    enderecos: JSON.stringify([
      { tipo: 'coleta', endereco: 'Av. Paulista, 1000 - São Paulo - SP' },
      { tipo: 'entrega', endereco: 'Aeroporto de Congonhas - São Paulo - SP' }
    ])
  };
  
  console.log('Inserindo OS...');
  const { data: OS, error } = await supabase.from('ordens_servico').insert(novaOS).select().single();
  
  if (error) {
    console.log('ERRO:', error.message);
  } else {
    console.log('OS ID:', OS?.id);
    
    const { data: sel } = await supabase
      .from('ordens_servico')
      .select('numero, distancia_rota, valor_cliente, veiculo_tipo')
      .eq('id', OS.id)
      .single();
    
    console.log('SELECT:', sel);
  }
}

teste().catch(e => console.log('ERRO:', e.message));