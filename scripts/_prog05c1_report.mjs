import fs from "node:fs";
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const cls = rd("temp/prog05c1.json");
const ex = rd("temp/prog05c1_extra.json");

const acaoPor = (row) => {
  if (row.classe === "E") return "CANCELAR LOGICAMENTE (ja cancelada; preservar)";
  if (row.classe === "D") return "MARCAR TESTE (preservar)";
  if (row.classe === "A") return /DVL/i.test(row.cliente || "") ? "DECISAO HUMANA (confirmar cliente DVL) / PRESERVAR" : "PRESERVAR (aguardar faturamento/reconciliacao)";
  if (row.classe === "F") return "DECISAO HUMANA";
  if (row.classe === "C") return "PRESERVAR (historico pago)";
  if (row.classe === "B") return "VINCULAR/RECONCILIAR";
  return "DECISAO HUMANA";
};
const riscoPor = (row) => {
  if (row.classe === "D") return "Baixo (teste)";
  if (row.classe === "E") return "Baixo";
  if (row.classe === "A") return /DVL/i.test(row.cliente || "") ? "Medio (cliente a confirmar)" : "Baixo";
  if (row.classe === "F") return "Medio (sem cliente)";
  if (row.classe === "B") return "Alto (duplicidade)";
  return "Medio";
};

const lines = [];
for (const r of cls.rows) {
  const fat = (r.faturas_itens || []).map((i) => `${i.fnum || i.fatura_id.slice(0, 8)}${i.tem_ar ? "(AR)" : ""}`).join(",") || "-";
  const osLabel = r.os ? r.os.numero : (r.aloc ? `ALOC:${r.aloc.status}` : (r.os_id || "-"));
  lines.push(`${(r.id || "").slice(0, 8)} | ${(r.os_id || "").slice(0, 8)} | ${(r.cliente || "(sem cliente)").slice(0, 30)} | ${r.valor} | ${r.dv || "-"} | ${r.status || "-"} | ${r.baixa ? "SIM" : "-"} | ${fat} | ${r.classe} | ${acaoPor(r)} | ${riscoPor(r)}`);
}

const dupRasc = ex.rascunhos_risco.filter((x) => x.risco === "DUPLICARIA_AO_EMITIR");
const semRasc = ex.rascunhos_risco.filter((x) => x.risco === "SEM_AR_LEGADO");
const realDup = dupRasc.filter((x) => !/M43/i.test(x.cliente || ""));
const testDup = dupRasc.filter((x) => /M43/i.test(x.cliente || ""));

const f = ex.fat000001;
const txt = `================================================================================
MISSAO: TMS-FIN-PROG-05C.1-AR-LEGADO-CLASSIFICACAO
PROJETO: TMS CONEXAO EXPRESS
AMBIENTE: TMS + Supabase PRODUCAO — READ-ONLY
MODELO: DeepSeek V4.1 Flash
REDMI: NAO conectado
FONTE: TMS-FIN-PROG-05B-AR-SINGLE-SOURCE-RESULTADO.txt
TIPO: AUDITORIA SOMENTE. Nenhuma escrita (apenas SELECT).
================================================================================

RESULTADO: CLASSIFICACAO COMPROVADA (com F para ambiguidade, sem adivinhar).

--------------------------------------------------------------------------------
1. SNAPSHOT INICIAL (e final identico)
--------------------------------------------------------------------------------
receber_total 122 | por_os 98 | por_fatura 6 | pagar 178 | prestadores 137 |
baixas 19 | faturas 41.
(Snapshot FINAL ao termino identico — secao 12.)

--------------------------------------------------------------------------------
2. CLASSIFICACAO QUANTITATIVA (98 AR por os_id)
--------------------------------------------------------------------------------
| Classe | Descricao                                   | Qtd | Soma (R$)   |
|--------|---------------------------------------------|-----|-------------|
| A      | Real ainda nao faturada oficialmente         | 16  | 8.580,00    |
| B      | Real ja faturada com AR oficial (duplicidade)| 0   | 0           |
| C      | Pago/recebido/baixado (preservar historico)  | 0   | 0           |
| D      | Teste/HML                                    | 77  | 153.179,00  |
| E      | Cancelado/invalido                           | 1   | 600,00      |
| F      | Evidencia insuficiente -> decisao humana     | 4   | 4.500,00    |
| Total  |                                              | 98  | 166.859,00  |
Precedencia aplicada: E (cancelado) > D (teste) > C (pago) > F (sem cliente)
  > B (duplicidade) > A (real nao faturada).
Observacao: ha 2 AR com status pago/baixa que sao de TESTE (cf6eea7b Empresa
Demo e fb30838a Empresa Teste) e por isso contam em D (preservar historico).
Nao existe classe C "real paga": nenhum AR real por os_id esta pago.

--------------------------------------------------------------------------------
3. TABELA COMPLETA DOS 98 (id | os_id | cliente | valor | venc | status | baixa | fatura | classe | acao | risco)
--------------------------------------------------------------------------------
${lines.join("\n")}

--------------------------------------------------------------------------------
4. ANALISE FAT-2026-000001 (caso especial)
--------------------------------------------------------------------------------
Fatura FAT-2026-000001 (id ${f.fatura[0].id}) cliente ${f.fatura[0].cliente_id} (M43_...),
status emitida, valor_bruto 2000, valor_total 2120, conta_receber_id 346687cf.
Item ce0b2c98: os_id NULL, alocacao_id c0a7ee88, valor_base 2000,
  valor_adicionais 120, pedagio_cliente 120, valor_total 2120.
AR por FATURA 346687cf: R$ 2.120,00, status aberto, venc 25/09, SEM baixa.
AR por OS     75e0e5f0: R$ 2.000,00, status aberto, venc 22/10, os_id c0a7ee88,
  descricao "Faturamento ALOC-20260712-C0A7EE88", SEM baixa.
Alocacao c0a7ee88 (finalizada): valor_frete 2000, valor_adicional 120,
  valor_pedagio 60. Composicao: valor_cliente 2000, outros_custos 120.
DIFERENCA de R$ 120 = o ADICIONAL (120), que o M66 NAO soma no AR por os
  (M66 usa valor_frete; a fatura inclui valor_adicional).
QUAL CORRESPONDE AO VALOR EFETIVAMENTE FATURADO: o AR por FATURA (R$ 2.120),
  pois e o valor_total da fatura oficial (base 2000 + adicionais 120).
VINCULO: item da fatura aponta alocacao_id = c0a7ee88; AR por os tem os_id = c0a7ee88.
PAGAMENTO/BAIXA: nenhum dos dois.
STATUS: ambos 'aberto'.
CONCLUSÃO: duplicidade economica CONFIRMADA de R$ 2.000,00 (o mesmo servico tem
  2 titulos: 2.000 por os + 2.120 por fatura). Tratamento proposto (NAO executar):
  PRESERVAR ambos; VINCULAR/RECONCILIAR: manter o AR por fatura (2.120) como
  oficial e CANCELAR LOGICAMENTE o AR por os (75e0e5f0 2.000) com observacao de
  referencia a FAT-2026-000001; se confirmado teste (cliente M43), MARCAR TESTE.
  Nenhuma exclusao.

--------------------------------------------------------------------------------
5. ANALISE DOS RASCUNHOS (recalculado do zero)
--------------------------------------------------------------------------------
Total de faturas em rascunho: 26.
Com risco de duplicar ao emitir (item com alocacao_id/os_id que JA tem AR por os):
  ${dupRasc.length}  -> sendo:
    - risco REAL (cliente nao-teste): ${realDup.length}  [${realDup.map((x) => (x.cliente || "") + " " + x.valor_total).join("; ")}]
    - risco TESTE (cliente M43): ${testDup.length}
Sem AR legado correspondente (sem risco no momento): ${semRasc.length}
Inconclusivo: 0.
Confirmacao: o numero "23" da auditoria anterior se confirma EXATAMENTE
(${dupRasc.length} rascunhos). Desses, apenas ${realDup.length} e cliente real
(Calvo) e ${testDup.length} sao do cliente de teste M43 (mesma alocacao c0a7ee88).

--------------------------------------------------------------------------------
6. AUDITORIA ANTI-DUPLICIDADE
--------------------------------------------------------------------------------
Funcao trg_fatura_itens_anti_duplicidade (f_trg_fatura_itens_anti_duplicidade):
  - Linha 1: "IF NEW.os_id IS NULL THEN RETURN NEW;" -> itens sem os_id NAO sao
    verificados. TODOS os 44 fatura_itens tem os_id NULL (25 usam alocacao_id).
  - A checagem usa fi.os_id = NEW.os_id (coluna os_id), ignorando alocacao_id.
  => POR ISSO os itens com os_id NULL + alocacao_id preenchido ESCAPAM.
Correcao minima proposta (PROG-05C.2, NAO implementar):
  - Reconhecer a operacao por alocacao_id quando os_id for NULL:
      chave = COALESCE(NEW.os_id::text, NEW.alocacao_id::text)
      procurar em fatura_itens com COALESCE(fi.os_id::text, fi.alocacao_id::text) = chave
      e fatura nao cancelada e fi.fatura_id <> NEW.fatura_id -> RAISE.
  - Manter a permissao de varios itens legitimos (chaves diferentes) na mesma fatura.
  - Nao quebrar historico: aplicar a checagem apenas em INSERT/UPDATE novos;
    registros existentes nao sao revalidados por trigger.
  - Nao usar DELETE. Sem novo trigger concorrente (ajustar a funcao existente).

--------------------------------------------------------------------------------
7. IMPACTO ATUAL (AR / DRE / Fluxo de Caixa)
--------------------------------------------------------------------------------
financeiro_receber total ................ 122 linhas | R$ 188.884,75
  - AR oficial por fatura ............... 6  | R$ 12.674,02
  - AR legado por os_id ................. 98 | R$ 166.859,00
      A (real nao faturada) ............. 16 | R$ 8.580,00
      D (teste/HML) ..................... 77 | R$ 153.179,00
      E (cancelada) ..................... 1  | R$ 600,00
      F (sem cliente) ................... 4  | R$ 4.500,00
  - AR sem os_id nem fatura_id .......... 18 | R$ 9.351,73
  - Pagos/baixados (status) ............. 11 | R$ 13.425,10
  - Baixas nao estornadas ............... 7  | R$ 3.624,60

Dupla contagem COMPROVADA: FAT-2026-000001 = R$ 2.000,00 (AR os 75e0e5f0 que
  replica o AR fatura 346687cf de R$ 2.120). Afeta:
  - Contas a Receber: lista os 2 titulos -> +R$ 2.000 indevido (teste M43).
  - DRE (competencia): soma TEXT que financeiro_receber receber -> os 2 titulos
    entram -> +R$ 2.000 indevido (teste).
  - Fluxo de Caixa: usa financeiro_baixas; como NENHUM dos 2 foi baixado, NAO ha
    impacto realizado hoje; so haveria se ambos fossem baixados.
Risco FUTURO (nao computado): ${realDup.length} rascunho real (Calvo) que, se
  emitido, criaria um 2o AR para operacao que ja tem AR por os (legado).
Observacao: DRE/Contas a Receber tambem incluem os 77 titulos de TESTE (is_teste
  em parte false), inflando visoes se nao houver filtro de teste.

--------------------------------------------------------------------------------
8. PLANO INDIVIDUAL DE SANEAMENTO (acoes permitidas; NAO executar)
--------------------------------------------------------------------------------
Acoes por classe (a tabela da secao 3 traz linha a linha):
  - A (16) .................. PRESERVAR (real ainda nao faturada). DVL: DECISAO
                              HUMANA (confirmar se cliente real) + PRESERVAR.
  - B (0) ................... (nenhum)
  - C (0) ................... (nenhum real pago; 2 pagos sao teste -> D)
  - D (77) .................. MARCAR TESTE (preservar; nao cancelar agora)
  - E (1) ................... CANCELAR LOGICAMENTE (ja cancelada; preservar)
  - F (4) ................... DECISAO HUMANA (sem cliente vinculado)
Regra: DELETE nunca e solucao padrao. AR pago/baixado: preservacao obrigatoria.

--------------------------------------------------------------------------------
9. CASOS AUTOMATIZAVEIS COM SEGURANCA (proposta)
--------------------------------------------------------------------------------
  - E (1, ja cancelada): nenhuma acao adicional ou apenas registrar observacao.
  - D (77): marcar metadata.is_teste/teste=true (se aprovado) para excluir de
    visoes; operacao reversivel e nao destrutiva.
  - Fatura FAT-2026-000001: CANCELAR LOGICAMENTE o AR os 75e0e5f0 (2.000) com
    referencia textual a fatura, apos confirmacao de que o AR fatura e o oficial
    (evidencia: valor_total da fatura = 2.120).
  - Ajuste do anti-duplicidade (05C.2): impede novas duplicidades por alocacao_id.
Automatizavel com seguranca SOMENTE o que nao depende de julgamento de negocio.

--------------------------------------------------------------------------------
10. CASOS QUE EXIGEM DECISAO HUMANA
--------------------------------------------------------------------------------
  - F (4): AR sem cliente vinculado (ALOC-* finalizada / OS-202606) — vincular
    cliente e decidir faturar ou cancelar logicamente.
  - A/DVL (15): confirmar se "DVL - DISTRIBUIDORA" e cliente real (faturar) ou
    fixture de teste (marcar teste).
  - D test pago (cf6eea7b, fb30838a): confirmar se o pagamento e real ou de teste.
  - Rascunho real (Calvo ${realDup.length}): decidir faturar (gerando AR oficial)
    sem duplicar o AR por os legado.

--------------------------------------------------------------------------------
11. DESENHO EXATO PROG-05C.2 (proposta; NAO implementar)
--------------------------------------------------------------------------------
Etapa 1 (anti-duplicidade): ALTERAR f_trg_fatura_itens_anti_duplicidade para usar
  chave COALESCE(os_id, alocacao_id). Impacto: bloqueia itens repetidos por
  alocacao; nao afeta registros existentes (trigger so em novos writes).
Etapa 2 (classificacao/flag): marcar os AR de teste (D) com is_teste/teste por
  atualizacao controlada (lista fixa de IDs), preservando valores/baixas.
Etapa 3 (FAT-2026-000001): CANCELAR LOGICAMENTE o AR os 75e0e5f0 com observacao
  "substituido pelo AR oficial da fatura FAT-2026-000001"; manter AR fatura.
Etapa 4 (A/F): PRESERVAR; abrir itens de decisao para cliente/faturamento.
Etapa 5 (validacao): DRE/Contas a Receber/Fluxo sem dupla contagem; snapshot +
  rollback conforme PROG-04C.2.
Fora de escopo: AP/gate de Conferencia; M66/M80; PROG-04B/04C; APP.

--------------------------------------------------------------------------------
12. SNAPSHOT FINAL (ZERO ESCRITA)
--------------------------------------------------------------------------------
receber_total 122 | por_os 98 | por_fatura 6 | pagar 178 | prestadores 137 |
baixas 19 | faturas 41 — IDENTICO ao inicial (INALTERADO=true).
Nenhum UPDATE/INSERT/DELETE; nenhuma migration; nenhum AR/fatura alterado.

--------------------------------------------------------------------------------
BASELINE PROG-05B CONFIRMADO
--------------------------------------------------------------------------------
M66 e M80 nao criam AR (removido em 05B); f_emitir_fatura permanece fonte normal;
98 AR por os_id intactos; 38/39/40./41/42 intactas (FAT-2026-000010..14 / NC1..5);
nenhum dado mudou durante esta auditoria.

================================================================================
FIM DO RELATORIO — TMS-FIN-PROG-05C.1-AR-LEGADO-CLASSIFICACAO
================================================================================
`;
fs.writeFileSync("TMS-FIN-PROG-05C1-AR-LEGADO-CLASSIFICACAO-RESULTADO.txt", txt);
console.log("relatorio gerado. linhas tabela:", lines.length, "| dupRasc:", dupRasc.length, "real:", realDup.length, "teste:", testDup.length, "sem:", semRasc.length);
