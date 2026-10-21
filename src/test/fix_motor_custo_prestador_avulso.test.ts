import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// FIX-MOTOR-CUSTO-E-PRESTADOR-AVULSO
// 1) Motor de custo: faixas de PRAZO A/B (À vista até 24h / Faturado após 24h),
//    retorno +R$ 1,50/km (última parada → origem) somado ao total e visível.
// 2) UI /os-mobile: exatamente 2 chips de prazo, aviso quando o motor está
//    pausado (custo manual), badge ao vivo do retorno.
// 3) Prestador avulso: 4 campos obrigatórios (Telefone/WhatsApp, Origem,
//    Tipo de PIX, Chave PIX) com validação e persistência (metadata da OS +
//    financeiro_pagar.chave_pix/observacoes).
// 4) Toggle [Retirada|Entrega] persiste no JSON de endereços da OS.
// ============================================================================

import {
  calcularCustoMotoboy,
  OPCOES_PAGAMENTO_PRESTADOR,
  VALOR_KM_RETORNO,
} from "@/lib/custoMotoboy";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

// Base neutra: 2 paradas (grátis), sem peso, sem espera, sem retorno.
const base = { paradas: 2, peso: 0, esperaMin: 0, retorno: false } as const;

// ============================================================================
// A) Faixas de prazo — matemática exata da tabela
// ============================================================================
describe("A) Faixas de pagamento por prazo (A/B)", () => {
  it("A.1 — À vista (até 24h): 0–6 km = R$ 20 fixo", () => {
    expect(calcularCustoMotoboy({ ...base, km: 5, pagamento: "avista" }).total).toBeCloseTo(20, 2);
    expect(calcularCustoMotoboy({ ...base, km: 6, pagamento: "avista" }).total).toBeCloseTo(20, 2);
  });

  it("A.2 — À vista: 6,1–16 km = R$ 25 fixo", () => {
    expect(calcularCustoMotoboy({ ...base, km: 6.1, pagamento: "avista" }).total).toBeCloseTo(25, 2);
    expect(calcularCustoMotoboy({ ...base, km: 16, pagamento: "avista" }).total).toBeCloseTo(25, 2);
  });

  it("A.3 — À vista: 17+ km = R$ 1,50 por cada km", () => {
    const r = calcularCustoMotoboy({ ...base, km: 17, pagamento: "avista" });
    expect(r.total).toBeCloseTo(25.5, 2); // 1,50 × 17
    expect(r.itens[0].detalhe).toContain("R$ 1,50 × 17 km");
  });

  it("A.4 — Faturado (após 24h): 0–6 km = R$ 20 fixo", () => {
    expect(calcularCustoMotoboy({ ...base, km: 5, pagamento: "faturado" }).total).toBeCloseTo(20, 2);
    expect(calcularCustoMotoboy({ ...base, km: 6, pagamento: "faturado" }).total).toBeCloseTo(20, 2);
  });

  it("A.5 — Faturado: 6,1–12 km = R$ 25 fixo", () => {
    expect(calcularCustoMotoboy({ ...base, km: 6.1, pagamento: "faturado" }).total).toBeCloseTo(25, 2);
    expect(calcularCustoMotoboy({ ...base, km: 12, pagamento: "faturado" }).total).toBeCloseTo(25, 2);
  });

  it("A.6 — Faturado: 13+ km = R$ 2,00 por cada km", () => {
    const r = calcularCustoMotoboy({ ...base, km: 13, pagamento: "faturado" });
    expect(r.total).toBeCloseTo(26, 2); // 2,00 × 13
    expect(r.itens[0].detalhe).toContain("R$ 2,00 × 13 km");
  });

  it("A.7 — rótulos de UI: exatamente 2 opções, A primeiro, B segundo", () => {
    expect(OPCOES_PAGAMENTO_PRESTADOR).toHaveLength(2);
    expect(OPCOES_PAGAMENTO_PRESTADOR.map((o) => o.value)).toEqual(["avista", "faturado"]);
    expect(OPCOES_PAGAMENTO_PRESTADOR[0].label).toBe("À vista (até 24h)");
    expect(OPCOES_PAGAMENTO_PRESTADOR[1].label).toBe("Faturado (após 24h)");
    expect(OPCOES_PAGAMENTO_PRESTADOR.some((o) => o.value === "avista_mesmo_dia")).toBe(false);
  });

  it("A.8 — 'À vista mesmo dia' sai da UI mas permanece no motor (dados legados)", () => {
    const r = calcularCustoMotoboy({ ...base, km: 10, pagamento: "avista_mesmo_dia" });
    expect(r.total).toBeCloseTo(20, 2); // 2,00 × 10
  });
});

// ============================================================================
// B) Retorno — + R$ 1,50/km SOMADO ao total
// ============================================================================
describe("B) Retorno à origem (+R$ 1,50/km)", () => {
  it("B.1 — sem retorno = 0 no item retorno", () => {
    const r = calcularCustoMotoboy({ ...base, km: 10, pagamento: "avista" });
    const retorno = r.itens.find((i) => i.chave === "retorno");
    expect(retorno?.valor).toBe(0);
    expect(r.total).toBeCloseTo(25, 2); // faixa 6,1–16 = 25
  });

  it("B.2 — com retorno: +R$ 15,00 (1,50 × 10 km) SOMADO ao total", () => {
    const r = calcularCustoMotoboy({ ...base, km: 10, retorno: true, pagamento: "avista" });
    const retorno = r.itens.find((i) => i.chave === "retorno");
    expect(retorno?.valor).toBeCloseTo(15, 2);
    expect(retorno?.detalhe).toContain("R$ 1,50 × 10 km de retorno");
    expect(retorno?.detalhe).toContain("última parada → origem");
    expect(r.total).toBeCloseTo(40, 2); // 25 + 15
    expect(VALOR_KM_RETORNO).toBe(1.5);
  });

  it("B.3 — retorno sobre faixa Faturado (17 km): 34 + 25,5 = 59,5", () => {
    const r = calcularCustoMotoboy({ ...base, km: 17, retorno: true, pagamento: "faturado" });
    expect(r.total).toBeCloseTo(59.5, 2);
  });

  it("B.4 — kmRetorno explícito (última parada → origem) usa o km informado", () => {
    const r = calcularCustoMotoboy({
      ...base,
      km: 20,
      retorno: true,
      kmRetorno: 8,
      pagamento: "avista",
    });
    const retorno = r.itens.find((i) => i.chave === "retorno");
    expect(retorno?.valor).toBeCloseTo(12, 2); // 1,50 × 8
    expect(retorno?.detalhe).toContain("8 km de retorno");
    expect(r.total).toBeCloseTo(42, 2); // 20×1,5 (30) + 12
  });

  it("B.5 — kmRetorno ignorado quando retorno está desligado", () => {
    const r = calcularCustoMotoboy({
      ...base,
      km: 20,
      retorno: false,
      kmRetorno: 8,
      pagamento: "avista",
    });
    expect(r.itens.find((i) => i.chave === "retorno")?.valor).toBe(0);
    expect(r.total).toBeCloseTo(30, 2);
  });

  it("B.6 — retorno sem kmRetorno cai para o km total (comportamento legado)", () => {
    const r = calcularCustoMotoboy({
      ...base,
      km: 10,
      retorno: true,
      kmRetorno: 0,
      pagamento: "avista",
    });
    expect(r.itens.find((i) => i.chave === "retorno")?.valor).toBeCloseTo(15, 2);
  });
});

// ============================================================================
// C) /os-mobile — UI: chips, aviso de motor pausado, badge do retorno
// ============================================================================
describe("C) OsMobile — UI do motor", () => {
  const src = readSrc("src/pages/OsMobile.tsx");

  it("C.1 — chips de prazo em 2 colunas e vindos de OPCOES_PAGAMENTO_PRESTADOR", () => {
    expect(src).toContain("grid grid-cols-2 gap-2");
    expect(src).toContain("OPCOES_PAGAMENTO_PRESTADOR.map");
    expect(src).toContain("Tipo de pagamento do prestador (prazo) *");
  });

  it("C.2 — motor pausado (custo manual) exibe aviso âmbar explícito", () => {
    expect(src).toContain("Custo ajustado");
    expect(src).toContain("o motor está pausado");
    expect(src).toContain("Voltar ao automático");
  });

  it("C.3 — badge ao vivo do retorno (+R$ 1,50/km) no toggle", () => {
    expect(src).toContain("kmNumero * VALOR_KM_RETORNO");
    expect(src).toContain("km de retorno");
    expect(src).toContain("última parada → origem");
    expect(src).toContain("motor pausado (custo manual)");
  });

  it("C.4 — motor recebe retornoOrigem e o valor auto-preenche o custo", () => {
    expect(src).toContain("retorno: retornoOrigem");
    expect(src).toContain("setCustoPrestador(String(custoCalculado))");
  });
});

// ============================================================================
// D) Prestador avulso — cadastro (PIX opcional) e PIX obrigatório na baixa
// ============================================================================
describe("D) Prestador avulso — campos financeiros", () => {
  const src = readSrc("src/pages/OsMobile.tsx");

  it("D.1 — estados e inputs dos 4 campos existem", () => {
    for (const campo of ["avulsoTelefone", "avulsoOrigem", "avulsoPixTipo", "avulsoPixChave"]) {
      expect(src).toContain(`const [${campo}`);
      expect(src).toContain(`set${campo.charAt(0).toUpperCase()}${campo.slice(1)}`);
    }
    expect(src).toContain('type="tel"');
    expect(src).toContain("OPCOES_PIX_TIPO.map");
    expect(src).toContain("Telefone (WhatsApp) *");
    expect(src).toContain("Origem (local/ponto do motoboy) *");
    // PIX deixou de ser obrigatório na criação da OS.
    expect(src).toContain("Tipo de PIX");
    expect(src).toContain("Chave PIX");
    expect(src).not.toContain("Tipo de PIX *");
    expect(src).not.toContain("Chave PIX *");
    expect(src).toContain("O PIX é opcional na criação da OS");
  });

  it("D.2 — criação não exige PIX; baixa exige chave válida", () => {
    expect(src).toContain("validarTelefone(avulsoTelefone)");
    expect(src).toContain('erros.push("Informe a origem (local/ponto do motoboy)")');
    expect(src).not.toContain("validarPixChave(avulsoPixTipo, avulsoPixChave)");
    expect(src).toContain("validarPixChave(pixTipoBaixa, pixChaveBaixa)");
    expect(src).toContain('toast.error("Informe a chave PIX do repasse"');
    expect(src).toContain('"CPF/CNPJ"');
    expect(src).toContain('"Celular"');
    expect(src).toContain('"E-mail"');
    expect(src).toContain('"Chave Aleatória"');
  });

  it("D.3 — persistência: metadata da OS com telefone/origem/pix", () => {
    expect(src).toContain("telefone_whatsapp: avulsoTelefone.trim()");
    expect(src).toContain("origem: avulsoOrigem.trim()");
    expect(src).toContain("pix_tipo: avulsoPixTipo");
    expect(src).toContain("pix_chave: avulsoPixChave.trim()");
  });

  it("D.4 — persistência: financeiro_pagar recebe chave_pix e observacoes", () => {
    expect(src).toContain("chave_pix: avulsoPixChave.trim() || null");
    expect(src).toContain("Prestador avulso cadastrado via /os-mobile");
    expect(src).toContain("`WhatsApp: ${avulsoTelefone.trim()}`");
    expect(src).toContain("`Origem: ${avulsoOrigem.trim()}`");
    expect(src).toContain("PIX ${avulsoPixTipo}: ${avulsoPixChave.trim()}");
    expect(src).toContain("PIX a informar na baixa");
    // PIX confirmado na baixa é gravado de volta na conta a pagar.
    expect(src).toContain('chave_pix: chavePix');
  });

  it("D.5 — reset em limpar() limpa os 4 campos", () => {
    expect(src).toContain("setAvulsoTelefone(\"\")");
    expect(src).toContain("setAvulsoOrigem(\"\")");
    expect(src).toContain('setAvulsoPixTipo("CPF/CNPJ")');
    expect(src).toContain('setAvulsoPixChave("")');
  });
});

// ============================================================================
// E) Toggle [Retirada | Entrega] persiste no JSON de endereços da OS
// ============================================================================
describe("E) Toggle Retirada/Entrega persistência", () => {
  const src = readSrc("src/pages/OsMobile.tsx");

  it("E.1 — toggle alterna o estado da parada", () => {
    expect(src).toContain('atualizarParada(parada.id, { tipo: "retirada" })');
    expect(src).toContain('atualizarParada(parada.id, { tipo: "entrega" })');
  });

  it("E.2 — tipo persiste em metadata.enderecos (tipo + tipo_parada)", () => {
    expect(src).toContain('tipo: p.tipo === "retirada" ? "coleta" : "entrega"');
    expect(src).toContain("tipo_parada: p.tipo");
    expect(src).toContain("enderecos: enderecosMeta");
  });

  it("E.3 — enderecosMeta também gravado no jsonb ordens_servico.enderecos", () => {
    expect(src).toContain('update({ enderecos: enderecosMeta })');
  });
});

// ============================================================================
// F) Guardas de regressão (motor intacto para as demais regras)
// ============================================================================
describe("F) Regressão do motor", () => {
  it("F.1 — paradas: 3ª em diante +R$ 2,00", () => {
    const r = calcularCustoMotoboy({ km: 5, paradas: 3, peso: 0, esperaMin: 0, retorno: false, pagamento: "avista" });
    expect(r.total).toBeCloseTo(22, 2); // 20 + 2
  });

  it("F.2 — peso: +R$ 1,00/kg acima de 20 kg", () => {
    const r = calcularCustoMotoboy({ km: 5, paradas: 2, peso: 25, esperaMin: 0, retorno: false, pagamento: "avista" });
    expect(r.total).toBeCloseTo(25, 2); // 20 + 5
  });

  it("F.3 — espera: franquia 20 min, excedente R$ 0,40/min", () => {
    const r = calcularCustoMotoboy({ km: 5, paradas: 2, peso: 0, esperaMin: 30, retorno: false, pagamento: "avista" });
    expect(r.total).toBeCloseTo(24, 2); // 20 + 4
  });

  it("F.4 — combo: 17 km faturado + retorno + 4 paradas + 30 kg + espera 30 min = 77,50", () => {
    const r = calcularCustoMotoboy({
      km: 17,
      paradas: 4,
      peso: 30,
      esperaMin: 30,
      retorno: true,
      pagamento: "faturado",
    });
    expect(r.total).toBeCloseTo(77.5, 2);
  });
});
