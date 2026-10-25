import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

// ============================================================================
// UX MOBILE — 3 melhorias validadas pelo cliente:
// A) Modal "Alocar prestador" com altura máxima + rolagem interna + rodapé fixo
// B) Link do Google Maps enxuto (Rua, Número, Cidade) + encurtador TinyURL
// C) Aba Financeiro: status (pendentes x pagos) + período com default = hoje
// ============================================================================

const src = readSrc("src/pages/OsMobile.tsx");

describe("A) Modal Alocar prestador — responsivo (nunca corta os botões)", () => {
  it("A.1 — container limita a altura máxima a 85vh", () => {
    expect(src).toContain("max-h-[85vh]");
    expect(src).toContain('open={Boolean(osAlocando)}');
  });

  it("A.2 — área de conteúdo força rolagem interna", () => {
    expect(src).toContain("min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain");
  });

  it("A.3 — Cancelar/Alocar ficam num rodapé fora da área de rolagem", () => {
    const inicio = src.indexOf("open={Boolean(osAlocando)}");
    expect(inicio).toBeGreaterThan(-1);
    const fimDialogo = src.indexOf("</Dialog>", inicio);
    const dialogAlocar = src.slice(inicio, fimDialogo > inicio ? fimDialogo : inicio + 7500);
    expect(dialogAlocar).toContain("shrink-0 border-t border-slate-200 bg-white px-5 pt-3");
    expect(dialogAlocar).toContain('paddingBottom: "max(1rem, env(safe-area-inset-bottom))"');
    expect(dialogAlocar).toContain("Cancelar");
    expect(dialogAlocar).toContain('"Alocar"');
    // o rodapé vem DEPOIS da área de rolagem (fora dela) e abriga os botões
    const inicioRolagem = dialogAlocar.indexOf("min-h-0 flex-1");
    const rodape = dialogAlocar.indexOf("shrink-0 border-t border-slate-200");
    const cancelar = dialogAlocar.indexOf("Cancelar");
    expect(inicioRolagem).toBeGreaterThan(-1);
    expect(rodape).toBeGreaterThan(inicioRolagem);
    expect(cancelar).toBeGreaterThan(rodape);
  });

  it("A.4 — cabeçalho não colide com o botão X de fechar", () => {
    expect(src).toContain("px-5 pb-3 pr-10 pt-5");
  });
});

describe("B) Link do Maps enxuto + encurtador assíncrono", () => {
  it("B.1 — query montada apenas com Rua, Número e Cidade", () => {
    expect(src).toContain("const consultaMapsDoPonto = (ponto: Record<string, unknown>)");
    expect(src).toContain("`${ruaComNumero}, ${cidade}`");
    expect(src).toContain('const ruaComNumero = [logradouro, numero].filter(Boolean).join(", ")');
  });

  it("B.2 — fallback descarta CEP e UF do endereço formatado", () => {
    expect(src).toContain("/^\\d{5}-?\\d{3}$/");
    expect(src).toContain("pedaco !== uf");
    expect(src).not.toContain("consulta || formatarEnderecoCompletoPonto(ponto)");
  });

  it("B.3 — usa API gratuita do TinyURL sem autenticação e com timeout", () => {
    expect(src).toContain("https://tinyurl.com/api-create.php?url=");
    expect(src).toContain("setTimeout(() => controller.abort(), 6000)");
    expect(src).toContain("return null");
  });

  it("B.4 — textos de cópia passam pelo encurtador com toast 'Gerando link...'", () => {
    expect(src).toContain("const encurtarLinksDoMaps = async (texto: string)");
    expect(src).toContain('toast.loading("Gerando link..."');
    expect(src).toContain("await encurtarLinksDoMaps(gerarOrientacaoWhatsApp(osCriada))");
    expect(src).toContain("await encurtarLinksDoMaps(gerarOrientacaoWhatsApp(os))");
    expect(src).toContain("toast.dismiss(gerandoLink)");
  });

  it("B.5 — falha na API mantém o link longo original (não quebra a cópia)", () => {
    expect(src).toContain("(curto ? acc.split(link).join(curto) : acc)");
  });
});

describe("C) Financeiro — status e período", () => {
  it("C.1 — toggle Valores Pendentes / Valores Pagos", () => {
    expect(src).toContain('useState<StatusRepasseMobile>("pendentes")');
    expect(src).toContain('setStatusAba("pendentes")');
    expect(src).toContain('setStatusAba("pagos")');
    expect(src).toContain("Valores Pendentes");
    expect(src).toContain("Valores Pagos");
  });

  it("C.2 — período com default = hoje (início e fim)", () => {
    expect(src).toContain("const [periodoInicio, setPeriodoInicio] = useState<string>(hojeISO())");
    expect(src).toContain("const [periodoFim, setPeriodoFim] = useState<string>(hojeISO())");
    expect(src).toContain('type="date"');
    expect(src).toContain("setPeriodoInicio(e.target.value)");
    expect(src).toContain("setPeriodoFim(e.target.value)");
    expect(src).toContain('setPeriodoInicio(hojeISO())');
  });

  it("C.3 — query respeita o status selecionado", () => {
    expect(src).toContain('.in("status", ehPagos ? ["pago"] : ["pendente", "aberto", "parcial"])');
    expect(src).toContain('ascending: !ehPagos');
    expect(src).toContain('? "data_pagamento" : "vencimento"');
  });

  it("C.4 — filtro de período usa vencimento (pendentes) e data de baixa (pagos)", () => {
    expect(src).toContain("const data = ehPagos ? r.dataPagamento : r.vencimento;");
    expect(src).toContain("if (periodoInicio && data < periodoInicio) return false;");
    expect(src).toContain("if (periodoFim && data > periodoFim) return false;");
  });

  it("C.5 — KPIs, vazio e ações mudam conforme o status", () => {
    expect(src).toContain('"Total pago no período"');
    expect(src).toContain('"Pago hoje"');
    expect(src).toContain('"Nenhum repasse pago no período"');
    expect(src).toContain("? `Pago em: ${fmtData(repasse.dataPagamento)}`");
    expect(src).toContain("void baixar(repasse)");
  });
});
