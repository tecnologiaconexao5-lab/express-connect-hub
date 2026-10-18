// A22 — CLEANUP dos artefatos HML (produção limpa, sem backdoor)
// Remove: operacao_mensagens, portal_notificacoes, alocacoes_escala,
// prestadores, tenant_usuarios e auth.users marcados HML-A22.
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env") });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const UUID_A = "a22a0000-0000-4000-8000-00000000000a";
const UUID_T = "a22c0000-0000-4000-8000-00000000000c";

await client.query(`DELETE FROM public.operacao_mensagens
  WHERE metadata->>'hml_marker'='HML-A22' OR prestador_id IN (SELECT id FROM prestadores WHERE nome_completo LIKE 'HML A22%')`);
await client.query(`DELETE FROM public.portal_notificacoes WHERE metadata->>'hml_marker'='HML-A22'`);
await client.query(`DELETE FROM public.alocacoes_escala WHERE origem LIKE 'HML A22%' OR destino LIKE 'HML A22%'`);
await client.query(`DELETE FROM public.prestadores WHERE nome_completo LIKE 'HML A22%'`);
await client.query(`DELETE FROM public.tenant_usuarios WHERE user_id IN ($1,$2)`, [UUID_A, UUID_T]);
await client.query(`DELETE FROM auth.users WHERE id IN ($1,$2)`, [UUID_A, UUID_T]);

const leftover = await client.query(`SELECT
  (SELECT count(*)::int FROM public.operacao_mensagens) AS om,
  (SELECT count(*)::int FROM public.prestadores WHERE nome_completo LIKE 'HML A22%') AS pres,
  (SELECT count(*)::int FROM auth.users WHERE id IN ($1,$2)) AS authu,
  (SELECT count(*)::int FROM public.alocacoes_escala WHERE origem LIKE 'HML A22%') AS aloc`,
  [UUID_A, UUID_T]);
console.log("Restante:", JSON.stringify(leftover.rows[0]));
const ok = leftover.rows[0].om === 0 && leftover.rows[0].pres === 0 && leftover.rows[0].authu === 0 && leftover.rows[0].aloc === 0;
console.log(ok ? "CLEANUP_HML_OK" : "CLEANUP_HML_PARCIAL");

await client.end();
process.exit(ok ? 0 : 1);
