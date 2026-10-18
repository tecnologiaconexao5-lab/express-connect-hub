import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GRUPOS_NAVEGACAO } from "@/components/financeiro/financeiroNav";

afterEach(cleanup);

// ============================================================================
// F0-N — HOTFIX CRASH RovingFocusGroupItem fora do provider.
// Causa-raiz: F0-L renderizou TabsTrigger dentro de <div> (sem TabsList).
// Radix TabsTrigger exige TabsList (RovingFocusGroup) como ancestral.
// ============================================================================

describe("F0-N — Hotfix RovingFocusGroup no Financeiro", () => {
  it("1. a composição agrupada (Tabs + TabsList por grupo) monta SEM lançar 'RovingFocusGroupItem'", () => {
    // Reproduz EXATAMENTE a estrutura do Financeiro.tsx pós-correção.
    expect(() =>
      render(
        <Tabs defaultValue="dashboard">
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {GRUPOS_NAVEGACAO.map((grupo) => (
              <div key={grupo.grupo}>
                <span>{grupo.grupo}</span>
                <TabsList className="h-auto gap-1 rounded-md bg-transparent p-0">
                  {grupo.itens.map((item) => (
                    <TabsTrigger key={item.valor} value={item.valor}>
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            ))}
          </div>
          <TabsContent value="dashboard">conteudo dashboard</TabsContent>
          <TabsContent value="receber">conteudo receber</TabsContent>
        </Tabs>
      )
    ).not.toThrow();
    // todos os 20 triggers renderizam
    const total = GRUPOS_NAVEGACAO.flatMap((g) => g.itens).length;
    expect(screen.getAllByRole("tab")).toHaveLength(total);
  });

  it("2. alternância de aba mantém estado ativo (preserva navegação F0-L)", async () => {
    render(
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">DASH</TabsContent>
        <TabsContent value="receber">REC</TabsContent>
      </Tabs>
    );
    expect(screen.getByText("DASH")).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "Contas a Receber" });
    fireEvent.mouseDown(tab); // Radix ativa no onMouseDown
    expect(screen.getByText("REC")).toBeInTheDocument();
    expect(tab).toHaveAttribute("data-state", "active");
  });

  it("3. Financeiro.tsx NÃO possui TabsTrigger órfão (todo trigger está sob um TabsList)", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "src", "pages", "Financeiro.tsx"), "utf8");
    // A navegação é gerada por .map() → o arquivo tem 2 literais de TabsList
    // (nav agrupada + sub-tab Rentabilidade) e 2 literais de TabsTrigger (map + por-os).
    expect((src.match(/<TabsList\b/g) ?? []).length).toBe(2);
    expect((src.match(/<TabsTrigger\b/g) ?? []).length).toBe(2);
    // bloco da navegação agrupada: o TabsList do mapa vem ANTES do TabsTrigger (nenhum órfão)
    const navIdx = src.indexOf("GRUPOS_NAVEGACAO.map");
    const navBlock = src.slice(navIdx, src.indexOf('<TabsContent value="dashboard"'));
    const listInNav = navBlock.indexOf("<TabsList");
    const trigInNav = navBlock.indexOf("<TabsTrigger");
    expect(listInNav).toBeGreaterThan(-1);
    expect(trigInNav).toBeGreaterThan(listInNav);
    // sub-tab Rentabilidade: TabsList também precede seu trigger "por-os"
    const rentIdx = src.indexOf('TabsTrigger value="por-os"');
    const lastList = src.lastIndexOf("<TabsList");
    expect(lastList).toBeGreaterThan(-1);
    expect(rentIdx).toBeGreaterThan(lastList);
  });

  it("4. abas da página possuem TabsContent (12+ rotas homologadas F0-M)", () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), "src", "pages", "Financeiro.tsx"), "utf8");
    const rotas = ["dashboard", "conferencia", "faturas", "receber", "pagar", "pagamento-prestadores", "fluxo", "dre", "contas-caixas", "relatorios", "margem-os", "recibos"];
    for (const rota of rotas) {
      expect(src).toContain(`TabsContent value="${rota}"`);
    }
  });
});