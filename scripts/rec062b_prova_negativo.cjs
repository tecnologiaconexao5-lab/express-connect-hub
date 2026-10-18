const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MjQwMDAsImV4cCI6MjA2MzAwMDAwMH0.FAKE_ANON_KEY_FOR_TESTING';

// Use the real anon key from .env
const fs = require('fs');
const envPath = 'C:\\Users\\DIEGO BALBINO\\Desktop\\Pasta Compartilhada\\DOCUMENTOS EMPRESA\\08_TECNOLOGIA_SISTEMAS\\express-connect-hub\\.env';
const env = fs.readFileSync(envPath, 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.+)/);
const anonKeyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
const REAL_URL = urlMatch?.[1]?.trim() || SUPABASE_URL;
const REAL_ANON_KEY = anonKeyMatch?.[1]?.trim() || ANON_KEY;

const tables = [
  'recrutamento_prestadores',
  'recrutamento_candidatos',
  'crm_interacoes_prestadores',
  'candidato_documentos',
  'recrutamento_operacoes',
];

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('REC-06.2B — PROVA NEGATIVA (anon bloqueado)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const anon = createClient(REAL_URL, REAL_ANON_KEY);

  let allBlocked = true;

  for (const t of tables) {
    console.log(`--- ${t} ---`);

    // SELECT
    const { error: selErr } = await anon.from(t).select('*').limit(1);
    const selBlocked = selErr !== null;
    console.log(`  SELECT: ${selBlocked ? '✅ BLOQUEADO' : '❌ PERMITIDO'} ${selErr ? '(' + selErr.message.slice(0, 80) + ')' : ''}`);
    if (!selBlocked) allBlocked = false;

    // INSERT
    const { error: insErr } = await anon.from(t).insert({ nome: 'test_anon' }).select();
    const insBlocked = insErr !== null;
    console.log(`  INSERT: ${insBlocked ? '✅ BLOQUEADO' : '❌ PERMITIDO'} ${insErr ? '(' + insErr.message.slice(0, 80) + ')' : ''}`);
    if (!insBlocked) allBlocked = false;

    // UPDATE
    const { error: updErr } = await anon.from(t).update({ nome: 'test_anon_upd' }).eq('id', '00000000-0000-0000-0000-000000000000');
    const updBlocked = updErr !== null;
    console.log(`  UPDATE: ${updBlocked ? '✅ BLOQUEADO' : '❌ PERMITIDO'} ${updErr ? '(' + updErr.message.slice(0, 80) + ')' : ''}`);
    if (!updBlocked) allBlocked = false;

    // DELETE
    const { error: delErr } = await anon.from(t).delete().eq('id', '00000000-0000-0000-0000-000000000000');
    const delBlocked = delErr !== null;
    console.log(`  DELETE: ${delBlocked ? '✅ BLOQUEADO' : '❌ PERMITIDO'} ${delErr ? '(' + delErr.message.slice(0, 80) + ')' : ''}`);
    if (!delBlocked) allBlocked = false;

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`RESULTADO NEGATIVO: ${allBlocked ? '✅ TODAS BLOQUEADAS — ANON SEM ACESSO' : '❌ FALHA — ALGUMA TABELA PERMITE ANON'}`);
  console.log('═══════════════════════════════════════════════════════════════');

  return allBlocked;
}

run().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
