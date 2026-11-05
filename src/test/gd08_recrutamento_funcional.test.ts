import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { calcularFrescorCadastro } from "@/utils/frescorCadastro";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const IA = readSrc("src/modules/recrutamento/components/ia/IAOperacional.tsx");
const OFERTAS = readSrc("src/modules/recrutamento/components/ofertas/OfertasPublicas.tsx");
const INDEX = readSrc("src/modules/recrutamento/index.tsx");

const diasAtras = (dias: number) =>
  new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

describe("GD-08 — indicador de frescor do cadastro", () => {
  it("menos de 30 dias = Lead Quente", () => {
    const frescor = calcularFrescorCadastro(diasAtras(10));
    expect(frescor.status).toBe("quente");
    expect(frescor.label).toBe("Lead Quente");
    expect(frescor.dias).toBe(10);
  });

  it("entre 30 e 90 dias = Recente", () => {
    const frescor = calcularFrescorCadastro(diasAtras(45));
    expect(frescor.status).toBe("recente");
    expect(frescor.label).toBe("Recente");
  });

  it("acima de 90 dias = Cadastro Antigo - Verificar Disponibilidade", () => {
    const frescor = calcularFrescorCadastro(diasAtras(120));
    expect(frescor.status).toBe("antigo");
    expect(frescor.label).toContain("Cadastro Antigo");
    expect(frescor.label).toContain("Verificar Disponibilidade");
  });

  it("data ausente ou inválida não quebra", () => {
    expect(calcularFrescorCadastro(null).status).toBe("desconhecido");
    expect(calcularFrescorCadastro("data-invalida").status).toBe("desconhecido");
  });
});

describe("GD-08 — amarração da IA Operacional", () => {
  it("seletor de operação aparece antes do ranking", () => {
    const posSeletor = IA.indexOf("Match Operacional");
    const posRanking = IA.indexOf("Motor de Recomendação Unificado");
    expect(posSeletor).toBeGreaterThan(-1);
    expect(posRanking).toBeGreaterThan(posSeletor);
    expect(IA).toContain("Selecione uma operação...");
  });

  it("ranking reage à operação e cruza as três fontes", () => {
    expect(IA).toContain("rankingComMatch");
    expect(IA).toContain("matchPerfilOperacao");
    expect(IA).toContain("Banco de Talentos:");
    expect(IA).toContain("Prestadores:");
    expect(IA).toContain("Ofertas Públicas:");
    expect(IA).toContain("listarPreCadastros");
  });

  it("lista de recomendação exibe idade do cadastro", () => {
    expect(IA).toContain("calcularFrescorCadastro");
    expect(IA).toContain("frescor.label");
  });

  it("Ofertas Públicas exibe idade do cadastro", () => {
    expect(OFERTAS).toContain("calcularFrescorCadastro");
    expect(OFERTAS).toContain("frescor.label");
  });
});

describe("GD-08 — estabilidade do módulo de Recrutamento", () => {
  it("envolve as secções em ErrorBoundary e Suspense", () => {
    expect(INDEX).toContain("ErrorBoundary");
    expect(INDEX).toContain("Suspense");
    expect(INDEX).toContain("SecaoRecrutamentoErro");
    expect(INDEX).toContain("SecaoRecrutamentoLoading");
    expect(INDEX).toContain("key={currentSection}");
  });
});
