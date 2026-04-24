const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

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