/**
 * TMS-031 — Diagnóstico (SOMENTE LEITURA)
 *
 * Nenhuma escrita. Nenhum segredo é impresso.
 * Requer DATABASE_URL no .env.
 *
 * Uso: node scripts/tms031_diagnostico_pg.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida no .env');
  process.exit(1);
}

const OLD_UID = 'a5e51631-5ed8-430d-9041-4b185c03d821';
const NEW_UID = '7cc4bb3d-225b-4169-911b-0fff8439efca';
const NEW_EMAIL = 'infraestruturaconexao@gmail.com';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let erros = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) erros++;
};

async function main() {
  await client.connect();
  console.log('✅ Conectado (somente leitura)\n');

  // 1. Prestador atualmente vinculado ao UID antigo
  console.log('1️⃣ Prestador vinculado ao auth_user_id ANTIGO');
  const { rows: prest } = await client.query(
    `SELECT id, nome_completo, auth_user_id, status, cpf_cnpj, email, telefone
     FROM prestadores WHERE auth_user_id = $1`,
    [OLD_UID]
  );
  if (prest.length === 0) {
    console.log('  ⚠️ Nenhum prestador com auth_user_id antigo.');
  } else {
    for (const p of prest) {
      console.log(`  - id: ${p.id}`);
      console.log(`  - nome_completo: ${p.nome_completo}`);
      console.log(`  - auth_user_id (atual): ${p.auth_user_id}`);
      console.log(`  - status: ${p.status}`);
      console.log(`  - cpf_cnpj: ${p.cpf_cnpj ?? '—'}`);
    }
    ok(prest.length === 1, `Exatamente 1 vínculo ativo com UID antigo (encontrados: ${prest.length})`);
  }

  // 2. Novo UID existe no Supabase Auth?
  console.log('\n2️⃣ Novo UID existe no Supabase Auth');
  const { rows: newUser } = await client.query(
    `SELECT id, email, created_at, last_sign_in_at, banned_until
     FROM auth.users WHERE id = $1`,
    [NEW_UID]
  );
  if (newUser.length === 0) {
    console.log('  ⚠️ UID novo NÃO encontrado em auth.users');
    ok(false, 'UID novo existe em auth.users');
  } else {
    for (const u of newUser) {
      console.log(`  - id: ${u.id}`);
      console.log(`  - email: ${u.email}`);
      console.log(`  - created_at: ${u.created_at}`);
      console.log(`  - last_sign_in_at: ${u.last_sign_in_at ?? 'nunca logou'}`);
      console.log(`  - banned_until: ${u.banned_until ?? 'não banido'}`);
      ok(u.email.toLowerCase() === NEW_EMAIL.toLowerCase(), `email confere com ${NEW_EMAIL}`);
    }
  }

  // 3. Novo UID ainda não vinculado a nenhum prestador?
  console.log('\n3️⃣ Novo UID já está vinculado a algum prestador?');
  const { rows: newPrest } = await client.query(
    `SELECT id, nome_completo, status FROM prestadores WHERE auth_user_id = $1`,
    [NEW_UID]
  );
  if (newPrest.length === 0) {
    console.log('  ✅ Novo UID não vinculado a nenhum prestador.');
  } else {
    for (const p of newPrest) {
      console.log(`  ⚠️ Novo UID JÁ vinculado ao prestador ${p.nome_completo} (${p.id})`);
    }
    ok(false, 'Novo UID livre para vínculo');
  }

  // 4. Todas as tabelas que mencionam o UID antigo (scan dinâmico, somente leitura)
  console.log('\n4️⃣ Tabelas/colunas que contêm o UID ANTIGO');
  const { rows: cols } = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('auth_user_id','user_id','auth_uid','user_uid')
    ORDER BY table_name
  `);
  let achouFora = 0;
  for (const c of cols) {
    if (!['uuid', 'character varying', 'text', 'character'].includes(c.data_type)) continue;
    const t = `${c.table_name}.${c.column_name}`;
    const { rows: r } = await client.query(
      `SELECT COUNT(*)::int AS n FROM public."${c.table_name}" WHERE "${c.column_name}" = $1`,
      [OLD_UID]
    );
    if (r[0]?.n > 0) {
      achouFora++;
      console.log(`  🔎 ${t} → ${r[0].n} linha(s) com UID antigo`);
    }
  }
  if (achouFora === 0) console.log('  ✅ Nenhuma outra tabela/coluna contém o UID antigo.');

  // 5. Quantidade exata de linhas a alterar = linhas em prestadores.auth_user_id = antigo
  console.log('\n5️⃣ Linhas que seriam alteradas');
  const { rows: cnt } = await client.query(
    `SELECT COUNT(*)::int AS n FROM prestadores WHERE auth_user_id = $1`, [OLD_UID]
  );
  console.log(`  prestadores.auth_user_id = UID antigo → ${cnt[0].n} linha(s)`);

  // 6. Preservação: relacionamentos usam prestador_id (prestadores.id), não auth_user_id
  console.log('\n6️⃣ Relacionamentos chaveados por prestador_id (NÃO auth_user_id)');
  const prestadorId = prest.length === 1 ? prest[0].id : null;
  if (prestadorId) {
    const tabelas = [
      ['alocacoes_escala', 'prestador_id'],
      ['historico_alocacoes_escala', 'prestador_id'],
      ['pagamentos_prestadores', 'prestador_id'],
      ['financeiro_pagar', 'prestador_id'],
      ['entregas_protocolo', 'prestador_id'],
      ['portal_tracking_realtime', 'prestador_id'],
      ['prestador_acesso', 'prestador_id'],
      ['prestador_disponibilidade', 'prestador_id'],
      ['prestador_notificacoes', 'prestador_id'],
      ['prestador_candidaturas', 'prestador_id'],
      ['prestador_reembolsos', 'prestador_id'],
      ['prestador_engajamento', 'prestador_id'],
      ['motorista_app_sessoes', 'prestador_id'],
    ];
    for (const [tbl, col] of tabelas) {
      const { rows: t } = await client.query(`
        SELECT COUNT(*)::int AS n
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2
      `, [tbl, col]);
      if (t[0].n === 0) {
        console.log(`  ⚠️ ${tbl} não possui coluna ${col} (verificar schema)`);
        continue;
      }
      const { rows: r } = await client.query(
        `SELECT COUNT(*)::int AS n FROM public."${tbl}" WHERE "${col}" = $1`, [prestadorId]
      );
      console.log(`  - ${tbl}.${col} → ${r[0].n} registro(s) (referencia prestadores.id, preservado)`);
    }

    // ordens_servico (coluna prestador — pode ser UUID do prestador ou texto)
    const { rows: osCol } = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ordens_servico' AND column_name IN ('prestador','prestador_id')
    `);
    for (const c of osCol) {
      const { rows: r } = await client.query(
        `SELECT COUNT(*)::int AS n FROM public."ordens_servico" WHERE "${c.column_name}" = $1`, [prestadorId]
      );
      console.log(`  - ordens_servico.${c.column_name} (${c.data_type}) → ${r[0].n} registro(s) vinculados`);
    }
  } else {
    console.log('  ⚠️ Prestador não identificado — pulando mapeamento de relacionamentos.');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  DIAGNÓSTICO ${erros === 0 ? 'APROVADO ✅' : `COM INCONSISTÊNCIAS (${erros}) ❌`}`);
  console.log('  Nenhuma escrita foi realizada.');
  console.log(`${'='.repeat(60)}\n`);

  await client.end();
  process.exit(erros === 0 ? 0 : 2);
}

main().catch(async (e) => {
  console.error('❌ Erro:', e.message);
  await client.end();
  process.exit(1);
});
