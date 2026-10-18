import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = fs.readFileSync('scripts/_a25b_fix_rpc_registrar_posicao.sql', 'utf8');

const client = await pool.connect();
try {
  // APLICAÇÃO REAL (ÚNICA alteração autorizada de Produção: este RPC)
  await client.query('BEGIN');
  await client.query(sql);

  // Verificação pós-aplicação
  const r = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
  `);
  const def = r.rows[0].def;
  const m = def.match(/INSERT INTO public\.portal_tracking_realtime\s*\(([\s\S]*?)\)\s*VALUES/);
  const cols = m[1].split(',').map(x => x.trim());
  console.log('=== RPC ATUALIZADO (Produção) ===');
  console.log('INSERT colunas:', cols.join(', '));
  console.log('SECURITY DEFINER?', def.includes('SECURITY DEFINER'));
  console.log('search_path public?', def.includes('SET search_path TO public') || def.includes('SET search_path = public'));

  // Confirmar que NÃO referencia colunas inexistentes no INSERT
  const invalidas = cols.filter(c => !['id','cliente_id','os_id','prestador_id','veiculo_id','status','latitude','longitude','eta_min','velocidade','bateria','metadata','updated_at','alocacao_id','captured_at','precisao','direcao','tenant_id','created_at','origem'].includes(c));
  console.log('Colunas inválidas no INSERT?', invalidas.length ? invalidas.join(',') : 'NENHUMA');

  await client.query('COMMIT');
  console.log('COMMIT — RPC corrigido em Produção.');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERRO na aplicação:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
