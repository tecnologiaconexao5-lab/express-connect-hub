/**
 * TMS-032 — VALIDAÇÃO READ-ONLY (BEGIN...ROLLBACK) das migrations preparadas.
 * Executa o conteúdo dentro de uma transação e faz ROLLBACK — NADA persiste.
 * Não imprime segredos.
 *
 * Uso: node scripts/tms032_validar_migrations.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const FILES = [
  'supabase/migrations/20260801_tms032_p0_aceite_policy.sql',
  'supabase/migrations/20260801_tms032_p0_aceite_policy_rollback.sql',
  'supabase/migrations/20260801_tms032_hardening_rpc_grants.sql',
];

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const file of FILES) {
    let sql = fs.readFileSync(path.resolve(file), 'utf8');
    // Remover BEGIN/COMMIT do arquivo e envolver em BEGIN...ROLLBACK (nada persiste)
    sql = sql.replace(/\bBEGIN;\s*/i, '').replace(/\bCOMMIT;\s*$/i, '');
    const wrapped = 'BEGIN;\n' + sql + '\nROLLBACK;';
    try {
      await client.query(wrapped);
      console.log(`OK  ${file} — SQL válido, transação revertida (nada aplicado)`);
    } catch (err) {
      console.error(`ERR ${file}`);
      console.error(String(err.message || err).slice(0, 1200));
    }
  }

  await client.end();
  console.log('=== FIM VALIDAÇÃO (nenhuma alteração persistida) ===');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
