const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  // 1. Does documento_analises exist?
  const da = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='documento_analises' AND table_schema='public') as has");
  console.log('=== documento_analises exists ===', da.rows[0].has);

  // 2. Check if AcompanhamentoDocs actually queries candidato_documentos
  const fs = require('fs');
  const path = require('path');
  const accompaPath = path.join(__dirname, '..', 'src', 'components', 'recrutamento', 'AcompanhamentoDocs.tsx');
  if (fs.existsSync(accompaPath)) {
    const content = fs.readFileSync(accompaPath, 'utf8');
    const hasFrom = content.includes('.from("candidato_documentos")');
    const hasInsert = content.includes('.insert(');
    console.log('\n=== AcompanhamentoDocs ===');
    console.log('  Queries candidato_documentos:', hasFrom);
    console.log('  Has insert:', hasInsert);
    
    // Find the actual from() calls
    const fromMatches = content.match(/\.from\("[^"]+"\)/g);
    console.log('  from() calls:', fromMatches);
  } else {
    console.log('\n=== AcompanhamentoDocs file NOT FOUND ===');
  }

  // 3. Check recrutamentoIntegracao.ts for candidato_documentos usage
  const integracaoPath = path.join(__dirname, '..', 'src', 'services', 'recrutamentoIntegracao.ts');
  if (fs.existsSync(integracaoPath)) {
    const content = fs.readFileSync(integracaoPath, 'utf8');
    const fromMatches = content.match(/\.from\("[^"]+"\)/g);
    console.log('\n=== recrutamentoIntegracao.ts from() calls ===');
    console.log('  ', fromMatches);
    
    // Check if it inserts into candidato_documentos
    const lines = content.split('\n');
    const cdLines = lines.filter(l => l.includes('candidato_documentos'));
    console.log('  candidato_documentos references:', cdLines.length);
  }

  // 4. Check recrutamento_candidatos for documentos JSONB
  const rcJsonb = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='recrutamento_candidatos' AND column_name='documentos'");
  console.log('\n=== recrutamento_candidatos.documentos ===');
  if (rcJsonb.rows.length === 0) console.log('  Column does not exist');
  else console.log('  Column:', rcJsonb.rows[0].column_name, rcJsonb.rows[0].data_type);

  // 5. candidatos table - check for documentos column
  const cJsonb = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='candidatos' AND column_name='documentos'");
  console.log('\n=== candidatos.documentos ===');
  if (cJsonb.rows.length === 0) console.log('  Column does not exist');
  else console.log('  Column:', cJsonb.rows[0].column_name, cJsonb.rows[0].data_type);

  // 6. Check if there's a migration that was supposed to create candidato_documentos
  const allMigs = fs.readdirSync(path.join(__dirname, '..', 'supabase', 'migrations')).filter(f => f.includes('candidato') || f.includes('documento'));
  console.log('\n=== Migrations with candidato/documento ===');
  allMigs.forEach(f => console.log('  ' + f));

  await c.end();
  console.log('\n=== PREFLIGHT PHASE 2 COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
