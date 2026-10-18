/**
 * TMS-031 — Diagnóstico complementar (SOMENTE LEITURA)
 * Investiga driver_profiles + colunas de vínculo das tabelas do app.
 * Nenhum segredo impresso.
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL ausente'); process.exit(1); }

const OLD_UID = 'a5e51631-5ed8-430d-9041-4b185c03d821';
const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // A) driver_profiles — schema
  console.log('A) driver_profiles — colunas');
  const { rows: dc } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='driver_profiles' ORDER BY ordinal_position
  `);
  console.log('  ' + dc.map((c) => `${c.column_name}:${c.data_type}`).join(', '));

  // B) driver_profiles — linhas com o UID antigo (sem expor segredos)
  console.log('\nB) driver_profiles — registros com UID antigo');
  const { rows: dp } = await client.query(
    `SELECT id, user_id, nome, telefone, email, cpf_cnpj, nivel, score, status_operacional, created_at
     FROM driver_profiles WHERE user_id = $1`, [OLD_UID]
  );
  for (const r of dp) {
    console.log(`  - id: ${r.id}`);
    console.log(`  - user_id: ${r.user_id}`);
    console.log(`  - nome: ${r.nome ?? '—'}`);
    console.log(`  - telefone: ${r.telefone ?? '—'}`);
    console.log(`  - email: ${r.email ?? '—'}`);
    console.log(`  - cpf_cnpj: ${r.cpf_cnpj ?? '—'}`);
    console.log(`  - nivel: ${r.nivel ?? '—'}`);
    console.log(`  - status_operacional: ${r.status_operacional ?? '—'}`);
    console.log(`  - created_at: ${r.created_at}`);
  }
  if (dp.length === 0) console.log('  (nenhum)');

  // C) driver_profiles — existe vínculo novo?
  const { rows: dpNew } = await client.query(
    `SELECT id, user_id, nome FROM driver_profiles WHERE user_id = $1`,
    ['7cc4bb3d-225b-4169-911b-0fff8439efca']
  );
  console.log(`\nC) driver_profiles com UID novo → ${dpNew.length} registro(s)`);
  for (const r of dpNew) console.log(`  - ${r.id} user_id=${r.user_id} nome=${r.nome}`);

  // D) Como as demais tabelas do app referenciam o prestador
  console.log('\nD) Colunas de vínculo das tabelas do app');
  const tabelas = ['historico_alocacoes_escala','financeiro_pagar','prestador_acesso','prestador_notificacoes','prestador_candidaturas','prestador_reembolsos','prestador_engajamento','motorista_app_sessoes','prestador_disponibilidade'];
  for (const tbl of tabelas) {
    const { rows: cols } = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [tbl]);
    const names = cols.map((c) => c.column_name);
    const rel = names.filter((n) => /prestador|usuario|user|auth|alocacao|driver/i.test(n));
    console.log(`\n  ${tbl}: colunas de relação → ${rel.join(', ') || 'NENHUMA'}`);
    // tenta count por prestador_id
    if (names.includes('prestador_id')) {
      const { rows: r } = await client.query(
        `SELECT COUNT(*)::int AS n FROM public."${tbl}" WHERE prestador_id = $1`, [PRESTADOR_ID]);
      console.log(`    prestador_id = PRESTADOR_ID → ${r[0].n} registro(s)`);
    }
  }

  // E) financeiro_pagar.prestador (text?) e ordens_servico.prestador
  const { rows: fp } = await client.query(
    `SELECT COUNT(*)::int AS n FROM financeiro_pagar WHERE prestador = $1`, [PRESTADOR_ID]);
  console.log(`\nE) financeiro_pagar.prestador (text) = PRESTADOR_ID → ${fp[0].n} registro(s)`);

  // F) driver_profiles — todos os registros (para saber quantos existem e seus user_id)
  const { rows: dpAll } = await client.query(
    `SELECT id, user_id, nome FROM driver_profiles ORDER BY created_at DESC`);
  console.log(`\nF) driver_profiles — total no banco: ${dpAll.length} registro(s)`);
  for (const r of dpAll) console.log(`  - ${r.id} user_id=${r.user_id} nome=${r.nome}`);

  await client.end();
}
main().catch(async (e) => { console.error('❌', e.message); await client.end(); process.exit(1); });
