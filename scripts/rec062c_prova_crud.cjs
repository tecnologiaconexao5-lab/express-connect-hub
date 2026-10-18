const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';
const ADMIN_EMAIL = 'tamiris.castilho@conexaoexpress.com.br';
const ADMIN_PASSWORD = 'Conexao@2026';
const TABLE = 'recrutamento_automacoes';
const TEST_TAG = 'TESTE_RLS_062C';
const ts = Date.now();

async function authenticate() {
  const c = createClient(PROD_URL, ANON_KEY);
  const { data, error } = await c.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error || !data.session) { console.error('FALHA:', error?.message); process.exit(1); }
  const uid = data.session.user.id;
  console.log('auth.uid:', uid.substring(0,8)+'...'+uid.substring(uid.length-4));
  console.log('role:', data.session.user.role);
  console.log('session: OK');
  return c;
}

async function testCrud(client) {
  console.log('\n--- CRUD authenticated ---');
  const results = { SELECT: false, INSERT: false, UPDATE: false, DELETE: false };

  // SELECT
  const { data: sel, error: selErr } = await client.from(TABLE).select('*').limit(2);
  results.SELECT = !selErr;
  console.log('  SELECT:', results.SELECT ? 'OK ('+sel?.length+' rows)' : 'BLOQUEADO ('+selErr?.message?.substring(0,80)+')');

  // INSERT 3 automações
  const automacoes = [
    { nome: TEST_TAG+'_whatsapp_'+ts, tipo: 'whatsapp', trigger: { evento: 'novo_candidato' }, acao: { enviar_mensagem: true }, status: 'ativa' },
    { nome: TEST_TAG+'_score_'+ts, tipo: 'score', trigger: { score_min: 70 }, acao: { priorizar: true }, status: 'pausada' },
    { nome: TEST_TAG+'_doc_'+ts, tipo: 'validade_documento', trigger: { dias_antecedencia: 30 }, acao: { notificar: true }, status: 'ativa' },
  ];

  const { data: ins, error: insErr } = await client.from(TABLE).insert(automacoes).select();
  results.INSERT = !insErr;
  console.log('  INSERT:', results.INSERT ? 'OK ('+ins?.length+' rows)' : 'BLOQUEADO ('+insErr?.message?.substring(0,80)+')');

  if (ins && ins.length > 0) {
    // UPDATE
    const firstId = ins[0].id;
    const { error: updErr } = await client.from(TABLE).update({ status: 'desativada' }).eq('id', firstId);
    results.UPDATE = !updErr;
    console.log('  UPDATE:', results.UPDATE ? 'OK' : 'BLOQUEADO ('+updErr?.message?.substring(0,80)+')');

    // DELETE all 3
    const ids = ins.map(i => i.id);
    const { error: delErr } = await client.from(TABLE).delete().in('id', ids);
    results.DELETE = !delErr;
    console.log('  DELETE:', results.DELETE ? 'OK ('+ids.length+' rows)' : 'BLOQUEADO ('+delErr?.message?.substring(0,80)+')');
  }

  return results;
}

async function testAnon() {
  console.log('\n--- ANON (sem autenticação) ---');
  const anon = createClient(PROD_URL, ANON_KEY);
  let blocked = 0, total = 0;

  for (const op of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    total++;
    let err = null;
    if (op === 'SELECT') ({ error: err } = await anon.from(TABLE).select('*').limit(1));
    else if (op === 'INSERT') ({ error: err } = await anon.from(TABLE).insert({ nome: 'anon_test', tipo: 'email' }));
    else if (op === 'UPDATE') ({ error: err } = await anon.from(TABLE).update({ status: 'desativada' }).eq('id', '00000000-0000-0000-0000-000000000000'));
    else if (op === 'DELETE') ({ error: err } = await anon.from(TABLE).delete().eq('id', '00000000-0000-0000-0000-000000000000'));
    if (err) blocked++;
  }

  console.log('  ANON:', blocked+'/'+total+' bloqueadas');
  return { blocked, total };
}

async function verifyCleanup(client) {
  console.log('\n--- VERIFICAÇÃO FINAL ---');
  const { data } = await client.from(TABLE).select('id').like('nome', TEST_TAG+'%');
  console.log('  Registros TESTE restantes:', data?.length || 0);
  return (data?.length || 0) === 0;
}

(async () => {
  console.log('=== REC-06.2C — PROVA CRUD AUTHENTICATED ===\n');

  const client = await authenticate();
  const crudResults = await testCrud(client);
  const anonResults = await testAnon();
  const clean = await verifyCleanup(client);

  console.log('\n=== VEREDITO ===');
  const allOk = crudResults.SELECT && crudResults.INSERT && crudResults.UPDATE && crudResults.DELETE;
  if (allOk && anonResults.blocked === anonResults.total && clean) {
    console.log('HOMOLOGADO — AUTOMAÇÕES REAIS');
  } else {
    console.log('NÃO HOMOLOGADO — verificar resultados acima');
  }
})();
