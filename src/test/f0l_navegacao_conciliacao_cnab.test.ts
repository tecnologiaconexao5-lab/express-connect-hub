import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  GRUPOS_NAVEGACAO,
  MODULOS_CRITICOS,
  TODOS_VALORES_NAV,
} from "@/components/financeiro/financeiroNav";
import { calcularSaldosConta } from "@/services/financeiro/contasCaixasService";

const financeiroDir = path.resolve(process.cwd(), "src", "components", "financeiro");

function ler(nome: string): string {
  return fs.readFileSync(path.join(financeiroDir, nome), "utf8");
}

// ============================================================================
// F0-L — Navegação, Conciliação e CNAB (sem mock como real; sem tabelas fantasmas).
// ============================================================================

describe("F0-L — Navegação financeira", () => {
  it("1. módulos críticos ficam localizáveis (todos em grupos explícitos, sem seta escondida)", () => {
    for (const mod of MODULOS_CRITICOS) {
      expect(TODOS_VALORES_NAV, `módulo crítico não localizável: ${mod}`).toContain(mod);
    }
    expect(GRUPOS_NAVEGACAO.map((g) => g.grupo)).toEqual([
      "Visão Geral", "Faturamento", "Pagamentos", "Tesouraria",
      "Gestão", "Outros (legado)", "Configurações",
    ]);
  });

  it("2. navegação ativa: valores únicos, página renderiza a partir dos grupos e todo módulo crítico tem conteúdo", () => {
    expect(new Set(TODOS_VALORES_NAV).size).toBe(TODOS_VALORES_NAV.length); // sem duplicidade
    const page = fs.readFileSync(path.resolve(process.cwd(), "src", "pages", "Financeiro.tsx"), "utf8");
    expect(page).toContain("GRUPOS_NAVEGACAO"); // triggers renderizados dos grupos (fonte única)
    for (const mod of MODULOS_CRITICOS) {
      expect(page, `TabsContent ausente para ${mod}`).toContain(`TabsContent value="${mod}"`);
    }
  });

  it("3. responsividade preservada (navegação usa flex-wrap)", () => {
    const page = fs.readFileSync(path.resolve(process.cwd(), "src", "pages", "Financeiro.tsx"), "utf8");
    expect(page).toContain("flex-wrap");
  });
});

describe("F0-L — Conciliação (sem mock como real)", () => {
  it("4. tela de conciliação não exibe dados mock/hardcoded como reais", () => {
    const src = ler("ConciliacaoAvancada.tsx");
    for (const fake of ["TARIFA DE MANUTENCAO", "RECEB. PIX", "PAGTO TED", "baterMatrix", "handleForcarVinculo"]) {
      expect(src).not.toContain(fake);
    }
    expect(src.toLowerCase()).toContain("ainda não configurada");
    expect(src).toContain("contas_financeiras"); // entrada real de conta financeira
  });

  it("5. CNAB não apresenta funcionalidade fictícia", () => {
    const src = ler("PagamentoCNAB.tsx");
    for (const fake of ["fakeData", "CNAB240_ITAU", "João Transportes", "Auto Log Express", "processarRetorno"]) {
      expect(src).not.toContain(fake);
    }
    expect(src.toLowerCase()).toContain("ainda não configurada");
    expect(src).toContain("pagamentos_prestadores"); // fonte real de pré-visualização
  });

  it("6. nenhuma leitura de tabelas inexistentes (lancamentos_financeiros / saldos_financeiros)", () => {
    const arquivos = fs.readdirSync(financeiroDir).filter((f) => f.endsWith(".tsx"));
    for (const f of arquivos) {
      const src = fs.readFileSync(path.join(financeiroDir, f), "utf8");
      expect(src, `tabela inexistente em ${f}`).not.toMatch(/lancamentos_financeiros|saldos_financeiros/);
    }
  });

  it("7. Contas & Caixas continua funcionando (serviço intacto)", () => {
    const s = calcularSaldosConta(
      { id: "c1", nome: "Conta", saldo_inicial: 1000 },
      [{ titulo_tabela: "financeiro_receber", valor_baixado: 500, estornada: false, conta_financeira_id: "c1" }],
      [{ titulo_tabela: "financeiro_pagar", valor_baixado: 300, estornada: false, conta_financeira_id: "c1" }],
      [], []
    );
    expect(s.saldoReal).toBe(1200);
  });
});
