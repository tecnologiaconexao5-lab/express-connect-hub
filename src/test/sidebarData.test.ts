import { describe, it, expect } from "vitest";
import { sidebarItems, getVisibleSidebarItems } from "@/lib/sidebarData";
import type { User, UserRole } from "@/lib/auth";
import { GRUPOS_NAVEGACAO, TODOS_VALORES_NAV } from "@/components/financeiro/financeiroNav";

describe("sidebarItems — Missão 136-A.2", () => {
  it("1 — Clientes aparece exatamente uma vez no menu", () => {
    const occurrences: string[] = [];
    for (const item of sidebarItems) {
      for (const child of item.children || []) {
        if (child.title === "Clientes") {
          occurrences.push(item.title);
        }
      }
    }
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toBe("Cadastros Base");
  });

  it("2 — Clientes está dentro de Cadastros Base", () => {
    const cadastros = sidebarItems.find(i => i.title === "Cadastros Base");
    expect(cadastros).toBeDefined();
    const clientes = cadastros!.children?.find(c => c.title === "Clientes");
    expect(clientes).toBeDefined();
    expect(clientes!.path).toBe("/cadastros/clientes");
    expect(clientes!.modulo).toBe("clientes");
  });

  it("3 — Clientes NÃO está dentro de Gestão Comercial", () => {
    const comercial = sidebarItems.find(i => i.title === "Gestão Comercial");
    expect(comercial).toBeDefined();
    const clientes = comercial!.children?.find(c => c.title === "Clientes");
    expect(clientes).toBeUndefined();
  });

  it("4 — Rota de Clientes é /cadastros/clientes", () => {
    const cadastros = sidebarItems.find(i => i.title === "Cadastros Base");
    const clientes = cadastros!.children!.find(c => c.title === "Clientes")!;
    expect(clientes.path).toBe("/cadastros/clientes");
  });

  it("5 — Gestão Comercial mantém Tabela de Valores e Orçamentos", () => {
    const comercial = sidebarItems.find(i => i.title === "Gestão Comercial");
    const titles = comercial!.children!.map(c => c.title);
    expect(titles).toContain("Tabela de Valores");
    expect(titles).toContain("Orçamentos");
    expect(titles).not.toContain("Clientes");
  });
});

describe("getVisibleSidebarItems — Missão 136-A.2", () => {
  const baseUser: User = {
    email: "admin@test.com",
    name: "Admin",
    role: "super_admin",
    unit: "Matriz",
  };

  const makeUser = (role: UserRole): User => ({ ...baseUser, role });

  it("6 — admin autorizado visualiza Clientes", () => {
    const visible = getVisibleSidebarItems(makeUser("super_admin"));
    const cadastros = visible.find(i => i.title === "Cadastros Base");
    expect(cadastros).toBeDefined();
    const clientes = cadastros!.children?.find(c => c.title === "Clientes");
    expect(clientes).toBeDefined();
  });

  it("7 — comercial autorizado visualiza Clientes", () => {
    const visible = getVisibleSidebarItems(makeUser("comercial"));
    const cadastros = visible.find(i => i.title === "Cadastros Base");
    expect(cadastros).toBeDefined();
    const clientes = cadastros!.children?.find(c => c.title === "Clientes");
    expect(clientes).toBeDefined();
  });

  it("8 — financeiro autorizado visualiza Clientes", () => {
    const visible = getVisibleSidebarItems(makeUser("financeiro"));
    const cadastros = visible.find(i => i.title === "Cadastros Base");
    expect(cadastros).toBeDefined();
    const clientes = cadastros!.children?.find(c => c.title === "Clientes");
    expect(clientes).toBeDefined();
  });

  it("9 — cliente NÃO visualiza Clientes", () => {
    const visible = getVisibleSidebarItems(makeUser("cliente"));
    const cadastros = visible.find(i => i.title === "Cadastros Base");
    if (cadastros) {
      const clientes = cadastros.children?.find(c => c.title === "Clientes");
      expect(clientes).toBeUndefined();
    }
  });

  it("10 — prestador NÃO visualiza Clientes", () => {
    const visible = getVisibleSidebarItems(makeUser("prestador"));
    const cadastros = visible.find(i => i.title === "Cadastros Base");
    if (cadastros) {
      const clientes = cadastros.children?.find(c => c.title === "Clientes");
      expect(clientes).toBeUndefined();
    }
  });

  it("11 — motorista NÃO visualiza Clientes", () => {
    const visible = getVisibleSidebarItems(makeUser("motorista"));
    const cadastros = visible.find(i => i.title === "Cadastros Base");
    if (cadastros) {
      const clientes = cadastros.children?.find(c => c.title === "Clientes");
      expect(clientes).toBeUndefined();
    }
  });

  it("12 — Gestão Comercial não aparece para cliente", () => {
    const visible = getVisibleSidebarItems(makeUser("cliente"));
    const comercial = visible.find(i => i.title === "Gestão Comercial");
    expect(comercial).toBeUndefined();
  });
});

describe("TMS-LAYOUT-01 — Submódulos completos na sidebar", () => {
  const filhosDe = (titulo: string) => sidebarItems.find(i => i.title === titulo)?.children ?? [];

  it("Biblioteca Global expõe todos os 6 submódulos existentes na página", () => {
    const filhos = filhosDe("Biblioteca Global");
    const titulos = filhos.map(f => f.title);
    expect(titulos).toEqual([
      "Central Operacional",
      "Pasta do Prestador (App)",
      "Pasta do Cliente (Portal)",
      "Modelos e Templates",
      "Mensagens Rápidas",
      "Fluxo de Recrutamento",
    ]);
    expect(filhos).toHaveLength(6);
    // todos apontam para a rota da página com tab real (mecanismo existente)
    for (const f of filhos) {
      expect(f.path).toMatch(/^\/biblioteca\?tab=/);
    }
  });

  it("Gestão Financeira representa todos os módulos da navegação agrupada (F0-L)", () => {
    const filhos = filhosDe("Gestão Financeira");
    const valores = TODOS_VALORES_NAV;
    // cada valor real da página possui um subitem correspondente na sidebar
    for (const valor of valores) {
      expect(
        filhos.some(f => f.path === `/financeiro?tab=${valor}`),
        `subitem ausente para o módulo real do Financeiro: ${valor}`
      ).toBe(true);
    }
  });

  it("Cadastros Base inclui Regiões e Tabelas Auxiliares (submódulos existentes na página)", () => {
    const titulos = filhosDe("Cadastros Base").map(f => f.title);
    expect(titulos).toContain("Regiões");
    expect(titulos).toContain("Tabelas Auxiliares");
    expect(titulos).toContain("Veículos");
  });

  it("Apoio Operacional inclui Solicitações Cliente e não possui subitem inexistente (Programação)", () => {
    const filhos = filhosDe("Apoio Operacional");
    const titulos = filhos.map(f => f.title);
    expect(titulos).toContain("Solicitações Cliente");
    expect(filhos.some(f => f.path.includes("tab=programacao"))).toBe(false);
  });

  it("Recrutamento inclui Pipeline Enterprise e Prestadores Aptos (seções reais)", () => {
    const filhos = filhosDe("Recrutamento Inteligente");
    const paths = filhos.map(f => f.path);
    expect(paths).toContain("/recrutamento?section=pipeline-kanban");
    expect(paths).toContain("/recrutamento?section=operacionais");
  });

  it("Relatórios Operacionais representa apenas as 4 abas reais da página", () => {
    const filhos = filhosDe("Relatórios Operacionais");
    expect(filhos.map(f => f.path).sort()).toEqual([
      "/relatorios?tab=extrato",
      "/relatorios?tab=faturamento",
      "/relatorios?tab=margem",
      "/relatorios?tab=prestadores",
    ]);
  });

  it("Contratos usa as abas reais (modelos/gerados/configuracoes) — sem anexos/configs fantasma", () => {
    const filhos = filhosDe("Contratos Automáticos");
    const paths = filhos.map(f => f.path);
    expect(paths).toContain("/contratos?tab=modelos");
    expect(paths).toContain("/contratos?tab=gerados");
    expect(paths).toContain("/contratos?tab=configuracoes");
    expect(paths.some(p => p.includes("tab=anexos") || p.includes("tab=configs"))).toBe(false);
  });

  it("Nenhum subitem aponta para abas inexistentes conhecidas", () => {
    const abasFantasma = ["tab=programacao", "tab=volume", "tab=exportador", "tab=fechamento", "tab=xmls", "tab=anexos", "tab=configs"];
    for (const item of sidebarItems) {
      for (const child of item.children ?? []) {
        for (const fantasma of abasFantasma) {
          expect(child.path.includes(fantasma), `${item.title} → ${child.path}`).toBe(false);
        }
      }
    }
  });

  it("Nenhuma rota foi removida do menu — todos os paths únicos pré-existentes permanecem", () => {
    const paths = new Set<string>();
    for (const item of sidebarItems) {
      paths.add(item.path);
      for (const child of item.children ?? []) paths.add(child.path);
    }
    for (const p of [
      "/dashboard", "/torre-controle", "/comercial", "/cadastros", "/cadastros/clientes",
      "/cadastros/prestadores", "/operacao", "/frota", "/financeiro", "/fiscal", "/contratos",
      "/recrutamento", "/central-ia", "/biblioteca", "/sla", "/seguros", "/relatorios",
      "/central-comunicacao", "/portal-cliente", "/app-prestador", "/governanca", "/monitor-api",
      "/configuracoes", "/comprovantes", "/controle-patio",
    ]) {
      expect(paths.has(p), `rota ausente: ${p}`).toBe(true);
    }
  });
});
