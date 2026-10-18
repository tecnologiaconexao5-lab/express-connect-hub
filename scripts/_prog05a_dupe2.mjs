import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
console.log("AR por os_id casando alocacao_id de fatura_itens:",
  (await q(`select count(*)::int n from financeiro_receber r join fatura_itens i on i.alocacao_id::text = r.os_id where r.os_id is not null`))[0].n);
console.log("AR da alocacao c0a7ee88:", JSON.stringify(await q(`select id, os_id, valor, status from financeiro_receber where os_id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`)));
console.log("alocacoes concluidas com AR por os_id = alocacao id:",
  (await q(`select count(*)::int n from alocacoes_escala a join financeiro_receber r on r.os_id = a.id::text where a.status='concluida' and a.finalizada=true`))[0].n);
await p.end();
