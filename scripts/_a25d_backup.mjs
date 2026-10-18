import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// SOMENTE LEITURA — backup A25-D da definição atual do RPC
const rpc = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
if (rpc.rows.length) {
  fs.writeFileSync('scripts/_a25d_backup_rpc_registrar_posicao.sql', rpc.rows[0].def + ';\n');
  console.log('BACKUP A25-D salvo em scripts/_a25d_backup_rpc_registrar_posicao.sql');
  console.log('Tamanho:', rpc.rows[0].def.length, 'chars');
  console.log('Assinatura:');
  console.log(rpc.rows[0].def.split('\n')[0]);
  console.log('SECURITY DEFINER:', rpc.rows[0].def.includes('SECURITY DEFINER'));
  console.log('search_path public:', /search_path\s*(=|\s+TO)\s*'?public/i.test(rpc.rows[0].def));
  console.log('Contém prestadores.tenant_id:', rpc.rows[0].def.includes('tenant_id') && rpc.rows[0].def.includes('public.prestadores'));
} else {
  console.log('RPC NÃO EXISTE');
}
await pool.end();
