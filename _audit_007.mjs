// [BLOCKED-PARCIAL] TMS-FIN-DATA-04D3C4 — contem POST externo (proxy-ia); NAO e read-only puro.
import pg from 'pg';
const { Client } = pg;

// TMS-FIN-DATA-04D3C4 — READ-ONLY. Credencial SOMENTE via env explicita; sem fallback para .env PROD.
const DATABASE_URL = process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[FAIL-CLOSED] Defina AUDIT_DATABASE_URL (ou DATABASE_URL). Nenhuma conexao foi feita.');
  process.exit(1);
}
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  // EVENTOS OFICIAIS - colunas corretas
  console.log('=== EVENTOS OFICIAIS ===');
  const evCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='eventos_oficiais' ORDER BY ordinal_position");
  console.log('Colunas:', evCols.rows.map(c => c.column_name).join(', '));
  
  const ev = await client.query('SELECT * FROM eventos_oficiais ORDER BY created_at DESC LIMIT 5');
  if (ev.rows.length > 0) {
    ev.rows.forEach(r => console.log(' ', JSON.stringify(r)));
  }

  // OPERATION_TIMELINE_EVENTS
  console.log('\n=== OPERATION_TIMELINE_EVENTS ===');
  const otCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='operation_timeline_events' ORDER BY ordinal_position");
  console.log('Colunas:', otCols.rows.map(c => c.column_name).join(', '));
  const ot = await client.query('SELECT * FROM operation_timeline_events ORDER BY created_at DESC LIMIT 5');
  if (ot.rows.length > 0) {
    ot.rows.forEach(r => console.log(' ', JSON.stringify(r)));
  }

  // PORTAL AVALIACOES
  console.log('\n=== PORTAL AVALIACOES ===');
  const paCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='portal_avaliacoes' ORDER BY ordinal_position");
  console.log('Colunas:', paCols.rows.map(c => c.column_name).join(', '));
  const pa = await client.query('SELECT * FROM portal_avaliacoes LIMIT 5');
  pa.rows.forEach(r => console.log(' ', JSON.stringify(r)));

  // PORTAL_FATURAS
  console.log('\n=== PORTAL_FATURAS ===');
  const pf = await client.query('SELECT * FROM portal_faturas LIMIT 5');
  pf.rows.forEach(r => console.log(' ', JSON.stringify(r)));

  // PORTAL_PROTOCOLOS
  console.log('\n=== PORTAL_PROTOCOLOS ===');
  const ppt = await client.query('SELECT * FROM portal_protocolos LIMIT 5');
  ppt.rows.forEach(r => console.log(' ', JSON.stringify(r)));

  // FISCAL
  console.log('\n=== FISCAL ===');
  const cte = await client.query('SELECT count(*) as total FROM fiscal_ctes');
  console.log('fiscal_ctes:', cte.rows[0].total);
  if (cte.rows[0].total > 0) {
    const cteD = await client.query('SELECT id, os_id, numero, tomador, status, created_at FROM fiscal_ctes ORDER BY created_at DESC LIMIT 5');
    cteD.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| OS:', r.os_id?.slice(0,8), '|', r.numero, '| tomador:', r.tomador, '|', r.status));
  }
  const nfse = await client.query('SELECT count(*) as total FROM fiscal_nfse');
  console.log('fiscal_nfse:', nfse.rows[0].total);

  // INTEGRACOES
  console.log('\n=== INTEGRACOES ===');
  const iaConect = await client.query('SELECT id, nome, tipo, modo, status FROM ia_conectores');
  console.log('ia_conectores:');
  iaConect.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.nome, '|', r.tipo, '|', r.modo, '|', r.status));

  // VERIFICAR DADOS DE ARQUIVOS/MIDIA
  console.log('\n=== STORAGE ===');
  // Check if there's any Storage bucket access
  try {
    const buckets = await client.query("SELECT * FROM storage.buckets");
    console.log('Buckets:', buckets.rows.length);
    buckets.rows.forEach(r => console.log(' ', r.id, '|', r.name, '| public:', r.public));
  } catch(e) {
    console.log('Storage query failed:', e.message);
  }

  // CHECK SUPABASE FUNCTIONS STATUS
  console.log('\n=== EDGE FUNCTIONS ===');
  // Try to call the proxy-ia edge function
  try {
    const url = (process.env.VITE_SUPABASE_URL || '') + '/functions/v1/proxy-ia';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (process.env.AUDIT_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '')
      },
      body: JSON.stringify({ provider: 'groq', model: 'test', prompt: 'test' })
    });
    console.log('proxy-ia status:', resp.status, resp.statusText);
    const text = await resp.text();
    console.log('Response:', text.slice(0, 200));
  } catch(e) {
    console.log('proxy-ia error:', e.message);
  }

  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}