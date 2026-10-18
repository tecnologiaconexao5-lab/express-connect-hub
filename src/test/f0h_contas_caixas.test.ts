import { describe, it, expect } from "vitest";
import { calcularSaldosConta, contaCorresponde } from "@/services/financeiro/contasCaixasService";

// ============================================================================
// F0-H — Contas & Caixas: saldo real/projetado (sem persistir dados fictícios).
// ============================================================================

const conta = {
  id: "c1",
  nome: "Conta Corrente Principal",
  banco: "Itaú",
  tipo: "Conta Corrente",
  saldo_inicial: 1000,
  ativa: true,
  principal: true,
};

describe("F0-H — Contas & Caixas", () => {
  it("1. conta com saldo inicial R$ 1.000 e sem movimentação → saldo real 1.000", () => {
    const s = calcularSaldosConta(conta, [], [], [], []);
    expect(s.saldoInicial).toBe(1000);
    expect(s.entradasRealizadas).toBe(0);
    expect(s.saidasRealizadas).toBe(0);
    expect(s.saldoReal).toBe(1000);
    expect(s.saldoProjetado).toBe(1000);
  });

  it("2. entrada realizada R$ 500 → entradas 500", () => {
    const s = calcularSaldosConta(
      conta,
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" }],
      [], [], []
    );
    expect(s.entradasRealizadas).toBe(500);
  });

  it("3. saída realizada R$ 300 → saídas 300", () => {
    const s = calcularSaldosConta(
      conta, [],
      [{ titulo_tabela: "financeiro_pagar", valor_baixado: 300, estornada: false, conta_financeira: "Conta Corrente Principal" }],
      [], []
    );
    expect(s.saidasRealizadas).toBe(300);
  });

  it("4. saldo real = 1.000 + 500 − 300 = 1.200", () => {
    const s = calcularSaldosConta(
      conta,
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" }],
      [{ titulo_tabela: "financeiro_pagar", valor_baixado: 300, estornada: false, conta_financeira_id: "c1" }],
      [], []
    );
    expect(s.saldoReal).toBe(1200);
  });

  it("5. título futuro a receber R$ 400 → saldo real continua 1.200 e projetado = 1.600", () => {
    const s = calcularSaldosConta(
      conta,
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" }],
      [{ titulo_tabela: "financeiro_pagar", valor_baixado: 300, estornada: false, conta_financeira_id: "c1" }],
      [{ conta: "Conta Corrente Principal", valor: 400 }],
      []
    );
    expect(s.saldoReal).toBe(1200); // título futuro NÃO altera saldo real
    expect(s.saldoProjetado).toBe(1600);
  });

  it("6. baixa estornada NÃO compõe o saldo", () => {
    const s = calcularSaldosConta(
      conta,
      [
        { titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" },
        { titulo_tabela: "financeiro_receber", valor_baixado: 900, estornada: true, conta_financeira_id: "c1" },
      ],
      [], [], []
    );
    expect(s.entradasRealizadas).toBe(500); // estornada ignorada
    expect(s.saldoReal).toBe(1500);
  });

  it("7. filtro por conta: movimentação de outra conta NÃO entra", () => {
    const outra = { ...conta, id: "c2", nome: "Caixa Interno" };
    const s = calcularSaldosConta(
      outra,
      [
        { titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" },
        { titulo_tabela: "financeiro_receber", valor_baixado: 200, estornada: false, conta_financeira: "Caixa Interno" },
      ],
      [], [], []
    );
    expect(s.entradasRealizadas).toBe(200); // só a baixa vinculada a c2
  });

  it("8. conta inativa preserva histórico (saldo continua calculado)", () => {
    const inativa = { ...conta, ativa: false };
    const s = calcularSaldosConta(
      inativa,
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" }],
      [], [], []
    );
    expect(s.saldoReal).toBe(1500); // histórico preservado
  });

  it("9. vínculo por ID tem precedência e fallback textual funciona", () => {
    expect(contaCorresponde(conta, "c1", "qualquer coisa")).toBe(true); // ID real
    expect(contaCorresponde(conta, null, "Itaú")).toBe(true); // banco textual
    expect(contaCorresponde(conta, null, "OUTRA CONTA")).toBe(false);
    // textual legado: nome da baixa (conta_financeira) casa com nome/banco/tipo
    expect(contaCorresponde(conta, null, "Conta Corrente Principal")).toBe(true);
  });
});
