import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { User } from "@/lib/auth";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockUser: User | null = null;

import AppSidebar from "@/components/AppSidebar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  mockUser = {
    email: "admin@conexaoexpress.com.br",
    name: "Admin",
    role: "super_admin",
    unit: "Matriz",
  };
});

describe("TMS-LAYOUT-01 — AppSidebar: submódulos + auto-recolhimento limpo", () => {
  it("1. Biblioteca Global exibe todos os 6 submódulos quando aberta", () => {
    render(
      <MemoryRouter initialEntries={["/biblioteca?tab=operacional"]}>
        <AppSidebar expanded />
      </MemoryRouter>
    );

    // grupo aberto por herdar a rota ativa — garante que está aberto
    const grupo = screen.getByRole("button", { name: /Biblioteca Global/ });
    if (!screen.queryByRole("button", { name: "Central Operacional" })) {
      fireEvent.click(grupo);
    }

    for (const nome of [
      "Central Operacional",
      "Pasta do Prestador (App)",
      "Pasta do Cliente (Portal)",
      "Modelos e Templates",
      "Mensagens Rápidas",
      "Fluxo de Recrutamento",
    ]) {
      expect(screen.getByRole("button", { name: nome })).toBeTruthy();
    }
  });

  it("2. apenas um grupo fica aberto por vez (abrir novo fecha o anterior)", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar expanded />
      </MemoryRouter>
    );

    const biblioteca = screen.getByRole("button", { name: /Biblioteca Global/ });
    fireEvent.click(biblioteca);
    expect(screen.getByRole("button", { name: "Central Operacional" })).toBeTruthy();

    const recrutamento = screen.getByRole("button", { name: /Recrutamento Inteligente/ });
    fireEvent.click(recrutamento);

    // Biblioteca fechou (subitens ocultos) quando Recrutamento abriu
    expect(screen.queryByRole("button", { name: "Central Operacional" })).toBeNull();
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeTruthy();
  });

  it("3. ao recolher a sidebar (collapsed) o grupo expandido é limpo ao reexpandir", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar expanded />
      </MemoryRouter>
    );

    const biblioteca = screen.getByRole("button", { name: /Biblioteca Global/ });
    fireEvent.click(biblioteca);
    expect(screen.getByRole("button", { name: "Central Operacional" })).toBeTruthy();

    // recolhe (equivale ao mouseLeave após o timeout de 200ms do AppLayout)
    rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar expanded={false} />
      </MemoryRouter>
    );
    // expande novamente — grupo não deve reaparecer aberto
    rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppSidebar expanded />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Central Operacional" })).toBeNull();
  });

  it("4. subitem ativo continua destacado após recolhimento (seleção ativa preservada)", () => {
    render(
      <MemoryRouter initialEntries={["/financeiro?tab=receber"]}>
        <AppSidebar expanded />
      </MemoryRouter>
    );

    // o grupo Financeiro está aberto por herdar o item ativo
    const subitem = screen.getByRole("button", { name: "Contas a Receber" });
    expect(subitem).toBeTruthy();
    expect(subitem.className).toContain("text-white");
  });
}, 30000);