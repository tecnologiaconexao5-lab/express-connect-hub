/**
 * E2E-COMPLETO-05 — PDFs da OS (Cliente × Prestador) + Form Exit Guard.
 *
 * Verifica:
 *  - separação real dos PDFs por destinatário;
 *  - ausência de vazamento financeiro cruzado;
 *  - ausência de página inicial em branco (capa = página 1);
 *  - comportamento do hook de guard (dirty + confirmação de saída).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderHook, act } from "@testing-library/react";
import { useFormExitGuard } from "@/hooks/useFormExitGuard";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const CLIENT = readSrc("src/lib/pdf/clientReport.ts");
const PROVIDER = readSrc("src/lib/pdf/prestadorReport.ts");
const GENERATOR = readSrc("src/lib/pdfGenerator.ts");

describe("E2E-COMPLETO-05 — PDFs separados por destinatário", () => {
  it("generatePDFCliente → clientReport; generatePDFPrestador → prestadorReport", () => {
    expect(GENERATOR).toMatch(/generatePDFCliente[\s\S]*generateClientReport/);
    expect(GENERATOR).toMatch(/generatePDFPrestador[\s\S]*generatePrestadorReport/);
  });

  it("clientReport gera via Cliente e prestadorReport gera via Prestador", () => {
    expect(CLIENT).toMatch(/via:\s*"Cliente"/);
    expect(PROVIDER).toMatch(/via:\s*"Prestador"/);
  });
});

describe("E2E-COMPLETO-05 — sem vazamento financeiro", () => {
  it("PDF Cliente NÃO contém custo/repasse/margem do prestador", () => {
    expect(CLIENT).not.toMatch(/custoPrestador|valorPrestador/);
    expect(CLIENT).not.toMatch(/margem/i);
    expect(CLIENT).not.toMatch(/repasse/i);
  });

  it("PDF Cliente contém apenas valores do cliente", () => {
    expect(CLIENT).toMatch(/data\.valorCliente/);
    expect(CLIENT).toMatch(/Valor da Operação/);
  });

  it("PDF Prestador NÃO contém receita/margem do cliente", () => {
    expect(PROVIDER).not.toMatch(/valorCliente/);
    expect(PROVIDER).not.toMatch(/margem/i);
    expect(PROVIDER).not.toMatch(/receita/i);
  });

  it("PDF Prestador contém o fechamento/repasse do prestador", () => {
    expect(PROVIDER).toMatch(/data\.custoPrestador/);
    expect(PROVIDER).toMatch(/FECHAMENTO FINANCEIRO DO PRESTADOR/);
  });
});

describe("E2E-COMPLETO-05 — sem página inicial em branco", () => {
  const assertCoverFirst = (src: string) => {
    const coverIdx = src.indexOf("drawCoverPage(");
    const firstAddPage = src.indexOf("doc.addPage()");
    expect(coverIdx).toBeGreaterThan(-1);
    expect(firstAddPage).toBeGreaterThan(-1);
    // A capa (drawCoverPage) acontece ANTES do primeiro addPage → capa é a página 1.
    expect(coverIdx).toBeLessThan(firstAddPage);
  };

  it("clientReport: capa desenhada antes do primeiro addPage", () => assertCoverFirst(CLIENT));
  it("prestadorReport: capa desenhada antes do primeiro addPage", () => assertCoverFirst(PROVIDER));
});

describe("E2E-COMPLETO-05 — guards aplicados aos formulários", () => {
  const forms: Array<[string, string]> = [
    ["ClienteDetalhe", "src/components/clientes/ClienteDetalhe.tsx"],
    ["OrcamentoForm", "src/components/comercial/OrcamentoForm.tsx"],
    ["TabelaValoresForm", "src/components/comercial/TabelaValoresForm.tsx"],
    ["ContasReceber", "src/components/financeiro/ContasReceber.tsx"],
    ["ContasPagar", "src/components/financeiro/ContasPagar.tsx"],
  ];

  it.each(forms)("%s usa useFormExitGuard + confirmação de saída", (_nome, rel) => {
    const src = readSrc(rel);
    expect(src).toMatch(/useFormExitGuard/);
    expect(src).toMatch(/confirmExit\(\)/);
  });
});

describe("E2E-COMPLETO-05 — useFormExitGuard (comportamento)", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não fica dirty quando current == initial", async () => {
    const { result } = renderHook(() =>
      useFormExitGuard({ current: { a: 1 }, initial: { a: 1 } })
    );
    expect(result.current.isDirty).toBe(false);
    await expect(result.current.confirmExit()).resolves.toBe(true);
  });

  it("fica dirty quando current muda; confirmExit consulta confirmação", async () => {
    const { result, rerender } = renderHook(
      ({ current }) => useFormExitGuard({ current, initial: { a: 1 } }),
      { initialProps: { current: { a: 1 } } }
    );
    expect(result.current.isDirty).toBe(false);

    rerender({ current: { a: 2 } });
    expect(result.current.isDirty).toBe(true);

    const confirmSpy = window.confirm as unknown as ReturnType<typeof vi.fn>;
    await act(async () => {
      await result.current.confirmExit();
    });
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("markClean redefine o baseline (após salvar)", () => {
    const { result, rerender } = renderHook(
      ({ current }) => useFormExitGuard({ current, initial: { a: 1 } }),
      { initialProps: { current: { a: 1 } } }
    );
    rerender({ current: { a: 3 } });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.markClean();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("enabled=false desativa a proteção", () => {
    const { result } = renderHook(() =>
      useFormExitGuard({ current: { a: 2 }, initial: { a: 1 }, enabled: false })
    );
    expect(result.current.isDirty).toBe(false);
  });
});
