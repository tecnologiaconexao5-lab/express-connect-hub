const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DOTENV = fs.readFileSync(path.resolve('.env'), 'utf8');
const DATABASE_URL = DOTENV.split(/\r?\n/).find(l => l.startsWith('DATABASE_URL='))?.split('=').slice(1).join('=').trim();
if (!DATABASE_URL) throw new Error('DATABASE_URL não encontrado');

const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 30000 });

async function main() {
  await client.connect();

  const funcoes = ['f_confirmar_pagamento_prestador', 'f_trg_propagar_financeiro_alocacao', 'f_trg_propagar_financeiro_os'];
  for (const fn of funcoes) {
    const r = await client.query(`
      SELECT pg_get_functiondef(p.oid) AS src
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=$1
    `, [fn]);
    const file = path.resolve(`scripts/_fin_sane_02e_source_${fn}.sql`);
    fs.writeFileSync(file, `-- SOURCE REAL: ${fn}\n\n${r.rows[0]?.src ?? '-- NAO ENCONTRADO'}`);
    console.log(`Source salvo: ${file}`);
  }

  // Verificar se trigger M66 real cria ordens_servico
  const src = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS src
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_trg_propagar_financeiro_alocacao'
  `);
  const body = src.rows[0].src;
  console.log('');
  console.log('TRIGGER M66 REAL CRIA ORDENS_SERVICO?', body.includes('INSERT INTO ordens_servico') ? 'SIM' : 'NAO');
  console.log('TRIGGER M66 REAL USA valor_liquido EM financeiro_pagar?', /financeiro_pagar[\s\S]{0,500}valor\s*=\s*v_valor_liquido/.test(body) ? 'SIM' : 'NAO');
  console.log('TRIGGER M66 REAL USA valor_prestador EM financeiro_pagar?', /financeiro_pagar[\s\S]{0,500}valor\s*=\s*v_valor_prestador/.test(body) ? 'SIM' : 'NAO');

  const src80 = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS src
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_trg_propagar_financeiro_os'
  `);
  const body80 = src80.rows[0].src;
  console.log('TRIGGER M80 REAL USA valor_liquido EM financeiro_pagar?', /financeiro_pagar[\s\S]{0,500}valor\s*=\s*v_valor_liquido/.test(body80) ? 'SIM' : 'NAO');
  console.log('TRIGGER M80 REAL USA valor_prestador EM financeiro_pagar?', /financeiro_pagar[\s\S]{0,500}valor\s*=\s*v_valor_prestador/.test(body80) ? 'SIM' : 'NAO');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
