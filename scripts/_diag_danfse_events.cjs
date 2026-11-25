/* Diagnostico read-only: eventos fiscal_events DANFSE_OFICIAL_* da NFS-e 2 */
require("dotenv").config();
const { Client } = require("pg");

const CHAVE = "35503082231227975000180000000000000226110834762132";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const nfse = await client.query(
      `SELECT id, numero, chave_acesso, status,
              created_at::text, updated_at::text
       FROM fiscal_nfse
       WHERE chave_acesso = $1
       ORDER BY created_at DESC LIMIT 10`,
      [CHAVE]
    );
    console.log("=== fiscal_nfse ===");
    console.log(JSON.stringify(nfse.rows, null, 2));

    const ids = nfse.rows.map((r) => r.id);
    const evs = ids.length
      ? await client.query(
          `SELECT id, documento_id, tipo_evento, descricao, metadata,
                  created_at::text
           FROM fiscal_events
           WHERE documento_id = ANY($1::uuid[])
             AND tipo_evento LIKE 'DANFSE%'
           ORDER BY created_at ASC`,
          [ids]
        )
      : await client.query(
          `SELECT id, documento_id, tipo_evento, descricao, metadata,
                  created_at::text
           FROM fiscal_events
           WHERE tipo_evento LIKE 'DANFSE%'
           ORDER BY created_at DESC LIMIT 20`
        );
    console.log("=== fiscal_events DANFSE ===");
    console.log(JSON.stringify(evs.rows, null, 2));

    // Qualquer NFSE na chave 2 / homolog recente com eventos
    const recent = await client.query(
      `SELECT id, numero, chave_acesso, status, created_at::text
       FROM fiscal_nfse
       WHERE created_at > now() - interval '7 days'
       ORDER BY created_at DESC LIMIT 15`
    );
    console.log("=== fiscal_nfse ultimos 7 dias ===");
    console.log(JSON.stringify(recent.rows, null, 2));

    const ev2 = await client.query(
      `SELECT e.id, e.documento_id, e.tipo_evento, e.descricao, e.metadata,
              e.created_at::text
       FROM fiscal_events e
       WHERE e.tipo_evento LIKE 'DANFSE%'
         AND e.created_at > now() - interval '7 days'
       ORDER BY e.created_at DESC LIMIT 30`
    );
    console.log("=== fiscal_events DANFSE ultimos 7 dias ===");
    console.log(JSON.stringify(ev2.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
