// APP-E2E-11C — prova da CAMADA TMS: executa as MESMAS queries dos componentes.
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const ALOC = "18d50f0b-704f-4361-8626-ed43c8000601";
const out = {};

// EscalaLista.loadAlocacoes — mês corrente 2026-09-01..2026-09-30
const inicioMes = "2026-09-01", fimMes = "2026-09-30";
out.escala_mes = await q(
  `select a.id, a.data_escala, a.status, a.status_pagamento, a.finalizada, a.aceite_prestador,
          a.prestador_id, p.nome_completo, o.numero as os_numero
     from alocacoes_escala a
     left join prestadores p on p.id=a.prestador_id
     left join ordens_servico o on o.id=a.ordem_servico_id
    where a.data_escala >= $1 and a.data_escala <= $2
    order by a.data_escala`, [inicioMes, fimMes]);

// OrdensServicoLista.fetchOrdens
out.os_lista = await q(
  `select id, numero, status, cliente, prestador from ordens_servico order by created_at desc`);

// EscalaLista — janela de dias (diasPeriodo) por filtro. currentDate=2026-09-27 (dom).
// startOfWeek (semana começa segunda): 2026-09-21. Dias: semana 21-27; próxima 28/09-04/10; este_mes 01-30.
const fmt = (d) => d.toISOString().slice(0, 10);
const add = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const janelas = {
  esta_semana: { start: "2026-09-21", days: 7 },
  proxima_semana: { start: "2026-09-28", days: 7 },
  este_mes: { start: "2026-09-01", days: 30 },
};
const dataAloc = new Date("2026-09-28T12:00:00Z");
out.periodos = {};
for (const [k, v] of Object.entries(janelas)) {
  const dias = Array.from({ length: v.days }).map((_, i) => fmt(add(new Date(v.start + "T12:00:00Z"), i)));
  out.periodos[k] = { inicio: dias[0], fim: dias[dias.length - 1], contem_28_09: dias.includes("2026-09-28") };
}

// Mapeamento de status (escalaStatus / statusGlobal)
const mapa = { concluida: "finalizado", finalizada: "finalizado", em_rota: "em_rota", aceita: "confirmado", aguardando_aceite: "aguardando" };
out.status_ui_alocacao = mapa[out.escala_mes[0]?.status] || out.escala_mes[0]?.status;
out.status_ui_os = mapa[out.os_lista[0]?.status] || out.os_lista[0]?.status;

console.log(JSON.stringify(out, null, 2));
await pool.end();
