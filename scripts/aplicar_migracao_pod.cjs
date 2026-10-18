const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function aplicarSQL(sql) {
  // Tenta via exec_sql RPC
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.log('RPC exec_sql falhou:', error.message);
    console.log('Execute o SQL manualmente no Supabase SQL Editor:');
    console.log('Arquivo: supabase/migrations/20260618_entregas_protocolo_pod.sql');
    return false;
  }
  return true;
}

async function criarBucket() {
  // Tenta criar bucket via REST API
  const { data, error } = await supabase
    .storage
    .createBucket('comprovantes-entrega', {
      public: true,
      fileSizeLimit: 20971520,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    });
  if (error && !error.message?.includes('already exists')) {
    console.log('Criacao de bucket falhou:', error.message);
    console.log('Crie manualmente no Supabase Dashboard > Storage');
    return false;
  }
  console.log('Bucket comprovantes-entrega OK');
  return true;
}

async function main() {
  console.log('=== Aplicando migracao POD ===\n');

  // 1. Criar tabela + bucket via SQL
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260618_entregas_protocolo_pod.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  const sqlOk = await aplicarSQL(sql);
  if (!sqlOk) {
    console.log('\n*** ACAO NECESSARIA ***');
    console.log('1. Abra o Supabase Dashboard');
    console.log('2. Va em SQL Editor');
    console.log('3. Cole e execute o conteudo de:');
    console.log('   supabase/migrations/20260618_entregas_protocolo_pod.sql');
    return;
  }

  // 2. Criar bucket via Storage API
  await criarBucket();

  console.log('\nMigracao aplicada com sucesso!');
}

main();
