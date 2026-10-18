// APP-E2E-11C — definições de trigger nas tabelas da fixture (checar DELETE).
import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const alvos = ["alocacoes_escala", "ordens_servico", "prestadores", "financeiro_pagar", "pagamentos_prestadores", "composicao_financeira_os", "composicao_financeira", "entregas_protocolo", "delivery_proofs", "portal_notificacoes", "portal_tracking_realtime", "operacao_localizacao", "operation_timeline_events"];
const out = {};
out.defs = await q(
  `select c.relname as tabela, t.tgname, pg_get_triggerdef(t.oid) as def
     from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where not t.tgisinternal and c.relname = any($1)
    order by c.relname, t.tgname`, [alvos]);
console.log(JSON.stringify(out.defs.map(d => ({ tabela: d.tabela, trg: d.tgname, def: d.def })), null, 2));
await pool.end();
