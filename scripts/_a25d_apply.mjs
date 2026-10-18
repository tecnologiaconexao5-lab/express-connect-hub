import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = fs.readFileSync('scripts/_a25d_fix_rpc_registrar_posicao.sql', 'utf8');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);

  const r = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def, p.proconfig, p.prosecdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
  `);
  const def = r.rows[0].def;
  const m = def.match(/INSERT INTO public\.portal_tracking_realtime\s*\(([\s\S]*?)\)\s*VALUES/);
  const cols = m ? m[1].split(',').map(x => x.trim()) : [];

  console.log('=== VALIDAÇÃO RPC A25-D (após aplicação) ===');
  console.log('SECURITY DEFINER:', r.rows[0].prosecdef);
  console.log('search_path:', JSON.stringify(r.rows[0].proconfig));
  console.log('Referencia prestadores.tenant_id?', /SELECT\s+id,?\s*tenant_id\s+INTO[\s\S]*?FROM public\.prestadores/.test(def) ? 'SIM (ERRO)' : 'NÃO ✓');
  console.log('Tenant derivado de alocacoes_escala.tenant_id?', def.includes('ae.tenant_id') && def.includes('alocacoes_escala ae') ? 'SIM ✓' : 'NÃO');
  console.log('INSERT colunas:', cols.join(', '));
  const invalidas = cols.filter(c => !['id','cliente_id','os_id','prestador_id','veiculo_id','status','latitude','longitude','eta_min','velocidade','bateria','metadata','updated_at','alocacao_id','captured_at','precisao','direcao','tenant_id','created_at','origem'].includes(c));
  console.log('Colunas inválidas no INSERT?', invalidas.length ? invalidas.join(',') : 'NENHUMA ✓');
  console.log('Assinatura preservada (p_altitude/p_status_operacional presentes)?', def.includes('p_altitude') && def.includes('p_status_operacional') ? 'SIM ✓' : 'NÃO');

  await client.query('COMMIT');
  console.log('\nCOMMIT — RPC corrigido em Produção (única alteração autorizada).');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERRO:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
