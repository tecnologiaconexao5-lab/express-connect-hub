import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

const env = readFileSync(resolve(import.meta.dirname, "..", ".env"), "utf8");
let connStr = "";
for (const line of env.split("\n")) {
  const t = line.trim();
  if (t.startsWith("DATABASE_URL=")) connStr = t.substring("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
}

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

const tables = [
  'financeiro_receber','financeiro_pagar','composicao_financeira_os',
  'crm_leads','crm_conversas','crm_mensagens',
  'crm_historico','crm_followups','crm_templates_mensagem',
  'crm_interacoes_prestadores',
  'prestadores','veiculos',
  'fiscal_ctes','fiscal_nfse','fiscal_mdfes',
  'contratos_gerados','contratos_modelos','contratos_historico',
  'tabelas_valores',
  'orcamentos','historico_alocacoes_escala','operacao_localizacao',
  'integracoes_logs','usuarios_cliente'
];

async function main() {
  await client.connect();
  console.log("Tabela".padEnd(35) + "exists  tenant_id  cliente_id  prestador_id");
  console.log("-".repeat(75));
  
  for (const tbl of tables) {
    const r = await client.query(`
      SELECT
        (SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1)) AS tbl_exists,
        (SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='tenant_id')) AS has_tenant,
        (SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='cliente_id')) AS has_cliente,
        (SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='prestador_id')) AS has_prestador
    `, [tbl]);
    const row = r.rows[0];
    console.log(
      tbl.padEnd(35) +
      String(row.tbl_exists).padEnd(7) +
      String(row.has_tenant).padEnd(9) +
      String(row.has_cliente).padEnd(10) +
      row.has_prestador
    );
  }
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
