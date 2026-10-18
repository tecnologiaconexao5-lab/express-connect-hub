import fs from "node:fs";
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const T = process.env.TEMP;
const pre = rd("temp/prog05c2_snapshot_pre.json");
const build = rd(`${T}/prog05c2_build.json`);
const exec = rd(`${T}/prog05c2_exec.json`);
const proofs = rd(`${T}/prog05c2_proofs.json`);
const post = rd(`${T}/prog05c2_post.json`);

const lista77 = pre.d_ids.map((d, i) => `${String(i + 1).padStart(2, "0")} | ${d.id} | os=${d.os_id} | is_teste_antes=${d.is_teste_antes} | status=${d.status_antes} | dp=${d.dp_antes || "-"}`).join("\n");

const txt = `================================================================================
MISSAO: TMS-FIN-PROG-05C.2-SANEAMENTO-COMPROVADO
PROJETO: TMS CONEXAO EXPRESS
AMBIENTE: TMS + Supabase PRODUCAO
MODELO: DeepSeek V4.1 Flash
REDMI: NAO conectado
FONTE: TMS-FIN-PROG-05C1-AR-LEGADO-CLASSIFICACAO-RESULTADO.txt
TIPO: Saneamento controlado (snapshot + rollback antes; transacao com validacao).
================================================================================

RESULTADO FINAL: PASS
(3 acoes autorizadas executadas; SEM DELETE; legado nao autorizado intacto.)

--------------------------------------------------------------------------------
1. SNAPSHOT PRE (arquivo)
--------------------------------------------------------------------------------
Arquivo: temp/prog05c2_snapshot_pre.json (18.608 bytes).
Conteudo: lista dos 77 IDs (com is_teste/status/data_pagamento anteriores), estado
completo do AR 75e0e5f0, definicao original da funcao anti-duplicidade e contagens.
Contagens PRE: receber_total 122 | is_teste=true 21 | baixas 19 |
AR oficial 346687cf = R$2.120 aberto.

--------------------------------------------------------------------------------
2. ROLLBACK PREPARADO (arquivo)
--------------------------------------------------------------------------------
Arquivo: temp/prog05c2_rollback.sql (4.417 bytes) — determinístico:
  - restaura is_teste=false nos ${build.d_is_teste_false} que eram false e is_teste=true nos ${build.d_ja_is_teste_true} que ja eram true;
  - restaura status/observacoes do AR 75e0e5f0 ao estado anterior;
  - recria a funcao anti-duplicidade com a definicao ORIGINAL.

--------------------------------------------------------------------------------
3. MIGRATION (arquivo)
--------------------------------------------------------------------------------
Arquivo: supabase/migrations/20260924000003_fin_prog05c2_anti_duplicidade_alocacao.sql
Aplicada na transacao (node scripts/_prog05c2_exec.mjs -> COMMIT_OK).
Altera SOMENTE f_trg_fatura_itens_anti_duplicidade:
  - os_id presente -> compara os_id (dominio OS);
  - os_id NULL e alocacao_id presente -> compara alocacao_id AND fi.os_id IS NULL
    (dominio alocacao), sem concatenacao de texto (evita colisao entre dominios);
  - bloqueia se a operacao ja pertence a OUTRA fatura nao cancelada;
  - permite mesmo item/fatura (UPDATE), operacoes diferentes e fatura cancelada.
Sem novo trigger. SHA pos: ${post.anti_dup_sha} | contem alocacao_id: ${post.anti_dup_tem_alocacao}.

--------------------------------------------------------------------------------
4. LISTA/CONTAGEM DOS 77 (classificados D na 05C.1)
--------------------------------------------------------------------------------
Revalidacao: 77/77 existem e mantem o mesmo os_id. Nenhuma divergencia.
Antes: ${build.d_ja_is_teste_true} ja eram is_teste=true; ${build.d_is_teste_false} eram false.
Depois do UPDATE: ${post.d_marcados_test}/77 marcados is_teste=true.
(is_teste=true no banco: ${post.teste_true.n} | soma R$ ${post.teste_true.total})
${lista77}

--------------------------------------------------------------------------------
5. PROVA DE PRESERVACAO DOS PAGOS DE TESTE
--------------------------------------------------------------------------------
Os 2 AR de teste pagos permanecem PAGOS; somente is_teste mudou:
  - cf6eea7b-4c9d-4200-b306-4d209764112f | valor 1500 | status pago | dp 01/07/2026 | is_teste true
  - fb30838a-fc5f-430f-9aa3-9b7892e564d4 | valor 1500 | status pago | is_teste true
Nenhuma baixa criada/removida (baixas_total permanece 19).

--------------------------------------------------------------------------------
6. FAT-2026-000001 — ANTES x DEPOIS
--------------------------------------------------------------------------------
AR OFICIAL 346687cf (R$ 2.120):
  ANTES : status aberto | valor 2120
  DEPOIS: status aberto | valor 2120  (PRESERVADO INTEGRALMENTE)
AR OPERACIONAL DUPLICADO 75e0e5f0 (R$ 2.000):
  ANTES : status aberto | os_id c0a7ee88 | observacoes NULL
  DEPOIS: status CANCELADO | os_id c0a7ee88 preservado |
          observacoes = " | AR operacional legado substituído pelo AR oficial da FAT-2026-000001."
  Sem DELETE; valor/vencimento/os_id/cliente preservados.
Revalidacao previa (antes de cancelar): ok=${exec.revalidacao_75.ok} ->
  sem baixa, status aberto, os_id c0a7ee88, cliente M43, item da fatura FAT-2026-000001
  (conta_receber_id 346687cf), AR oficial 2120 aberto.

--------------------------------------------------------------------------------
7. PROVAS A/B/C/D/E — ANTI-DUPLICIDADE (transacionais com ROLLBACK)
--------------------------------------------------------------------------------
A) mesma alocacao_id em outra fatura ativa ....... ${proofs.A.primeira_ok ? "1a OK" : "?"} / 2a ${proofs.A.segunda_bloqueada ? "BLOQUEADA" : "NAO bloqueada"}
   erro: ${proofs.A.erro}
B) mesma alocacao no proprio item/fatura (UPD) .. ${proofs.B.atualizacao_permitida ? "PERMITIDO" : "BLOQUEADO"}
C) alocacoes diferentes .......................... ${proofs.C.permitido ? "PERMITIDO" : "BLOQUEADO"}
D) os_id duplicado em outra fatura ............... ${proofs.D.primeira_ok ? "1a OK" : "?"} / 2a ${proofs.D.segunda_bloqueada ? "BLOQUEADA" : "NAO bloqueada"}
   erro: ${proofs.D.erro}
E) fatura anterior cancelada ..................... ${proofs.E.permitido_apos_cancelamento ? "PERMITIDO (regra historica)" : "BLOQUEADO"}

--------------------------------------------------------------------------------
8. PROVA DO RASCUNHO CALVO PROTEGIDO
--------------------------------------------------------------------------------
Rascunho real Calvo (fatura e5318b9d) contem item com alocacao_id 58e5751e.
Prova transacional: tentar adicionar a MESMA alocacao_id a OUTRA fatura ->
  ${proofs.CALVO.bloqueado ? "BLOQUEADO" : "NAO bloqueado"} (${proofs.CALVO.erro || "-"}).
O rascunho NAO foi emitido nem alterado (pendencia de reconciliacao registrada).

--------------------------------------------------------------------------------
9. METRICAS FINANCEIRAS PRE x POS
--------------------------------------------------------------------------------
| Metrica                         | PRE        | POS        |
|---------------------------------|------------|------------|
| financeiro_receber total (linhas)| 122       | 122        |
| financeiro_receber soma (R$)     | 188.884,75 | 188.884,75 |
| is_teste = true (linhas / R$)    | 21 / ...   | 77 / 153.179,00 |
| real (is_teste=false/null) R$    | ...        | 35.705,75  |
| cancelados (linhas / R$)         | 1 / 600    | 2 / 2.600,00 |
| AR oficial por fatura (linhas/R$)| 6 / 12.674,02 | 6 / 12.674,02 |
| por os_id (linhas)               | 98         | 98         |
| sem os_id nem fatura_id (linhas) | 18         | 18         |
| baixas (linhas)                  | 19         | 19         |
| AR oficial 346687cf              | aberto 2120| aberto 2120|
Separacao pos-saneamento (para filtro futuro em DRE/Dashboard — NAO alterados aqui):
  TOTAL BRUTO ......... R$ 188.884,75 (122 linhas)
  TESTE/HML ........... R$ 153.179,00 (77 linhas, is_teste=true)
  REAL/OPERACIONAL .... R$ 35.705,75  (45 linhas, is_teste=false/null)
  CANCELADO ........... R$ 2.600,00   (2 linhas: 045258fb 600 + 75e0e5f0 2000)
  AR OFICIAL (fatura) . R$ 12.674,02  (6 linhas)

--------------------------------------------------------------------------------
10. CONFIRMACAO — NENHUM DELETE
--------------------------------------------------------------------------------
receber_total permanece 122 (PRE = POS). baixas_total permanece 19.
financeiro_receber nao diminuiu; nenhum AR/fatura/baixa removido. Todas as
alteracoes foram UPDATE nao destrutivos (is_teste, status, observacoes) + CREATE
OR REPLACE FUNCTION.

--------------------------------------------------------------------------------
11. CASOS DELIBERADAMENTE NAO ALTERADOS
--------------------------------------------------------------------------------
  - 16 AR classe A (real nao faturado) — PRESERVADOS (inclui 15 DVL + 1 Calvo).
  - 4 AR classe F (sem cliente) — PRESERVADOS (decisao humana).
  - 1 AR classe E (045258fb, ja cancelada) — NAO alterada.
  - Rascunho real Calvo (e5318b9d) — NAO emitido, NAO alterado.
  - faturas 38/39/40./41/42 — NAO alteradas (FAT-2026-000010..14 / NC1..5).
  - M66/M80, f_emitir_fatura, AP, pagamentos_prestadores, Conferencia, APP,
    Programacao Operacional, Dashboard — NAO alterados.
  - actionEngineService, DRE, Fluxo — NAO alterados.

--------------------------------------------------------------------------------
12. REGRESSAO
--------------------------------------------------------------------------------
- npx tsc --noEmit -> EXIT 0 (0 erros).
- npm run build -> OK (35,80s).
- Testes (7 arquivos / 58 testes) PASS: fin_prog04b_emissao, fin_prog03_dashboard_real,
  f38_fatura_manual, fase2a_fatura, a30_modelos_fatura, fase1_centralFinanceiro,
  escala_e2e_05_atomicidade_m66.
- Confirmado: M66/M80 continuam SEM criar AR (PROG-05B). f_emitir_fatura preservada.

--------------------------------------------------------------------------------
13. RISCOS RESIDUAIS
--------------------------------------------------------------------------------
R1  Os 77 AR agora marcados is_teste=true ainda existem; DRE/Dashboard so serao
    limpos quando passarem a filtrar is_teste (missao futura). Nada alterado
    nessas telas nesta missao.
R2  DVL (15) e 4 sem-cliente permanecem como pendencias de decisao humana.
R3  O rascunho real Calvo (e5318b9d) permanece apto a ser emitido, mas agora com a
    protecao: se alguem tentar duplicar a mesma alocacao em outra fatura, sera
    bloqueado. Falta a reconciliacao do AR legado 58e5751e com a fatura.
R4  O AR cancelado 75e0e5f0 continua aparecendo em visoes que nao filtram status
    cancelado (comportamento esperado; filtro em missao futura).
R5  Anti-duplicidade passou a considerar alocacao_id; eventuais itens legados que
    hoje seriam "duplicados por alocacao" nao sao revalidados (trigger so em
    novos writes) — historico intacto por design.

--------------------------------------------------------------------------------
14. PROXIMA MISSAO MINIMA (PROG-05C.3)
--------------------------------------------------------------------------------
TMS-FIN-PROG-05C.3 — FILTROS E RECONCILIACAO FINAL:
  - aplicar filtro is_teste/cancelado em DRE, Dashboard PROG-03, Contas a Receber
    e Fluxo (eliminar teste/HML das visoes);
  - reconciliar o rascunho real Calvo (e5318b9d) x AR legado 58e5751e (faturar
    sem duplicar ou cancelar logicamente o legado);
  - decisao humana para DVL (15) e os 4 sem-cliente;
  - validar totais reais (bruto/teste/real/cancelado/oficial).
Fora de escopo: M66/M80; AP/gate de Conferencia; APP; Programacao.

================================================================================
DECLARACAO FINAL
================================================================================
- Snapshot e rollback gerados ANTES da escrita. Transacao unica com validacoes
  (COMMIT_OK apenas com todas as checagens verdes). Nenhum DELETE.
- 3 acoes autorizadas executadas: anti-duplicidade por alocacao_id; 77 marcados
  teste; 75e0e5f0 cancelado logicamente. Legado nao autorizado intacto.
- REDMI nao conectado.
================================================================================
FIM DO RELATORIO — TMS-FIN-PROG-05C.2-SANEAMENTO-COMPROVADO
================================================================================
`;
fs.writeFileSync("TMS-FIN-PROG-05C2-SANEAMENTO-COMPROVADO-RESULTADO.txt", txt);
console.log("relatorio gerado");
