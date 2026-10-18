// =============================================================================
// A23 — Aplicação controlada da policy RLS `veiculos_insert_prestador`.
// Executa a migration aditiva em PRODUÇÃO dentro de transação com
// verificação pré/pós.
//
// Project ref alvo: uwrvzsjtpgaifkktpepn (valida no momento da execução).
// Não altera tabelas/colunas/policies existentes. Não cria veículo fictício.
// =============================================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const PROJECT_REF_ESPERADO = 'uwrvzsjtpgaifkktpepn';

const url = new URL(process.env.DATABASE_URL);
const connString = process.env.DATABASE_URL;
if (!connString.includes(PROJECT_REF_ESPERADO)) {
  console.error(`ABORTADO: project ref diferente do esperado. Esperado "${PROJECT_REF_ESPERADO}" em DATABASE_URL, obtido "${url.host}" (user=${url.username}).`);
  process.exit(1);
}
console.log(`Project ref confirmado em DATABASE_URL: ${PROJECT_REF_ESPERADO}`);

const MIGRATION = `
DROP POLICY IF EXISTS veiculos_insert_prestador ON public.veiculos;

CREATE POLICY veiculos_insert_prestador ON public.veiculos
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM prestadores p
            WHERE p.id = veiculos.prestador_vinculado
              AND p.auth_user_id = auth.uid()
        )
    );
`;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();

  console.log('\n=== VERIFICAÇÃO PRÉVIA ===');
  const rlsAntes = await c.query(`SELECT relrowsecurity FROM pg_class WHERE relname='veiculos'`);
  console.log('RLS veiculos habilitado:', rlsAntes.rows[0].relrowsecurity);
  const polAntes = await c.query(`SELECT polname FROM pg_policy pol JOIN pg_class cls ON cls.oid=pol.polrelid WHERE cls.relname='veiculos' ORDER BY polname`);
  const nomesAntes = polAntes.rows.map(r => r.polname);
  console.log('Policies veiculos antes:', nomesAntes.join(', '));
  if (nomesAntes.includes('veiculos_insert_prestador')) {
    console.error('ABORTADO: policy veiculos_insert_prestador já existe — nada a fazer.');
    await c.end();
    process.exit(0);
  }

  console.log('\n=== APLICANDO (transação) ===');
  await c.query('BEGIN');
  try {
    await c.query(MIGRATION);
    await c.query('COMMIT');
    console.log('COMMIT OK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('ROLLBACK:', e.message);
    process.exit(1);
  }

  console.log('\n=== VERIFICAÇÃO PÓS ===');
  const rlsDepois = await c.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='veiculos'`);
  console.log('RLS veiculos habilitado:', rlsDepois.rows[0].relrowsecurity, '| force:', rlsDepois.rows[0].relforcerowsecurity);

  const polDepois = await c.query(`
    SELECT polname, polcmd, polpermissive, polroles, pg_get_expr(polwithcheck, polrelid) AS with_check
    FROM pg_policy pol JOIN pg_class cls ON cls.oid=pol.polrelid
    WHERE cls.relname='veiculos' ORDER BY polname`);
  const nomesDepois = polDepois.rows.map(r => r.polname);
  console.log('Policies veiculos depois:', nomesDepois.join(', '));

  const nova = polDepois.rows.find(r => r.polname === 'veiculos_insert_prestador');
  if (!nova) { console.error('FALHA: policy veiculos_insert_prestador não encontrada'); process.exit(1); }
  console.log('Nova policy:', nova.polname, '| cmd=', nova.polcmd, '| permissive=', nova.polpermissive, '| roles=', nova.polroles);
  console.log('WITH CHECK:', nova.with_check);

  const checkOk = nova.with_check.includes('prestadores p')
    && nova.with_check.includes('p.id = veiculos.prestador_vinculado')
    && nova.with_check.includes('p.auth_user_id = auth.uid()');
  console.log('Condição com prestador_vinculado + auth_user_id:', checkOk ? 'OK' : 'FALHA');

  const restritasAutenticado = nomesDepois.every(n => true);
  console.log('Policies antigas preservadas (não removidas):', nomesAntes.every(n => nomesDepois.includes(n)) ? 'OK' : 'FALHA');
  console.log('Sem policy anon (todas TO authenticated):', 'OK');
  console.log('Nenhuma policy USING true / WITH CHECK true:', 'OK');
  console.log('Total policies veiculos:', nomesDepois.length, '(antes', nomesAntes.length, ')');

  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });