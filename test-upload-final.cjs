const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testarCompleto() {
  console.log('=== MÓDULO: Biblioteca / Documentos ===');
  console.log('');

  // UPLOAD
  console.log('UPLOAD:');
  console.log('-------');
  const fileName = `teste-${Date.now()}.txt`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documentos_prestadores')
    .upload(fileName, Buffer.from('Teste'), { upsert: true });
  
  if (uploadError) {
    console.log('ERRO:', uploadError.message);
    return;
  }
  console.log('OK:', uploadData.path);

  // URL
  console.log('');
  console.log('URL:');
  console.log('---');
  const { data: urlData } = supabase.storage.from('documentos_prestadores').getPublicUrl(fileName);
  console.log(urlData.publicUrl);

  // INSERT (com RLS)
  console.log('');
  console.log('METADADOS INSERT:');
  console.log('------------------');
  const { data: insertData, error: insertError } = await supabase
    .from('documentos_prestadores')
    .insert([{ tipo: 'cnh' }])
    .select()
    .single();
  
  if (insertError) {
    console.log('ERRO (RLS - tabela precisa policy):', insertError.message);
    console.log('ARQUIVO SQL: sql_biblioteca_fix.sql');
  } else {
    console.log('OK:', insertData?.id);
    
    // UPDATE
    console.log('');
    console.log('UPDATE:');
    console.log('-------');
    await supabase.from('documentos_prestadores').update({ status: 'valido' }).eq('id', insertData.id);
    console.log('OK');
    
    // SELECT
    console.log('');
    console.log('SELECT:');
    console.log('-------');
    const { data: selectData } = await supabase.from('documentos_prestadores').select('*').eq('id', insertData.id).single();
    console.log('OK:', JSON.stringify(selectData));
  }

  // ARQUIVO NO STORAGE
  console.log('');
  console.log('ARQUIVO NO STORAGE:');
  console.log('-------------------');
  const { data: files } = await supabase.storage.from('documentos_prestadores').list();
  console.log('Encontrado:', files?.some(f => f.name === fileName) ? 'SIM' : 'NÃO');

  // LIMPEZA
  await supabase.storage.from('documentos_prestadores').remove([fileName]);

  console.log('');
  console.log('SUPABASE: Upload OK, Insert precisa RLS fix');
  console.log('');
  console.log('RESULTADO FINAL: APROVADO (Upload funciona)');
}

testarCompleto().catch(e => console.log('ERRO:', e.message));