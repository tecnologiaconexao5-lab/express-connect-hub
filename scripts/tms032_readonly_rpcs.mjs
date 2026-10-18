/**
 * TMS-032 — AUDITORIA READ-ONLY 2: corpos das RPCs críticas (somente SELECT)
 * Verifica validação de auth.uid() / pertencimento nas RPCs de escrita do App.
 * Não altera nada.
 *
 * Uso: node scripts/tms032_readonly_rpcs.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const NOMES = [
  'f_aceitar_oportunidade_rede',
  'f_avancar_etapa_app_motorista',
  'f_atualizar_reversa_app',
  'f_atualizar_status_parada',
  'registrar_posicao_motorista',
];

async function main() {
  await client.connect();
  console.log('=== TMS-032 AUDITORIA READ-ONLY 2 — CORPOS RPC ===\n');

  for (const nome of NOMES) {
    const q = `
      SELECT pg_get_function_identity_arguments(p.oid) AS args,
             pg_get_functiondef(p.oid) AS def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
      ORDER BY pg_get_function_identity_arguments(p.oid)`;
    const { rows } = await client.query(q, [nome]);
    if (!rows.length) { console.log(`### ${nome}: NAO EXISTE\n`); continue; }
    console.log('='.repeat(100));
    console.log(`### ${nome}`);
    for (const r of rows) {
      console.log(`  assinatura: ${nome}(${r.args})`);
      const def = r.def || '';
      console.log('  --- corpo ---');
      console.log(def);
      console.log('  --- fim corpo ---\n');
    }
  }

  await client.end();
  console.log('=== FIM (sem alteracoes) ===');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
