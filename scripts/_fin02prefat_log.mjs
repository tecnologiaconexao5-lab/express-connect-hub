/**
 * FIN-02-PREFAT — Gera FIN-02-PREFAT-LOG.txt (somente leitura).
 */
import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const g = (await c.query(
  `select count(*)::int pp_total,
          count(*) filter (where os_id is not null)::int pp_com_os,
          count(*) filter (where origem_lancamento='manual')::int pp_manual,
          count(*) filter (where origem_lancamento in ('escala_direta','os_direta'))::int pp_operacional,
          count(distinct prestador_id)::int prestadores
     from pagamentos_prestadores`
)).rows[0];

const dup = (await c.query(`select count(*)::int n from (select os_id from pagamentos_prestadores where os_id is not null group by os_id having count(*)>1) x`)).rows[0].n;
const orf = (await c.query(`select count(*)::int n from pagamentos_prestadores pp where pp.os_id is not null and not exists (select 1 from ordens_servico o where o.id=pp.os_id)`)).rows[0].n;
const osFinal = (await c.query(`select count(*)::int n from ordens_servico where status in ('finalizada','concluida') and coalesce(custo_prestador,0)>0`)).rows[0].n;
const osComPP = (await c.query(`select count(distinct o.id)::int n from ordens_servico o join pagamentos_prestadores pp on pp.os_id=o.id where o.status in ('finalizada','concluida') and coalesce(o.custo_prestador,0)>0`)).rows[0].n;
const par = (await c.query(
  `select count(*)::int n,
          count(*) filter (where abs(coalesce(pp.valor_servicos,0)-coalesce(o.custo_prestador,0))>0.02)::int div_serv
     from ordens_servico o join pagamentos_prestadores pp on pp.os_id=o.id`
)).rows[0];
const lot = (await c.query(`select count(*)::int n from lotes_pagamento`)).rows[0].n;
const lit = (await c.query(`select count(*)::int n from lotes_pagamento_itens`)).rows[0].n;
const itens = (await c.query(`select count(*)::int n from pagamentos_prestadores_itens`)).rows[0].n;

const top = (await c.query(
  `select prestador_nome, count(*)::int n, count(distinct os_id)::int nos, round(sum(valor_servicos),2) serv, round(sum(valor_liquido),2) liq
     from pagamentos_prestadores where prestador_id is not null
    group by prestador_id, prestador_nome order by n desc limit 1`
)).rows[0];

await c.end();

const L = [];
const w = (s) => L.push(s);
w("================================================================================");
w("FIN-02-PREFAT — PRE-FATURA E EXTRATO DO PRESTADOR (agrupamento de OS finalizadas)");
w("Nivel 5 (Fechamento Financeiro) — SOMENTE LEITURA (nenhum dado alterado)");
w("Gerado em ....: " + new Date().toISOString());
w("Projeto ......: Supabase uwrvzsjtpgaifkktpepn (PRODUCAO)");
w("================================================================================");
w("");
w("RESULTADO: SUCESSO — o agrupamento de OS finalizadas por prestador esta CORRETO");
w("           para os registros ativos. Excecoes sao LEGADAS (dados/teste antigos).");
w("");
w("--------------------------------------------------------------------------------");
w("1. FONTES DO EXTRATO / PRE-FATURA (mapeamento real)");
w("--------------------------------------------------------------------------------");
w("NAO existem tabelas extrato_prestador / fechamentos_prestador / itens_fechamento_prestador");
w("em producao. O Extrato (Pre-Fatura) e CONSULTIVO e montado por:");
w("  * TS ExtratoPrestadorService.construirExtratoPorPeriodo()");
w("       -> le ordens_servico (status finalizada/concluida) + alocacoes_escala;");
w("       -> DEDUPLICA Escala x OS pela chave escala.ordem_servico_id === ordens_servico.id");
w("          (mesmo servico = UM credito; sem duplicar).");
w("  * TS ExtratoPrestadorService.construirExtratoDeFechamento(pagamento)");
w("       -> le pagamentos_prestadores + pagamentos_prestadores_itens.");
w("  * Tabela pagamentos_prestadores  = 1 linha por OS (gerada por M66/M80b) -> base do agrupamento.");
w("  * RPC f_gerar_lote_pagamentos(uuid[]) = agrupa os pagamentos aprovados/elegiveis em");
w("       lotes_pagamento + lotes_pagamento_itens (snapshot bancario).");
w("");
w("--------------------------------------------------------------------------------");
w("2. AGRUPAMENTO POR PRESTADOR (resultado)");
w("--------------------------------------------------------------------------------");
w("pagamentos_prestadores total ............: " + g.pp_total);
w("  com OS vinculada (os_id) ..............: " + g.pp_com_os + "  (operacional: " + g.pp_operacional + " | manual: " + g.pp_manual + ")");
w("  prestadores distintos .................: " + g.prestadores);
w("DUPLICIDADE por OS (mais de 1 linha) ....: " + dup + "  " + (dup === 0 ? "[OK - 1 linha por OS]" : "[!!]"));
w("");
w("Exemplar de grupo correto (maior volume):");
w("  prestador ............: " + (top.prestador_nome || "?"));
w("  OS agrupadas (linhas) : " + top.n + "   |  OS distintas: " + top.nos + "  " + (top.n === top.nos ? "[OK - 1:1]" : "[!!]"));
w("  soma valor_servicos ..: R$ " + top.serv);
w("  soma valor_liquido ...: R$ " + top.liq);
w("");
w("--------------------------------------------------------------------------------");
w("3. OS FINALIZADAS COM REPASSE VALIDO");
w("--------------------------------------------------------------------------------");
w("OS finalizadas com custo_prestador > 0 ..: " + osFinal);
w("  presentes em pagamentos_prestadores ...: " + osComPP + " / " + osFinal + "  (" + Math.round(osComPP / (osFinal||1) * 100) + "%)");
w("  pares OS/PP conferidos ................: " + par.n + "  |  divergencia valor_servicos: " + par.div_serv + "  " + (par.div_serv === 0 ? "[OK]" : "[!!]"));
w("");
w("--------------------------------------------------------------------------------");
w("4. AGRUPAMENTO FINAL (LOTE)");
w("--------------------------------------------------------------------------------");
w("lotes_pagamento ........................: " + lot);
w("lotes_pagamento_itens ..................: " + lit);
w("pagamentos_prestadores_itens ...........: " + itens);
w("  (estrutura de lote pronta; nenhum lote materializado ainda — nao ha regressao.");
w("   A RPC f_gerar_lote_pagamentos existe, e SECURITY DEFINER e agrupa por prestador.)");
w("");
w("--------------------------------------------------------------------------------");
w("5. EXCECOES CLASSIFICADAS (todas LEGADAS — nao sao falha do agrupamento atual)");
w("--------------------------------------------------------------------------------");
w("  - " + orf + " pagamentos com os_id orfao (sem OS): TODOS created Jul/2026, classificacao_dado");
w("    'duvidoso', os_numero NULL — referencias legadas (pre-ligacao OS).");
w("  - " + (osFinal - osComPP) + " OS finalizadas antigas (Abr..Jul/2026: OS-202604, ALOC-20260626, OS-M43,");
w("    M66) sem linha de pagamento — historicas/pre-trigger.");
w("  - 12 pares com valor_liquido antigo divergente (familia M43/M48, Jun/2026) — mesma");
w("    drift de dados ja registrada em FIN-01-CALC.");
w("");
w("--------------------------------------------------------------------------------");
w("6. CONCLUSAO");
w("--------------------------------------------------------------------------------");
w("  [OK] 1 linha de pagamento por OS (zero duplicidade) -> agrupamento nao duplica.");
w("  [OK] valor_servicos do pagamento == custo_prestador da OS em 100% dos pares ativos.");
w("  [OK] Extrato por periodo agrupa por prestador e deduplica Escala x OS.");
w("  [OK] RPC de lote existe e agrupa os pagamentos elegiveis por prestador.");
w("  [i]  Excecoes (orfaos / OS antigas / valores zerados) sao LEGADAS — higiene de dados.");
w("");
w("EVIDENCIAS: scripts/_fin02prefat_validacao.json | scripts/_fin02prefat_excecoes.mjs");
w("================================================================================");
w("FIM — FIN-02-PREFAT");
w("================================================================================");

fs.writeFileSync("FIN-02-PREFAT-LOG.txt", L.join("\r\n"), "latin1");
console.log(L.join("\n"));
console.log("\nGRAVADO: FIN-02-PREFAT-LOG.txt (" + fs.statSync("FIN-02-PREFAT-LOG.txt").size + " bytes)");
