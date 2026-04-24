const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditar() {
  console.log('=== AUDITORIA MAPBOX ===\n');
  
  console.log('1. Verificando .env...');
  const fs = require('fs');
  let envContent = '';
  try { envContent = fs.readFileSync('./.env', 'utf8'); } catch(e) {}
  const hasMapboxToken = envContent.includes('MAPBOX');
  console.log('MAPBOX no .env:', hasMapboxToken ? 'OK' : 'NÃO EXISTE');
  console.log('Token esperado: VITE_MAPBOX_ACCESS_TOKEN');
  
  console.log('\n2. Verificando tabelas_valores...');
  const { data: tv, error: eTV } = await supabase.from('tabelas_valores').select('*').limit(1);
  console.log('tabelas_valores:', eTV?.message || (tv ? 'EXISTE' : 'NÃO EXISTE'));
  
  console.log('\n3. Estrutura da OS...');
  const { data: os } = await supabase.from('ordens_servico').select('*').limit(1);
  const osKeys = os ? Object.keys(os[0]) : [];
  console.log('distancia_rota:', osKeys.includes('distancia_rota') ? 'EXISTE' : 'NÃO EXISTE');
  console.log('valor_cliente:', osKeys.includes('valor_cliente') ? 'EXISTE' : 'NÃO EXISTE');
  console.log('veiculo_tipo:', osKeys.includes('veiculo_tipo') ? 'EXISTE' : 'NÃO EXISTE');
  
  console.log('\n4. Verificando veiculos...');
  const { data: veiculos } = await supabase.from('veiculos').select('tipo_veiculo').limit(10);
  console.log('Tipos de veículo:', [...new Set(veiculos?.map(v => v.tipo_veiculo))]);
}

auditar().catch(e => console.log('ERRO:', e.message));