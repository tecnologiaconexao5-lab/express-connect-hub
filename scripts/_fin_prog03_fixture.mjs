// TMS-FIN-PROG-03 — Gera fixture REAL (read-only) com exatamente as consultas do Dashboard.
import pg from "pg";
import fs from "node:fs";
// Espelha o PostgREST/JSON: numeric -> number, int8 -> number (nao string)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (sql, p = []) => (await pool.query(sql, p)).rows;

const now = new Date();
const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const mesAnterior = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const inicio6 = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split("T")[0];

const OS_COLS = "id, numero, cliente_id, prestador_id, valor_cliente, custo_prestador, pedagio, adicionais, descontos, distancia_km, tipo_operacao, status, data, created_at, margem_liquida, margem_bruta, volumes, peso, status_faturamento";
const OS_STATUS = ["finalizada", "concluida"];

const fixture = {
  meta: { generated_at: new Date().toISOString(), mesAtual, mesAnterior, inicio6 },
  osMes: await q(`select ${OS_COLS} from ordens_servico where status = any($1) and data >= $2`, [OS_STATUS, `${mesAtual}-01`]),
  osAnt: await q(`select id, valor_cliente, custo_prestador, data from ordens_servico where status = any($1) and data >= $2 and data < $3`, [OS_STATUS, `${mesAnterior}-01`, `${mesAtual}-01`]),
  os6: await q(`select id, valor_cliente, custo_prestador, data from ordens_servico where status = any($1) and data >= $2 order by data asc`, [OS_STATUS, inicio6]),
  pgr: await q(`select id, descricao, valor, status, fornecedor_id, prestador, data_vencimento, categoria from financeiro_pagar where is_teste = false and status = any($1)`, [["aberto", "a vencer", "a_vencer", "pendente", "vencido"]]),
  ppg: await q(`select id, prestador_id, prestador_nome, valor_liquido, status_pagamento, data_competencia, origem_lancamento from pagamentos_prestadores where is_teste = false and status_pagamento = any($1)`, [["pendente", "agendado", "em_lote"]]),
  rcv: await q(`select id, cliente_id, cliente, valor, status, data_vencimento, data_pagamento, os_id from financeiro_receber where is_teste = false order by data_vencimento asc`),
  cli: await q(`select id, nome_fantasia, razao_social, cnpj from clientes`),
  pre: await q(`select id, nome_completo, cpf_cnpj from prestadores`),
};

fs.mkdirSync("temp", { recursive: true });
fs.writeFileSync("temp/fin_prog03_dashboard_fixture.json", JSON.stringify(fixture));
console.log("fixture ok:", Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));
await pool.end();
