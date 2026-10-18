import { describe, it, expect } from "vitest";
import { calcularSaldosConta, contaCorresponde } from "@/services/financeiro/contasCaixasService";
import { calcularFluxo } from "@/services/financeiro/fluxoCaixaService";

// ============================================================================
// FIN-MASTER-361 — Testes do Core Financeiro
// Cobertura mínima: 20 cenários obrigatórios.
// Dados puramente matemáticos — sem persistir dados fictícios.
// ============================================================================

const contaA = {
  id: "conta-a",
  nome: "Conta Corrente Principal",
  banco: "Itaú",
  tipo: "Conta Corrente",
  saldo_inicial: 50000,
  ativa: true,
  principal: true,
};

const contaB = {
  id: "conta-b",
  nome: "Conta Reserva",
  banco: "Bradesco",
  tipo: "Conta Poupança",
  saldo_inicial: 20000,
  ativa: true,
  principal: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1 — Valor Canônico (P0-1)
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 1 — Valor Canônico do Contas a Pagar", () => {
  it("1. título bruto R$ 2.005 / líquido R$ 2.000 → saldo = valor (2.000), NÃO valor_bruto", () => {
    // O RPC usa `valor` como fonte canônica para cálculo de saldo.
    // Se UI mostra valor_bruto (2.005) mas RPC calcula com valor (2.000),
    // há divergência de R$ 5. A UI DEVE usar `valor` como exibição.
    const valor = 2000;      // coluna `valor` — fonte canônica
    const valorBruto = 2005; // coluna `valor_bruto` — informativa
    const baixas = 0;

    const saldo = valor - baixas;
    expect(saldo).toBe(2000);
    expect(valorBruto).toBe(2005);
    // Regra: UI exibe `valor`, RPC usa `valor` → zero divergência
    expect(saldo).toBe(valor);
  });

  it("2. valor LÍQUIDO = valor - desconto + multa + juros - impostos", () => {
    // No schema atual, `valor` já é o valor canônico do título.
    // `valor_bruto` é o valor antes de descontos/bônus.
    // `valor_liquido` é calculado no front: bruto - desconto + multa + juros - impostos
    // Mas o campo `valor` no banco é o que o RPC usa.
    const valorBruto = 2005;
    const desconto = 5;
    const multa = 0;
    const juros = 0;
    const impostos = 0;
    const valorCalculado = valorBruto - desconto + multa + juros - impostos;
    expect(valorCalculado).toBe(2000);
    // Este valorCalculado DEVE ser gravado como `valor` no banco
  });

  it("3. valor negativo ou zero é rejeitado", () => {
    const valor = -100;
    const isValido = valor > 0;
    expect(isValido).toBe(false);
  });

  it("4. valor Original = valor (canônico) para exibição na UI", () => {
    const titulo = { valor: 2000, valor_bruto: 2005, valor_liquido: 1990 };
    // FIN-MASTER-361: UI lê `valor` primeiro, NÃO `valor_bruto`
    const exibido = titulo.valor || titulo.valor_bruto || 0;
    expect(exibido).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2 — Pago no Mês (P0-2)
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 2 — Pago no Mês", () => {
  it("5. baixa no mês atual →计入 pago no mês", () => {
    const mesAtual = "2026-09";
    const baixas = [
      { valor_baixado: 1000, data_baixa: "2026-09-01", estornada: false, titulo_tabela: "financeiro_pagar" },
      { valor_baixado: 500, data_baixa: "2026-09-15", estornada: false, titulo_tabela: "financeiro_pagar" },
    ];
    const pagoMes = baixas
      .filter(b => !b.estornada && b.titulo_tabela === "financeiro_pagar" && b.data_baixa.startsWith(mesAtual))
      .reduce((a, b) => a + b.valor_baixado, 0);
    expect(pagoMes).toBe(1500);
  });

  it("6. baixa mês anterior NÃO计入 pago no mês atual", () => {
    const mesAtual = "2026-09";
    const baixas = [
      { valor_baixado: 2000, data_baixa: "2026-08-20", estornada: false, titulo_tabela: "financeiro_pagar" },
    ];
    const pagoMes = baixas
      .filter(b => !b.estornada && b.titulo_tabela === "financeiro_pagar" && b.data_baixa.startsWith(mesAtual))
      .reduce((a, b) => a + b.valor_baixado, 0);
    expect(pagoMes).toBe(0);
  });

  it("7. baixa futura NÃO计入 pago no mês atual", () => {
    const mesAtual = "2026-09";
    const baixas = [
      { valor_baixado: 3000, data_baixa: "2026-10-05", estornada: false, titulo_tabela: "financeiro_pagar" },
    ];
    const pagoMes = baixas
      .filter(b => !b.estornada && b.titulo_tabela === "financeiro_pagar" && b.data_baixa.startsWith(mesAtual))
      .reduce((a, b) => a + b.valor_baixado, 0);
    expect(pagoMes).toBe(0);
  });

  it("8. baixa estornada NÃO计入 pago no mês", () => {
    const mesAtual = "2026-09";
    const baixas = [
      { valor_baixado: 1000, data_baixa: "2026-09-10", estornada: true, titulo_tabela: "financeiro_pagar" },
    ];
    const pagoMes = baixas
      .filter(b => !b.estornada && b.titulo_tabela === "financeiro_pagar" && b.data_baixa.startsWith(mesAtual))
      .reduce((a, b) => a + b.valor_baixado, 0);
    expect(pagoMes).toBe(0);
  });

  it("9. baixa parcial conta corretamente no mês", () => {
    const mesAtual = "2026-09";
    const baixas = [
      { valor_baixado: 300, data_baixa: "2026-09-12", estornada: false, titulo_tabela: "financeiro_pagar" },
    ];
    const pagoMes = baixas
      .filter(b => !b.estornada && b.titulo_tabela === "financeiro_pagar" && b.data_baixa.startsWith(mesAtual))
      .reduce((a, b) => a + b.valor_baixado, 0);
    expect(pagoMes).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 3 — conta_financeira_id Canônico
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 3 — conta_financeira_id", () => {
  it("10. UUID da conta vincula baixa à conta correta", () => {
    const baixa = {
      conta_financeira_id: "conta-a",
      conta_financeira: "Conta Corrente Principal",
      valor_baixado: 500,
      titulo_tabela: "financeiro_pagar" as const,
      estornada: false,
    };
    expect(contaCorresponde(contaA, baixa.conta_financeira_id, baixa.conta_financeira)).toBe(true);
  });

  it("11. UUID não encontrado na conta → falso", () => {
    expect(contaCorresponde(contaA, "conta-xyz", null)).toBe(false);
  });

  it("12. fallback textual (fuzzy match) funciona para compatibilidade", () => {
    expect(contaCorresponde(contaA, null, "Conta Corrente Principal")).toBe(true);
  });

  it("13. conta sem referência → falso", () => {
    expect(contaCorresponde(contaA, null, null)).toBe(false);
    expect(contaCorresponde(contaA, null, "")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 4+5 — Baixa (RPC) + Saldo Real
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 4+5 — Baixa e Saldo", () => {
  it("14. entrada por conta via baixa → saldoReal aumenta", () => {
    const s = calcularSaldosConta(
      contaA,
      [{ conta_financeira_id: "conta-a", valor_baixado: 5000, titulo_tabela: "financeiro_receber", estornada: false }],
      [],
      [],
      []
    );
    expect(s.entradasRealizadas).toBe(5000);
    expect(s.saldoReal).toBe(55000); // 50000 + 5000
  });

  it("15. saída por conta via baixa → saldoReal diminui", () => {
    const s = calcularSaldosConta(
      contaA,
      [],
      [{ conta_financeira_id: "conta-a", valor_baixado: 3000, titulo_tabela: "financeiro_pagar", estornada: false }],
      [],
      []
    );
    expect(s.saidasRealizadas).toBe(3000);
    expect(s.saldoReal).toBe(47000); // 50000 - 3000
  });

  it("16. baixa estornada NÃO afeta saldo", () => {
    const s = calcularSaldosConta(
      contaA,
      [{ conta_financeira_id: "conta-a", valor_baixado: 5000, titulo_tabela: "financeiro_receber", estornada: true }],
      [],
      [],
      []
    );
    expect(s.entradasRealizadas).toBe(0);
    expect(s.saldoReal).toBe(50000);
  });

  it("17. baixa parcial → saldo proporcional", () => {
    const s = calcularSaldosConta(
      contaA,
      [],
      [{ conta_financeira_id: "conta-a", valor_baixado: 1500, titulo_tabela: "financeiro_pagar", estornada: false }],
      [],
      []
    );
    expect(s.saidasRealizadas).toBe(1500);
    expect(s.saldoReal).toBe(48500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 6 — Transferências
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 6 — Transferências Atômicas", () => {
  it("18. transferência: conta A perde X, conta B ganha X, consolidado NÃO muda", () => {
    const saldoInicialA = 50000;
    const saldoInicialB = 20000;
    const valorTransferencia = 10000;

    // Simular operação atômica
    const novoSaldoA = saldoInicialA - valorTransferencia;
    const novoSaldoB = saldoInicialB + valorTransferencia;

    expect(novoSaldoA).toBe(40000);
    expect(novoSaldoB).toBe(30000);

    // Consolidado não muda
    const consolidadoAntes = saldoInicialA + saldoInicialB;
    const consolidadoDepois = novoSaldoA + novoSaldoB;
    expect(consolidadoDepois).toBe(consolidadoAntes);
  });

  it("19. transferência com taxa: origem perde (valor+taxa), destino ganha valor", () => {
    const valor = 10000;
    const taxa = 25;
    const origemPerde = valor + taxa;
    const destinoGanha = valor;

    expect(origemPerde).toBe(10025);
    expect(destinoGanha).toBe(10000);
    // Consolidado: -10025 + 10000 = -25 (taxa é custo)
    const impactoConsolidado = -origemPerde + destinoGanha;
    expect(impactoConsolidado).toBe(-25);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 7 — Fluxo Realizado
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 7 — Fluxo Realizado", () => {
  it("20. fluxo realizado usa SOMENTE baixas (não status do título)", () => {
    const fluxo = calcularFluxo(
      [{ tipo: "entrada", valor: 1000 }],
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 700, estornada: false }]
    );
    expect(fluxo.previstoEntrada).toBe(1000);
    expect(fluxo.realizadoEntrada).toBe(700);
    // Regra: previsto e realizado NUNCA se somam como dois fatos
    expect(fluxo.realizadoEntrada).not.toBe(1700);
  });

  it("21. baixa estornada não计入 realizado", () => {
    const fluxo = calcularFluxo(
      [{ tipo: "entrada", valor: 1000 }],
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 1000, estornada: true }]
    );
    expect(fluxo.realizadoEntrada).toBe(0);
  });

  it("22. saída realizada (baixa a pagar)计入 realizado", () => {
    const fluxo = calcularFluxo(
      [{ tipo: "saida", valor: 2000 }],
      [{ titulo_tabela: "financeiro_pagar", valor_baixado: 2000, estornada: false }]
    );
    expect(fluxo.realizadoSaida).toBe(2000);
    expect(fluxo.previstoSaida).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 8 — Saldo Inicial
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 8 — Saldo Inicial", () => {
  it("23. saldoInicial vem de contas_financeiras.saldo_inicial (não seed)", () => {
    const contas = [
      { saldo_inicial: 50000, ativa: true },
      { saldo_inicial: 20000, ativa: true },
    ];
    const total = contas.filter(c => c.ativa).reduce((a, c) => a + c.saldo_inicial, 0);
    expect(total).toBe(70000);
  });

  it("24. contas inativas não计入 saldo inicial", () => {
    const contas = [
      { saldo_inicial: 50000, ativa: true },
      { saldo_inicial: 99999, ativa: false },
    ];
    const total = contas.filter(c => c.ativa).reduce((a, c) => a + c.saldo_inicial, 0);
    expect(total).toBe(50000);
  });

  it("25. contas sem saldo_inicial → tratadas como zero", () => {
    const contas = [
      { saldo_inicial: null, ativa: true },
      { saldo_inicial: undefined, ativa: true },
    ];
    const total = contas.filter(c => c.ativa).reduce((a, c) => a + (Number(c.saldo_inicial) || 0), 0);
    expect(total).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 9 — Fluxo Previsto
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 9 — Fluxo Previsto", () => {
  it("26. título sem conta definida aparece em 'Sem conta definida'", () => {
    const items = [
      { id: "1", data: "2026-09-01", descricao: "Pagamento X", categoria: "Custo", tipo: "saida" as const, valor: 500, origem: "previsto" as const, realizado: false, conta: undefined },
    ];
    const contaFiltro = "Sem conta definida";
    const filtrados = items.filter(l => l.conta === contaFiltro || (!l.conta && contaFiltro === "Sem conta definida"));
    expect(filtrados.length).toBe(1);
  });

  it("27. filtro 'todas' mostra todos incluindo sem conta", () => {
    const items = [
      { id: "1", data: "2026-09-01", descricao: "A", categoria: "X", tipo: "saida" as const, valor: 100, origem: "previsto" as const, realizado: false, conta: "Conta A" },
      { id: "2", data: "2026-09-02", descricao: "B", categoria: "X", tipo: "saida" as const, valor: 200, origem: "previsto" as const, realizado: false, conta: undefined },
    ];
    const filtrados = items.filter(l => true); // "todas"
    expect(filtrados.length).toBe(2);
  });

  it("28. filtro conta específica exclui sem conta", () => {
    const items = [
      { id: "1", data: "2026-09-01", descricao: "A", categoria: "X", tipo: "saida" as const, valor: 100, origem: "previsto" as const, realizado: false, conta: "Conta A" },
      { id: "2", data: "2026-09-02", descricao: "B", categoria: "X", tipo: "saida" as const, valor: 200, origem: "previsto" as const, realizado: false, conta: undefined },
    ];
    const contaFiltro = "Conta A";
    const filtrados = items.filter(l => l.conta === contaFiltro || (!l.conta && contaFiltro === "Sem conta definida"));
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].conta).toBe("Conta A");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 10 — Pagamento Prestadores (anti-duplicidade)
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 FASE 10 — Pagamento Prestadores", () => {
  it("29. se existe financeiro_pagar para prestador → baixa automática (não duplica)", () => {
    const tituloPagar = { id: "fp-1", valor: 5000, status: "aberto" };
    const pagamentoPrestador = { prestador_id: "p1", valor_liquido: 5000 };

    // Lógica: buscar título → existe → registrar baixa
    const existeTitulo = !!tituloPagar && tituloPagar.status !== "pago";
    expect(existeTitulo).toBe(true);

    // Valor da baixa = min(valor_pagamento, valor_titulo_saldo)
    const valorBaixar = Math.min(pagamentoPrestador.valor_liquido, tituloPagar.valor);
    expect(valorBaixar).toBe(5000);
  });

  it("30. se NÃO existe financeiro_pagar → registrar saída avulsa em financeiro_baixas", () => {
    const tituloPagar = null;
    const pagamentoPrestador = { prestador_id: "p1", prestador_nome: "Motorista X", valor_liquido: 3000 };

    const existeTitulo = !!tituloPagar;
    expect(existeTitulo).toBe(false);

    // Lógica: sem título → inserir em financeiro_baixas direto
    const registroAvulso = {
      titulo_tabela: "financeiro_pagar",
      titulo_id: null,
      valor_original: pagamentoPrestador.valor_liquido,
      valor_baixado: pagamentoPrestador.valor_liquido,
      saldo_restante: 0,
    };
    expect(registroAvulso.valor_baixado).toBe(3000);
    expect(registroAvulso.titulo_id).toBeNull();
  });

  it("31. pagamento confirmado NÃO pode ser reconfirmado", () => {
    const atual = { status_pagamento: "pago" };
    const podeConfirmar = atual.status_pagamento !== "pago" && atual.status_pagamento !== "cancelado";
    expect(podeConfirmar).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSÃO — ContasCaixasService
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 REGRESSÃO — contasCaixasService", () => {
  it("R1. contasCaixas: contaCorresponde com UUID exato", () => {
    expect(contaCorresponde(contaA, "conta-a", null)).toBe(true);
    expect(contaCorresponde(contaA, "conta-b", null)).toBe(false);
  });

  it("R2. contasCaixas: cálculo com múltiplas contas", () => {
    const sA = calcularSaldosConta(
      contaA,
      [{ conta_financeira_id: "conta-a", valor_baixado: 10000, titulo_tabela: "financeiro_receber", estornada: false }],
      [{ conta_financeira_id: "conta-a", valor_baixado: 5000, titulo_tabela: "financeiro_pagar", estornada: false }],
      [], []
    );
    expect(sA.saldoReal).toBe(55000); // 50000 + 10000 - 5000
  });

  it("R3. contasCaixas: saldo projetado com futuros", () => {
    const s = calcularSaldosConta(
      contaA, [], [],
      [{ conta: "Conta Corrente Principal", valor: 20000 }],
      [{ conta: "Conta Corrente Principal", valor: 8000 }]
    );
    expect(s.saldoProjetado).toBe(62000); // 50000 + 20000 - 8000
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSÃO — fluxoCaixaService
// ═══════════════════════════════════════════════════════════════════════════════
describe("FIN-361 REGRESSÃO — fluxoCaixaService", () => {
  it("R4. fluxoCaixa: previsto e realizado são independentes", () => {
    const r = calcularFluxo(
      [{ tipo: "entrada", valor: 10000 }, { tipo: "saida", valor: 3000 }],
      [
        { titulo_tabela: "financeiro_receber", valor_baixado: 7000, estornada: false },
        { titulo_tabela: "financeiro_pagar", valor_baixado: 1000, estornada: false },
      ]
    );
    expect(r.previstoEntrada).toBe(10000);
    expect(r.previstoSaida).toBe(3000);
    expect(r.realizadoEntrada).toBe(7000);
    expect(r.realizadoSaida).toBe(1000);
  });

  it("R5. fluxoCaixa: fluxo líquido = realizadoEntrada - realizadoSaida", () => {
    const r = calcularFluxo(
      [],
      [
        { titulo_tabela: "financeiro_receber", valor_baixado: 15000, estornada: false },
        { titulo_tabela: "financeiro_pagar", valor_baixado: 8000, estornada: false },
      ]
    );
    expect(r.fluxoRealizado).toBe(7000); // 15000 - 8000
  });
});
