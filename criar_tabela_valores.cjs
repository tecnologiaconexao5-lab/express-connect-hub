const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function criarTabelaValores() {
  console.log('=== CRIANDO TABELA DE VALORES ===\n');
  
  const tabelaUniversal = [
    { tipo: 'moto', faixa: '0-10', base: 40, km: 2.5, min: 40 },
    { tipo: 'moto', faixa: '11-30', base: 40, km: 2.0, min: 65 },
    { tipo: 'moto', faixa: '31-50', base: 40, km: 1.8, min: 105 },
    { tipo: 'moto', faixa: '51-100', base: 40, km: 1.5, min: 145 },
    { tipo: 'moto', faixa: '101-200', base: 40, km: 1.2, min: 205 },
    { tipo: 'moto', faixa: '201+', base: 40, km: 1.0, min: 325 },
    
    { tipo: 'carro', faixa: '0-10', base: 60, km: 3.5, min: 60 },
    { tipo: 'carro', faixa: '11-30', base: 60, km: 3.0, min: 90 },
    { tipo: 'carro', faixa: '31-50', base: 60, km: 2.5, min: 150 },
    { tipo: 'carro', faixa: '51-100', base: 60, km: 2.2, min: 210 },
    { tipo: 'carro', faixa: '101-200', base: 60, km: 1.8, min: 330 },
    { tipo: 'carro', faixa: '201+', base: 60, km: 1.5, min: 480 },
    
    { tipo: 'fiorino', faixa: '0-10', base: 80, km: 4.5, min: 80 },
    { tipo: 'fiorino', faixa: '11-30', base: 80, km: 4.0, min: 125 },
    { tipo: 'fiorino', faixa: '31-50', base: 80, km: 3.5, min: 220 },
    { tipo: 'fiorino', faixa: '51-100', base: 80, km: 3.0, min: 290 },
    { tipo: 'fiorino', faixa: '101-200', base: 80, km: 2.8, min: 430 },
    { tipo: 'fiorino', faixa: '201+', base: 80, km: 2.5, min: 710 },
    
    { tipo: 'kombi', faixa: '0-10', base: 90, km: 5.0, min: 90 },
    { tipo: 'kombi', faixa: '11-30', base: 90, km: 4.5, min: 140 },
    { tipo: 'kombi', faixa: '31-50', base: 90, km: 4.0, min: 250 },
    { tipo: 'kombi', faixa: '51-100', base: 90, km: 3.5, min: 340 },
    { tipo: 'kombi', faixa: '101-200', base: 90, km: 3.0, min: 520 },
    { tipo: 'kombi', faixa: '201+', base: 90, km: 2.5, min: 770 },
    
    { tipo: 'van', faixa: '0-10', base: 150, km: 6.5, min: 150 },
    { tipo: 'van', faixa: '11-30', base: 150, km: 6.0, min: 225 },
    { tipo: 'van', faixa: '31-50', base: 150, km: 5.5, min: 385 },
    { tipo: 'van', faixa: '51-100', base: 150, km: 5.0, min: 535 },
    { tipo: 'van', faixa: '101-200', base: 150, km: 4.5, min: 785 },
    { tipo: 'van', faixa: '201+', base: 150, km: 4.0, min: 1235 },
    
    { tipo: 'hr', faixa: '0-10', base: 120, km: 5.5, min: 120 },
    { tipo: 'hr', faixa: '11-30', base: 120, km: 5.0, min: 175 },
    { tipo: 'hr', faixa: '31-50', base: 120, km: 4.5, min: 290 },
    { tipo: 'hr', faixa: '51-100', base: 120, km: 4.0, min: 390 },
    { tipo: 'hr', faixa: '101-200', base: 120, km: 3.5, min: 590 },
    { tipo: 'hr', faixa: '201+', base: 120, km: 3.0, min: 890 },
    
    { tipo: 'vuc', faixa: '0-10', base: 180, km: 7.5, min: 180 },
    { tipo: 'vuc', faixa: '11-30', base: 180, km: 7.0, min: 285 },
    { tipo: 'vuc', faixa: '31-50', base: 180, km: 6.5, min: 465 },
    { tipo: 'vuc', faixa: '51-100', base: 180, km: 6.0, min: 705 },
    { tipo: 'vuc', faixa: '101-200', base: 180, km: 5.5, min: 1045 },
    { tipo: 'vuc', faixa: '201+', base: 180, km: 5.0, min: 1585 },
    
    { tipo: '3/4', faixa: '0-10', base: 200, km: 8.5, min: 200 },
    { tipo: '3/4', faixa: '11-30', base: 200, km: 8.0, min: 315 },
    { tipo: '3/4', faixa: '31-50', base: 200, km: 7.5, min: 515 },
    { tipo: '3/4', faixa: '51-100', base: 200, km: 7.0, min: 765 },
    { tipo: '3/4', faixa: '101-200', base: 200, km: 6.5, min: 1165 },
    { tipo: '3/4', faixa: '201+', base: 200, km: 6.0, min: 1765 },
    
    { tipo: 'toco', faixa: '0-10', base: 220, km: 8.5, min: 220 },
    { tipo: 'toco', faixa: '11-30', base: 220, km: 8.0, min: 355 },
    { tipo: 'toco', faixa: '31-50', base: 220, km: 7.5, min: 595 },
    { tipo: 'toco', faixa: '51-100', base: 220, km: 7.0, min: 875 },
    { tipo: 'toco', faixa: '101-200', base: 220, km: 6.5, min: 1295 },
    { tipo: 'toco', faixa: '201+', base: 220, km: 6.0, min: 1975 },
    
    { tipo: 'truck', faixa: '0-10', base: 250, km: 9.5, min: 250 },
    { tipo: 'truck', faixa: '11-30', base: 250, km: 9.0, min: 395 },
    { tipo: 'truck', faixa: '31-50', base: 250, km: 8.5, min: 655 },
    { tipo: 'truck', faixa: '51-100', base: 250, km: 8.0, min: 955 },
    { tipo: 'truck', faixa: '101-200', base: 250, km: 7.5, min: 1455 },
    { tipo: 'truck', faixa: '201+', base: 250, km: 7.0, min: 2255 },
    
    { tipo: 'bitrem', faixa: '0-10', base: 350, km: 12.0, min: 350 },
    { tipo: 'bitrem', faixa: '11-30', base: 350, km: 11.5, min: 545 },
    { tipo: 'bitrem', faixa: '31-50', base: 350, km: 11.0, min: 905 },
    { tipo: 'bitrem', faixa: '51-100', base: 350, km: 10.5, min: 1355 },
    { tipo: 'bitrem', faixa: '101-200', base: 350, km: 10.0, min: 2055 },
    { tipo: 'bitrem', faixa: '201+', base: 350, km: 9.5, min: 3255 },
    
    { tipo: 'carreta', faixa: '0-10', base: 400, km: 14.0, min: 400 },
    { tipo: 'carreta', faixa: '11-30', base: 400, km: 13.5, min: 635 },
    { tipo: 'carreta', faixa: '31-50', base: 400, km: 13.0, min: 1045 },
    { tipo: 'carreta', faixa: '51-100', base: 400, km: 12.5, min: 1595 },
    { tipo: 'carreta', faixa: '101-200', base: 400, km: 12.0, min: 2395 },
    { tipo: 'carreta', faixa: '201+', base: 400, km: 11.5, min: 3795 }
  ];
  
  let inseridos = 0;
  for (const t of tabelaUniversal) {
    const [kmIni, kmFim] = t.faixa.replace('+', '-9999').split('-').map(x => parseInt(x));
    
    const registro = {
      nome: 'Universal',
      tipo_veiculo: t.tipo,
      km_inicial: kmIni,
      km_final: kmFim >= 201 ? 9999 : kmFim,
      valor_base: t.base,
      valor_km: t.km,
      valor_minimo: t.min,
      pedagio_incluso: false,
      ativo: true,
      universal: true
    };
    
    const { error } = await supabase.from('tabelas_valores').insert(registro);
    if (!error) inseridos++;
  }
  
  console.log(`Inseridos: ${inseridos} registros`);
  
  console.log('\n=== VERIFICANDO ===');
  const { data: tv } = await supabase.from('tabelas_valores').select('tipo_veiculo').limit(100);
  const tipos = [...new Set(tv?.map(x => x.tipo_veiculo))];
  console.log('Tipos de veículo:', tipos);
}

criarTabelaValores().catch(e => console.log('ERRO:', e.message));