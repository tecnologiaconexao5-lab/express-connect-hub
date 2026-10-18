const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ordens_servico' AND column_name IN ('pedagio','valor_pedagio','adicionais','ajudante','descontos','peso')`);
  console.log('cols OS:', r.rows.map(x => x.column_name).join(',') || '(nenhuma)');
  const r2 = await c.query(`SELECT count(*) n FROM ordens_servico WHERE pedagio IS NOT NULL AND pedagio <> 0`).catch(e => ({ rows: [{ n: 'ERRO:' + e.message }] }));
  console.log('OS com pedagio<>0:', r2.rows[0].n);
  // M80 usa NEW.pedagio — se coluna nao existe, trigger quebra em runtime
  const r3 = await c.query(`SELECT count(*) n FROM ordens_servico WHERE adicionais IS NOT NULL OR ajudante IS NOT NULL OR descontos IS NOT NULL`).catch(e => ({ rows: [{ n: 'ERRO:' + e.message }] }));
  console.log('OS com adicionais/ajudante/descontos:', r3.rows[0].n);
  // status distintos em alocacoes (transicao)
  const r4 = await client_q(c, `SELECT status, count(*) n FROM alocacoes_escala GROUP BY status ORDER BY n DESC`);
  console.log('alocacoes status:', r4.map(x => `${x.status}=${x.n}`).join(', '));
  // ordens_servico status
  const r5 = await client_q(c, `SELECT status, count(*) n FROM ordens_servico GROUP BY status ORDER BY n DESC`);
  console.log('OS status:', r5.map(x => `${x.status}=${x.n}`).join(', '));
  // linhas composicao divergentes
  const r6 = await client_q(c, `SELECT os_id, outros_custos, adicional_valor, ajudante_valor, desconto_valor FROM composicao_financeira_os WHERE outros_custos IS DISTINCT FROM COALESCE(adicional_valor,0)+COALESCE(ajudante_valor,0)-COALESCE(desconto_valor,0) LIMIT 8`);
  console.log('divergentes outros_custos:', JSON.stringify(r6));
  await c.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
async function client_q(c, sql) { const r = await c.query(sql); return r.rows; }
