// TMS-FIN-PROG-03 — Replica a logica do DashboardFinanceiroEnterprise sobre a fixture REAL.
// Uso: npx tsx scripts/_fin_prog03_service.ts
import fs from "node:fs";
import { calcularStatusEfetivo } from "../src/helpers/statusVencimento";

const fixture = JSON.parse(fs.readFileSync("temp/fin_prog03_dashboard_fixture.json", "utf8"));

const dadosMesAtual = fixture.osMes;
const dadosMesAnterior = fixture.osAnt;
const dados6Meses = fixture.os6;
const pagamentosGeral = fixture.pgr;
const pagamentosPrestador = fixture.ppg;
const receber = fixture.rcv;

const receitaMes = dadosMesAtual.reduce((a: number, o: any) => a + (o.valor_cliente || 0), 0);
const receitaAnt = dadosMesAnterior.reduce((a: number, o: any) => a + (o.valor_cliente || 0), 0);
const custoPrestadoresMes = dadosMesAtual.reduce((a: number, o: any) => a + (o.custo_prestador || 0), 0);
const custoPrestadoresAnt = dadosMesAnterior.reduce((a: number, o: any) => a + (o.custo_prestador || 0), 0);
const custoGeralMes = pagamentosGeral.filter((r: any) => !r.fornecedor_id && !r.prestador).reduce((a: number, r: any) => a + (r.valor || 0), 0);
const custosTotais = custoPrestadoresMes + custoGeralMes;
const resultado = receitaMes - custosTotais;
const margemOp = receitaMes > 0 ? (resultado / receitaMes) * 100 : 0;
const qtdOS = dadosMesAtual.length;
const custoMedioOS = qtdOS > 0 ? custoPrestadoresMes / qtdOS : 0;
const ticketMedioOS = qtdOS > 0 ? receitaMes / qtdOS : 0;

const hoje = new Date();
const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
const hojeStr = hoje.toISOString().split("T")[0];

const aReceber7d = receber.filter((r: any) => {
  const venc = r.data_vencimento || r.vencimento;
  const se = calcularStatusEfetivo({ statusPersistido: r.status, dataVencimento: venc, dataPagamento: r.data_pagamento || r.data_baixa });
  return venc >= hojeStr && venc <= em7dias && (se === "a_vencer" || se === "vence_hoje");
}).reduce((a: number, r: any) => a + (r.valor || 0), 0);

const pagarGeral = pagamentosGeral.filter((r: any) => !r.fornecedor_id && !r.prestador);
const aPagar7d = pagarGeral.filter((r: any) => {
  const venc = r.data_vencimento;
  const se = calcularStatusEfetivo({ statusPersistido: r.status, dataVencimento: venc });
  return venc >= hojeStr && venc <= em7dias && (se === "a_vencer" || se === "vence_hoje" || se === "atrasado");
}).reduce((a: number, r: any) => a + (r.valor || 0), 0);

const repassesPendentes = pagamentosPrestador
  .filter((r: any) => r.status_pagamento === "pendente" || r.status_pagamento === "agendado")
  .reduce((a: number, r: any) => a + (r.valor_liquido || 0), 0);

const inadimplencia = receber.filter((r: any) => {
  const se = calcularStatusEfetivo({ statusPersistido: r.status, dataVencimento: r.data_vencimento || r.vencimento, dataPagamento: r.data_pagamento || r.data_baixa });
  return se === "atrasado";
}).reduce((a: number, r: any) => a + (r.valor || 0), 0);

const clientesInadimplentes = [...new Set(receber.filter((r: any) => {
  const se = calcularStatusEfetivo({ statusPersistido: r.status, dataVencimento: r.data_vencimento || r.vencimento, dataPagamento: r.data_pagamento || r.data_baixa });
  return se === "atrasado";
}).map((r: any) => r.cliente_id || r.cliente).filter(Boolean))].length;

const semDados = dadosMesAtual.length === 0 && pagamentosGeral.length === 0 && receber.length === 0;

const out = {
  hoje: hojeStr,
  semDados,
  qtdOS,
  receitaMes,
  custoPrestadoresMes,
  custoGeralMes,
  custosTotais,
  resultado,
  margemOp,
  aReceber7d,
  aPagar7d,
  repassesPendentes,
  totalCompromissado: aPagar7d + repassesPendentes,
  inadimplencia,
  clientesInadimplentes,
  pagamentosGeral_len: pagamentosGeral.length,
  pagamentosPrestador_len: pagamentosPrestador.length,
  receber_len: receber.length,
  grafico6Meses_len: dados6Meses.length,
};
console.log(JSON.stringify(out, null, 2));
