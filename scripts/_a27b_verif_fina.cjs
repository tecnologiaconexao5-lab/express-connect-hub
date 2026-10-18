const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();

  // RPC A27: verificar exatamente onde aparecem valor_cliente / margem / custos
  const rpc = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_buscar_oportunidades_para_prestador'`);
  const rdef = rpc.rows[0].def;
  console.log('=== RPC A27: ocorrências sensíveis ===');
  ['valor_cliente', 'margem', 'custo', 'prestador_id'].forEach(k => {
    console.log(`  '${k}': ${rdef.includes(k) ? 'PRESENTE' : 'ausente'}`);
  });
  // mostrar contexto das ocorrências valor_prestador (esperado) vs valor_cliente
  const m1 = rdef.match(/.{60}valor_cliente.{60}/g);
  const m2 = rdef.match(/.{40}margem.{40}/g);
  console.log('  contexto valor_cliente:', m1 || 'nenhum');
  console.log('  contexto margem:', m2 || 'nenhum');

  // f_aceitar: onde está ON CONFLICT?
  const ace = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
  const adef = ace.rows[0].def;
  console.log('\n=== f_aceitar: ocorrências ON CONFLICT ===');
  const conflicts = [];
  const re = /.{50}ON CONFLICT.{80}/g;
  let mm;
  while ((mm = re.exec(adef)) !== null) conflicts.push(mm[0].replace(/\s+/g, ' ').trim());
  console.log(conflicts.length ? conflicts : 'nenhum ON CONFLICT');
  // confirmar check-then-insert nas tabelas principais
  console.log('  IF EXISTS alocacoes:', adef.includes('IF EXISTS (SELECT 1 FROM public.alocacoes_escala'));
  console.log('  IF EXISTS rotas:', adef.includes('IF EXISTS (SELECT 1 FROM public.rotas'));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });