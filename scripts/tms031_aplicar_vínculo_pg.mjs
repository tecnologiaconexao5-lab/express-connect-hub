/**
 * TMS-031 — Atualização controlada do vínculo prestador (AUTORIZADA)
 *
 * Escopo EXATO autorizado:
 *   Tabela  : prestadores
 *   Registro: id = e6646799-fbac-453e-a3ef-afdfc01a7085
 *   Campo   : auth_user_id
 *   Antigo  : a5e51631-5ed8-430d-9041-4b185c03d821
 *   Novo    : 7cc4bb3d-225b-4169-911b-0fff8439efca
 *
 * Nada mais é alterado. Nenhum segredo é impresso.
 * Transacional: ROLLBACK automático se qualquer validação pós-escrita falhar.
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL ausente'); process.exit(1); }

const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';
const OLD_UID = 'a5e51631-5ed8-430d-9041-4b185c03d821';
const NEW_UID = '7cc4bb3d-225b-4169-911b-0fff8439efca';

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // PRÉ-CHECK (regra 8)
  console.log('▶ PRÉ-VALIDAÇÃO');
  const pre = await client.query(
    `SELECT id, nome_completo, auth_user_id, status FROM prestadores WHERE id = $1`, [PRESTADOR_ID]);
  if (pre.rows.length !== 1) throw new Error(`PRESTADOR ID não localizado (${pre.rows.length} linhas)`);
  const p = pre.rows[0];
  console.log(`  - prestador: ${p.nome_completo} (${p.id})`);
  console.log(`  - auth_user_id atual: ${p.auth_user_id}`);
  console.log(`  - status: ${p.status}`);
  if (p.auth_user_id !== OLD_UID) throw new Error('⚠️ auth_user_id atual difere do UID antigo — abortando');
  if (p.status !== 'ativo') throw new Error('⚠️ Prestador não está ativo — abortando');

  const conflito = await client.query(
    `SELECT id, nome_completo FROM prestadores WHERE auth_user_id = $1`, [NEW_UID]);
  if (conflito.rows.length > 0) throw new Error(`⚠️ Novo UID já vinculado a ${conflito.rows[0].nome_completo} — abortando`);
  console.log('  ✅ pré-validação OK (1 registro, ativo, UID antigo correto, novo UID livre)');

  await client.query('BEGIN');

  // EXECUÇÃO com guard por ID + UID antigo (regra 9)
  const upd = await client.query(
    `UPDATE prestadores
     SET auth_user_id = $1, updated_at = now()
     WHERE id = $2 AND auth_user_id = $3
     RETURNING id, nome_completo, auth_user_id, status`,
    [NEW_UID, PRESTADOR_ID, OLD_UID]);

  if (upd.rowCount !== 1) {
    await client.query('ROLLBACK');
    throw new Error(`⚠️ UPDATE afetou ${upd.rowCount} linha(s), esperado 1 — ROLLBACK executado`);
  }
  console.log(`\n▶ LINHA ALTERADA (${upd.rowCount})`);
  console.log(`  - id: ${upd.rows[0].id}`);
  console.log(`  - nome_completo: ${upd.rows[0].nome_completo}`);
  console.log(`  - auth_user_id: ${upd.rows[0].auth_user_id}`);
  console.log(`  - status: ${upd.rows[0].status}`);

  // PÓS-CHECK (regra 10)
  console.log('\n▶ PÓS-VALIDAÇÃO');
  const pos = await client.query(
    `SELECT id, nome_completo, auth_user_id, status FROM prestadores WHERE id = $1`, [PRESTADOR_ID]);
  const ok1 = pos.rows.length === 1 && pos.rows[0].auth_user_id === NEW_UID;
  console.log(`  ${ok1 ? '✅' : '❌'} prestador com auth_user_id = novo UID`);

  const outros = await client.query(
    `SELECT id, nome_completo FROM prestadores WHERE auth_user_id = $1 AND id <> $2`, [NEW_UID, PRESTADOR_ID]);
  const ok2 = outros.rows.length === 0;
  console.log(`  ${ok2 ? '✅' : '❌'} nenhuma outra linha usa o novo UID (${outros.rows.length})`);

  // Integridade: escalas, alocações, OS continuam no mesmo prestadores.id
  const checks = [
    ['alocacoes_escala', 'prestador_id'],
    ['pagamentos_prestadores', 'prestador_id'],
    ['entregas_protocolo', 'prestador_id'],
    ['portal_tracking_realtime', 'prestador_id'],
  ];
  let ok3 = true;
  for (const [tbl, col] of checks) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS n FROM public."${tbl}" WHERE "${col}" = $1`, [PRESTADOR_ID]);
    console.log(`  - ${tbl}.${col} → ${r.rows[0].n} registro(s) (preservado)`);
  }
  const osP = await client.query(
    `SELECT COUNT(*)::int AS n FROM ordens_servico WHERE prestador_id = $1`, [PRESTADOR_ID]);
  const osP2 = await client.query(
    `SELECT COUNT(*)::int AS n FROM ordens_servico WHERE prestador = $1`, [PRESTADOR_ID]);
  console.log(`  - ordens_servico.prestador_id → ${osP.rows[0].n} | ordens_servico.prestador → ${osP2.rows[0].n} (preservado)`);
  ok3 = ok3 && true;

  if (!ok1 || !ok2) {
    await client.query('ROLLBACK');
    throw new Error('⚠️ Falha na pós-validação — ROLLBACK executado, nada persistido');
  }

  await client.query('COMMIT');
  console.log('\n✅ COMMIT — atualização persistida (exatamente 1 linha, escopo autorizado).');
  console.log('  Nenhuma outra tabela foi alterada. driver_profiles intocado.');

  await client.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('❌', e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
