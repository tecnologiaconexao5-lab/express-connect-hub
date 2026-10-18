import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();

  // 1. auth.users — read-only
  const u = await c.query('SELECT id, email FROM auth.users WHERE id = $1', ['9a9e96f2-d7bb-4bcf-acc3-8edf792f2a65']);
  if (u.rows.length === 0) { console.log('USUARIO: NAO ENCONTRADO'); await c.end(); return; }
  console.log('USUARIO: ENCONTRADO');
  console.log('  id:', u.rows[0].id);
  console.log('  email:', u.rows[0].email);
  console.log('  email_coincide:', u.rows[0].email === 'diegoconexao19@gmail.com');

  // 2. tenant_usuarios — read-only
  const t = await c.query('SELECT tenant_id, papel, status FROM tenant_usuarios WHERE user_id = $1', ['9a9e96f2-d7bb-4bcf-acc3-8edf792f2a65']);
  if (t.rows.length === 0) { console.log('VINCULO: NAO ENCONTRADO'); await c.end(); return; }
  const v = t.rows[0];
  console.log('VINCULO_TMS: ENCONTRADO');
  console.log('  tenant_id:', v.tenant_id);
  console.log('  papel:', v.papel);
  console.log('  status:', v.status);
  console.log('  tenant_ok:', v.tenant_id === '00000000-0000-0000-0000-000000000001');
  console.log('  papel_ok:', v.papel === 'super_admin');
  console.log('  status_ok:', v.status === 'ativo');

  await c.end();
})();
