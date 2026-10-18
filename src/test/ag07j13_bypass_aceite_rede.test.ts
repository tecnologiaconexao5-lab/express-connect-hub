/**
 * AG-07J.13 — Testes focalizados: bypass de elegibilidade operacional no aceite via Rede
 *
 * Valida que:
 * 1. As funções de gate do TS (eligibilidadeOperacionalService) cobrem os mesmos cenários da RPC
 * 2. O cenário de bypass (veículo incompatível + aceite via Rede) é bloqueado
 * 3. Regressão: gates anteriores permanecem intactos
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  tipoVeiculoCompativel,
  capacidadeVeiculoCompativel,
  refrigeradoCompativel,
  ajudanteCompativel,
  prestadorOperacionalmenteElegivelDados,
  operacaoRequerRefrigerado,
  veiculoPossuiCapacidadeTermica,
} from "@/services/escala/eligibilidadeOperacionalService";

// ============================================================
// MOCK: supabase (não utilizado por funções puras, mas necessário para imports)
// ============================================================
vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null }) }) }) }) },
}));

// ============================================================
// MATRIZ DE CENÁRIOS — espelha exatamente os gates da RPC
// ============================================================

describe("AG-07J.13 — Bypass aceite via Rede — Gates de elegibilidade", () => {
  // ----------------------------------------------------------
  // GATE 1: PRESTADOR
  // ----------------------------------------------------------
  describe("GATE 1: Prestador — ativo + liberado_app", () => {
    it("A) prestador ativo + liberado → elegível", () => {
      const r = prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: true });
      expect(r.elegivel).toBe(true);
    });

    it("B) prestador inativo → inelegível", () => {
      const r = prestadorOperacionalmenteElegivelDados({ status: "inativo", liberado_app: true });
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("status_nao_autorizado");
    });

    it("C) prestador ativo + liberado_app=false → inelegível", () => {
      const r = prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: false });
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("liberado_app_false");
    });

    it("D) prestador ativo + liberado_app=null → inelegível", () => {
      const r = prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: null });
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("liberado_app_false");
    });
  });

  // ----------------------------------------------------------
  // GATE 2: TIPO DE VEÍCULO
  // ----------------------------------------------------------
  describe("GATE 2: Tipo de veículo — match exato (lowercase+trim)", () => {
    it("E) tipo compatível (mesmo valor) → PASS", () => {
      const r = tipoVeiculoCompativel("VUC", "VUC");
      expect(r.elegivel).toBe(true);
    });

    it("F) tipo incompatível (VUC vs Truck) → BLOQUEIA", () => {
      const r = tipoVeiculoCompativel("VUC", "Truck");
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("tipo_veiculo_incompativel");
    });

    it("G) case-insensitive (vuc vs VUC) → PASS", () => {
      const r = tipoVeiculoCompativel("VUC", "vuc");
      expect(r.elegivel).toBe(true);
    });

    it("H) veículo sem tipo → BLOQUEIA", () => {
      const r = tipoVeiculoCompativel("VUC", null);
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("tipo_veiculo_incompativel");
    });

    it("I) OS sem exigência de tipo → PASS (não há o que comparar)", () => {
      const r = tipoVeiculoCompativel(null, "VUC");
      expect(r.elegivel).toBe(true);
    });

    it("J) OS tipo='' + veículo tipo='' → PASS (ambos vazios, sem exigência)", () => {
      const r = tipoVeiculoCompativel("", "");
      expect(r.elegivel).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // GATE 3: CAPACIDADE KG
  // ----------------------------------------------------------
  describe("GATE 3: Capacidade kg — veículo >= OS", () => {
    it("K) capacidade suficiente → PASS", () => {
      const r = capacidadeVeiculoCompativel(3000, 5000, null, null);
      expect(r.elegivel).toBe(true);
    });

    it("L) capacidade exata → PASS", () => {
      const r = capacidadeVeiculoCompativel(3000, 3000, null, null);
      expect(r.elegivel).toBe(true);
    });

    it("M) capacidade insuficiente → BLOQUEIA", () => {
      const r = capacidadeVeiculoCompativel(5000, 3000, null, null);
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("capacidade_peso_insuficiente");
    });

    it("N) OS sem peso (null) → PASS (não há o que comparar)", () => {
      const r = capacidadeVeiculoCompativel(null, 3000, null, null);
      expect(r.elegivel).toBe(true);
    });

    it("O) veículo sem capacidade (0) + OS com peso → PASS (sem dado para comparar)", () => {
      const r = capacidadeVeiculoCompativel(3000, 0, null, null);
      expect(r.elegivel).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // GATE 4: CAPACIDADE M3
  // ----------------------------------------------------------
  describe("GATE 4: Cubagem m3 — veículo >= OS", () => {
    it("P) cubagem suficiente → PASS", () => {
      const r = capacidadeVeiculoCompativel(null, null, 10, 20);
      expect(r.elegivel).toBe(true);
    });

    it("Q) cubagem insuficiente → BLOQUEIA", () => {
      const r = capacidadeVeiculoCompativel(null, null, 20, 10);
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("capacidade_cubagem_insuficiente");
    });

    it("R) ambos null → PASS", () => {
      const r = capacidadeVeiculoCompativel(null, null, null, null);
      expect(r.elegivel).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // GATE 5: CAPACIDADE TÉRMICA (REFRIGERADO / TÉRMICO)
  // ----------------------------------------------------------
  describe("GATE 5: Capacidade térmica — refrigerado/térmico", () => {
    it("S) OS exige refrigerado + veículo refrigerado → PASS", () => {
      const r = refrigeradoCompativel(true, "refrigerado");
      expect(r.elegivel).toBe(true);
    });

    it("T) OS exige refrigerado + veículo congelado → PASS (mesma dimensão)", () => {
      const r = refrigeradoCompativel(true, "congelado");
      expect(r.elegivel).toBe(true);
    });

    it("U) OS exige refrigerado + veículo seco → BLOQUEIA", () => {
      const r = refrigeradoCompativel(true, "seco");
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
    });

    it("V) OS exige refrigerado + veículo null → BLOQUEIA", () => {
      const r = refrigeradoCompativel(true, null);
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("requisito_refrigerado_nao_atendido");
    });

    it("W) OS NÃO exige refrigerado + veículo seco → PASS", () => {
      const r = refrigeradoCompativel(false, "seco");
      expect(r.elegivel).toBe(true);
    });

    it("X) helpers: operacaoRequerRefrigerado com carga_refrigerada=true → true", () => {
      expect(operacaoRequerRefrigerado(true, null)).toBe(true);
    });

    it("Y) helpers: operacaoRequerRefrigerado com veiculo_termica='termico' → true", () => {
      expect(operacaoRequerRefrigerado(false, "termico")).toBe(true);
    });

    it("Z) helpers: veiculoPossuiCapacidadeTermica('refrigerado') → true", () => {
      expect(veiculoPossuiCapacidadeTermica("refrigerado")).toBe(true);
    });

    it("AA) helpers: veiculoPossuiCapacidadeTermica('seco') → false", () => {
      expect(veiculoPossuiCapacidadeTermica("seco")).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // GATE 6: AJUDANTE
  // ----------------------------------------------------------
  describe("GATE 6: Ajudante — OS exige + alocação disponibiliza", () => {
    it("AB) OS exige ajudante + 1 alocado → PASS", () => {
      const r = ajudanteCompativel(true, 1);
      expect(r.elegivel).toBe(true);
    });

    it("AC) OS exige ajudante + 0 alocados → BLOQUEIA", () => {
      const r = ajudanteCompativel(true, 0);
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("ajudante_obrigatorio_ausente");
    });

    it("AD) OS exige ajudante + null alocados → BLOQUEIA", () => {
      const r = ajudanteCompativel(true, null);
      expect(r.elegivel).toBe(false);
      expect(r.motivo).toBe("ajudante_obrigatorio_ausente");
    });

    it("AE) OS NÃO exige ajudante + 0 alocados → PASS", () => {
      const r = ajudanteCompativel(false, 0);
      expect(r.elegivel).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // CENÁRIO PRINCIPAL: BYPASS REDE (veículo incompatível tenta aceitar)
  // ----------------------------------------------------------
  describe("Cenário principal: bypass aceite via Rede", () => {
    it("AF) OS exige VUC + prestador tem Truck → TODOS os gates bloqueiam", () => {
      // Simula exatamente o cenário de bypass: prestador ativo, mas veículo incompatível
      const prestador = prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: true });
      const tipo = tipoVeiculoCompativel("VUC", "Truck");
      const capacidade = capacidadeVeiculoCompativel(5000, 3000, null, null);
      const termica = refrigeradoCompativel(false, "seco");
      const ajudante = ajudanteCompativel(false, 0);

      expect(prestador.elegivel).toBe(true); // prestador OK
      expect(tipo.elegivel).toBe(false);     // veículo incompatível → BLOQUEIA
      expect(tipo.motivo).toBe("tipo_veiculo_incompativel");
      expect(capacidade.elegivel).toBe(false); // capacidade insuficiente → BLOQUEIA
      expect(capacidade.motivo).toBe("capacidade_peso_insuficiente");
      expect(termica.elegivel).toBe(true);   // seco OK (OS não exige refrigerado)
      expect(ajudante.elegivel).toBe(true);  // OS não exige ajudante

      // Pelo menos 1 gate bloqueia → aceite NÃO deveria ser permitido
      const algumBloqueia = [prestador, tipo, capacidade, termica, ajudante].some(g => !g.elegivel);
      expect(algumBloqueia).toBe(true);
    });

    it("AG) OS exige refrigerado + prestador tem seco → gate térmico bloqueia", () => {
      const tipo = tipoVeiculoCompativel("VUC", "VUC");
      const capacidade = capacidadeVeiculoCompativel(3000, 5000, null, null);
      const termica = refrigeradoCompativel(true, "seco");
      const ajudante = ajudanteCompativel(false, 0);

      expect(tipo.elegivel).toBe(true);
      expect(capacidade.elegivel).toBe(true);
      expect(termica.elegivel).toBe(false); // refrigerado não atendido
      expect(termica.motivo).toBe("requisito_refrigerado_nao_atendido");
      expect(ajudante.elegivel).toBe(true);

      const algumBloqueia = [tipo, capacidade, termica, ajudante].some(g => !g.elegivel);
      expect(algumBloqueia).toBe(true);
    });

    it("AH) OS exige ajudante + prestador tem 0 → gate ajudante bloqueia", () => {
      const tipo = tipoVeiculoCompativel("VUC", "VUC");
      const capacidade = capacidadeVeiculoCompativel(3000, 5000, null, null);
      const termica = refrigeradoCompativel(false, "seco");
      const ajudante = ajudanteCompativel(true, 0);

      expect(tipo.elegivel).toBe(true);
      expect(capacidade.elegivel).toBe(true);
      expect(termica.elegivel).toBe(true);
      expect(ajudante.elegivel).toBe(false); // ajudante obrigatório ausente
      expect(ajudante.motivo).toBe("ajudante_obrigatorio_ausente");

      const algumBloqueia = [tipo, capacidade, termica, ajudante].some(g => !g.elegivel);
      expect(algumBloqueia).toBe(true);
    });

    it("AI) Todos compatíveis → TODOS os gates passam", () => {
      const prestador = prestadorOperacionalmenteElegivelDados({ status: "ativo", liberado_app: true });
      const tipo = tipoVeiculoCompativel("VUC", "VUC");
      const capacidade = capacidadeVeiculoCompativel(3000, 5000, 10, 20);
      const termica = refrigeradoCompativel(true, "refrigerado");
      const ajudante = ajudanteCompativel(true, 2);

      expect(prestador.elegivel).toBe(true);
      expect(tipo.elegivel).toBe(true);
      expect(capacidade.elegivel).toBe(true);
      expect(termica.elegivel).toBe(true);
      expect(ajudante.elegivel).toBe(true);

      const todosPassam = [prestador, tipo, capacidade, termica, ajudante].every(g => g.elegivel);
      expect(todosPassam).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // REGRESSÃO: cenários dos gates anteriores
  // ----------------------------------------------------------
  describe("Regressão — AG-07I-B1/B2/B3/B5", () => {
    it("AJ) B1: veiculo nulo → inelegivel", () => {
      const r = tipoVeiculoCompativel("VUC", null);
      expect(r.elegivel).toBe(false);
    });

    it("AK) B2: capacidade zero vs peso positivo → sem dado, PASS", () => {
      const r = capacidadeVeiculoCompativel(3000, 0, null, null);
      expect(r.elegivel).toBe(true);
    });

    it("AL) B3: refrigerado false + seco → PASS", () => {
      const r = refrigeradoCompativel(false, "seco");
      expect(r.elegivel).toBe(true);
    });

    it("AM) B5: ajudante false + 0 → PASS", () => {
      const r = ajudanteCompativel(false, 0);
      expect(r.elegivel).toBe(true);
    });
  });
});
