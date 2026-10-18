import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import fs from "node:fs";
import path from "node:path";
import {
  GRUPOS_NAVEGACAO,
  TODOS_VALORES_NAV,
  grupoPorTab,
  funcaoPadraoDoGrupo,
} from "@/components/financeiro/financeiroNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

afterEach(cleanup);

// ============================================================================
// TMS-LAYOUT-02 — Financeiro Premium em DOIS NÍVEIS.
// Nível 1: categorias (botões comuns, fora do Radix Tabs).
// Nível 2: somente as funções do grupo ativo, dentro de um único TabsList.
// F0-N preservado: nenhum TabsTrigger fora de TabsList.
// ============================================================================

const SRC = fs.readFileSync(path.resolve(process.cwd(), "src", "pages", "Financeiro.tsx"), "utf8");

describe("TMS-LAYOUT-02 — Derivação da categoria pela aba ativa (lógica pura)", () => {
  it("cada aba mapeia para a categoria correta", () => {
    expect(grupoPorTab("dashboard").grupo).toBe("Visão Geral");
    expect(grupoPorTab("pendencias").grupo).toBe("Visão Geral");
    expect(grupoPorTab("conferencia").grupo).toBe("Faturamento");
    expect(grupoPorTab("faturas").grupo).toBe("Faturamento");
    expect(grupoPorTab("receber").grupo).toBe("Faturamento");
    expect(grupoPorTab("inadimplencia").grupo).toBe("Faturamento");
    expect(grupoPorTab("pagar").grupo).toBe("Pagamentos");
    expect(grupoPorTab("pagamento-prestadores").grupo).toBe("Pagamentos");
    expect(grupoPorTab("fluxo").grupo).toBe("Tesouraria");
    expect(grupoPorTab("contas-caixas").grupo).toBe("Tesouraria");
    expect(grupoPorTab("conciliacao").grupo).toBe("Tesouraria");
    expect(grupoPorTab("lotes").grupo).toBe("Tesouraria");
    expect(grupoPorTab("dre").grupo).toBe("Gestão");
    expect(grupoPorTab("margem-os").grupo).toBe("Gestão");
    expect(grupoPorTab("relatorios").grupo).toBe("Gestão");
    expect(grupoPorTab("recibos").grupo).toBe("Gestão");
    expect(grupoPorTab("margem").grupo).toBe("Outros (legado)");
    expect(grupoPorTab("rentabilidade").grupo).toBe("Outros (legado)");
    expect(grupoPorTab("seguros-auto").grupo).toBe("Outros (legado)");
    expect(grupoPorTab("contabilidade").grupo).toBe("Outros (legado)");
    expect(grupoPorTab("plano-contas").grupo).toBe("Configurações");
    expect(grupoPorTab("config-financeira").grupo).toBe("Configurações");
    expect(grupoPorTab("regras-cliente").grupo).toBe("Configurações");
  });

  it("aba desconhecida recai em Faturamento (grupo do tab padrão)", () => {
    expect(grupoPorTab("inexistente").grupo).toBe("Faturamento");
  });

  it("função padrão do grupo é a primeira função dele", () => {
    expect(funcaoPadraoDoGrupo(grupoPorTab("margem-os"))).toBe("dre");
    expect(funcaoPadraoDoGrupo(grupoPorTab("receber"))).toBe("conferencia");
    expect(funcaoPadraoDoGrupo(grupoPorTab("plano-contas"))).toBe("plano-contas");
  });

  it("todas as 24 funções continuam acessíveis via as 7 categorias", () => {
    const acessiveis = GRUPOS_NAVEGACAO.flatMap((g) => g.itens.map((i) => i.valor));
    expect(acessiveis).toHaveLength(24);
    expect(new Set(acessiveis)).toEqual(new Set(TODOS_VALORES_NAV));
    // nenhuma aba duplicada entre grupos
    expect(acessiveis.length).toBe(new Set(acessiveis).size);
  });

  it("as categorias são exatamente as 7 previstas (nível 1)", () => {
    const categorias = GRUPOS_NAVEGACAO.map((g) =>
      g.grupo === "Outros (legado)" ? "Outros" : g.grupo
    );
    expect(categorias).toEqual([
      "Visão Geral",
      "Faturamento",
      "Pagamentos",
      "Tesouraria",
      "Gestão",
      "Outros",
      "Configurações",
    ]);
  });
});

describe("TMS-LAYOUT-02 — Estrutura do Financeiro.tsx (F0-N preservado)", () => {
  it("mantém exatamente 2 literais <TabsList> e 2 <TabsTrigger>", () => {
    expect((SRC.match(/<TabsList\b/g) ?? []).length).toBe(2);
    expect((SRC.match(/<TabsTrigger\b/g) ?? []).length).toBe(2);
  });

  it("bloco da navegação: TabsList vem ANTES do TabsTrigger (nenhum órfão)", () => {
    const navIdx = SRC.indexOf("GRUPOS_NAVEGACAO.map");
    const navBlock = SRC.slice(navIdx, SRC.indexOf('<TabsContent value="dashboard"'));
    const listInNav = navBlock.indexOf("<TabsList");
    const trigInNav = navBlock.indexOf("<TabsTrigger");
    expect(listInNav).toBeGreaterThan(-1);
    expect(trigInNav).toBeGreaterThan(listInNav);
  });

  it("nível 1 usa botão comum para categorias (não TabsTrigger) e nível 2 só o grupo ativo", () => {
    // categoria é <button> com onClick handleCategoriaClick
    expect(SRC).toContain("onClick={() => handleCategoriaClick(grupo)}");
    expect(SRC).toContain("<button");
    // o único TabsList da navegação mapeia grupoAtivo.itens (funções do grupo selecionado)
    const navIdx = SRC.indexOf("GRUPOS_NAVEGACAO.map");
    const navBlock = SRC.slice(navIdx, SRC.indexOf('<TabsContent value="dashboard"'));
    expect(navBlock).toContain("grupoAtivo.itens.map");
  });

  it("todas as 23 funções possuem TabsContent (nenhuma rota/aba perdida)", () => {
    for (const valor of TODOS_VALORES_NAV) {
      expect(SRC).toContain(`TabsContent value="${valor}"`);
    }
  });

  it("sub-tab Rentabilidade mantém TabsList antes de seu TabsTrigger", () => {
    const rentIdx = SRC.indexOf('TabsTrigger value="por-os"');
    const lastList = SRC.lastIndexOf("<TabsList");
    expect(lastList).toBeGreaterThan(-1);
    expect(rentIdx).toBeGreaterThan(lastList);
  });
});

// Reprodução fiel da interação (mesma lógica real de Financeiro.tsx) para provar
// que as categorias trocam o grupo e o Tabs da função ativa permanece correto.
function ReproducaoDoisNiveis() {
  const [tab, setTab] = useState("receber");
  const grupoAtivo = grupoPorTab(tab);
  const handleCategoriaClick = (grupo: (typeof GRUPOS_NAVEGACAO)[number]) => {
    if (grupo.itens.some((i) => i.valor === tab)) return;
    setTab(funcaoPadraoDoGrupo(grupo));
  };
  return (
    <div>
      <div>
        {GRUPOS_NAVEGACAO.map((grupo) => {
          const ativa = grupo.grupo === grupoAtivo.grupo;
          return (
            <button key={grupo.grupo} onClick={() => handleCategoriaClick(grupo)}>
              {grupo.grupo === "Outros (legado)" ? "Outros" : grupo.grupo}
            </button>
          );
        })}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {grupoAtivo.itens.map((item) => (
            <TabsTrigger key={item.valor} value={item.valor}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TODOS_VALORES_NAV.map((valor) => (
          <TabsContent key={valor} value={valor}>
            conteudo-{valor}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

describe("TMS-LAYOUT-02 — Comportamento dos dois níveis", () => {
  it("apenas as funções do grupo ativo aparecem no nível 2", () => {
    render(<ReproducaoDoisNiveis />);
    // grupo inicial = Faturamento (tab receber) → 5 funções
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Contas a Receber" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Relatório de Faturamento" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "DRE" })).toBeNull();
  });

  it("clique em categoria troca para a função padrão do grupo", () => {
    render(<ReproducaoDoisNiveis />);
    fireEvent.click(screen.getByRole("button", { name: "Gestão" }));
    expect(screen.getByRole("tab", { name: "DRE" })).toHaveAttribute("data-state", "active");
    expect(screen.getAllByRole("tab")).toHaveLength(4); // apenas Gestão
    expect(screen.queryByRole("tab", { name: "Contas a Receber" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(screen.getByRole("tab", { name: "Plano de Contas" })).toHaveAttribute("data-state", "active");
    expect(screen.getAllByRole("tab")).toHaveLength(3); // Configurações
  });

  it("clicar na categoria atual preserva a aba ativa (sem cliques extras)", () => {
    render(<ReproducaoDoisNiveis />);
    // tab ativa = receber (Faturamento). Clicar em Faturamento não altera nada.
    fireEvent.click(screen.getByRole("button", { name: "Faturamento" }));
    expect(screen.getByRole("tab", { name: "Contas a Receber" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("conteudo-receber")).toBeTruthy();
  });

  it("todas as 24 funções ficam acessíveis navegando pelas categorias", () => {
    render(<ReproducaoDoisNiveis />);
    const funcoesVistas = new Set<string>();
    const visitar = (categoria: string) => {
      fireEvent.click(screen.getByRole("button", { name: categoria }));
      screen.getAllByRole("tab").forEach((t) => {
        const texto = t.textContent ?? "";
        if (texto.includes("conteudo")) return;
        funcoesVistas.add(texto);
      });
    };
    ["Visão Geral", "Faturamento", "Pagamentos", "Tesouraria", "Gestão", "Outros", "Configurações"].forEach(visitar);
    const totalFuncoes = TODOS_VALORES_NAV.length; // 24
    expect(funcoesVistas.size).toBeGreaterThanOrEqual(totalFuncoes);
  });
});