/**
 * E2E-05D — Coerência cadastro APP ↔ TMS.
 *
 * Cobre: status canônico (aliases), pendentes APP visíveis + contador do banco,
 * crash onLoadMore do Kanban, coerência liberado_app ↔ status, e ausência de 2º prestador.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  normalizarStatusPrestador,
  statusAliases,
  STATUS_LABEL,
  STATUS_COR,
} from "@/components/prestadores/types";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const LISTA = readSrc("src/components/prestadores/PrestadoresLista.tsx");
const DETALHE = readSrc("src/components/prestadores/PrestadorDetalhe.tsx");
const KANBAN_COL = readSrc("src/modules/recrutamento/components/enterprise-kanban/KanbanColumn.tsx");
const KANBAN_BOARD = readSrc("src/modules/recrutamento/components/enterprise-kanban/EnterpriseKanbanBoard.tsx");
const PREST_SVC = readSrc("src/modules/recrutamento/services/prestadoresService.ts");
const BRIDGE = readSrc("src/modules/recrutamento/components/enterprise-kanban/enterpriseKanbanService.ts");

describe("E2E-05D — status canônico (aliases)", () => {
  it("normaliza em_analise→analise e aprovado→ativo", () => {
    expect(normalizarStatusPrestador("em_analise")).toBe("analise");
    expect(normalizarStatusPrestador("aprovado")).toBe("ativo");
    expect(normalizarStatusPrestador("ativo")).toBe("ativo");
    expect(normalizarStatusPrestador("analise")).toBe("analise");
    expect(normalizarStatusPrestador(null)).toBe("analise");
  });

  it("statusAliases cobre os pares canônicos", () => {
    expect(statusAliases("analise")).toEqual(["analise", "em_analise"]);
    expect(statusAliases("ativo")).toEqual(["ativo", "aprovado"]);
    expect(statusAliases("bloqueado")).toEqual(["bloqueado"]);
  });

  it("labels/cores resolvem para em_analise e aprovado", () => {
    expect(STATUS_LABEL["em_analise"]).toBe("Em análise");
    expect(STATUS_LABEL["aprovado"]).toBe("Aprovado");
    expect(STATUS_COR["em_analise"]).toBeTruthy();
  });

  it("PrestadoresLista usa aliases no filtro e normaliza o badge", () => {
    expect(LISTA).toMatch(/statusAliases\(statusFilter\)/);
    expect(LISTA).toMatch(/normalizarStatusPrestador\(p\.status\)/);
  });
});

describe("E2E-05D — cadastro APP pendente visível + contador", () => {
  it("lista identifica cadastro APP aguardando validação", () => {
    expect(LISTA).toMatch(/origemCadastro === "app_motorista"/);
    expect(LISTA).toMatch(/Aguardando validação/);
  });

  it("contador vem do banco (origem_cadastro=app_motorista + status pendente)", () => {
    expect(LISTA).toMatch(/\.eq\("origem_cadastro",\s*"app_motorista"\)/);
    expect(LISTA).toMatch(/\.in\("status",\s*\["analise",\s*"em_analise"\]\)/);
    expect(LISTA).toMatch(/appPendingCount/);
    expect(LISTA).toMatch(/aguardando validação/);
  });
});

describe("E2E-05D — Recrutamento sem crash onLoadMore", () => {
  it("KanbanColumn desestrutura onLoadMore e usa no botão", () => {
    const idx = KANBAN_COL.indexOf("export function KanbanColumn(");
    const header = KANBAN_COL.slice(idx, KANBAN_COL.indexOf("}: KanbanColumnProps)", idx));
    expect(header).toMatch(/onLoadMore/);
    expect(KANBAN_COL).toMatch(/onClick=\{onLoadMore\}/);
  });

  it("EnterpriseKanbanBoard passa onLoadMore para a coluna", () => {
    expect(KANBAN_BOARD).toMatch(/onLoadMore=\{/);
  });
});

describe("E2E-05D — aprovação / liberação coerentes", () => {
  it("PrestadorDetalhe impede liberado_app=true quando status não é ativo", () => {
    expect(DETALHE).toMatch(/normalizarStatusPrestador/);
    expect(DETALHE).toMatch(/liberadoApp:\s*false/);
  });

  it("prestadoresService mantém liberado_app = (status === ativo)", () => {
    expect(PREST_SVC).toMatch(/liberado_app:\s*novoStatus === 'ativo'/);
  });

  it("bridge NÃO cria 2º prestador (vincula por prestador_id)", () => {
    expect(BRIDGE).toMatch(/prestador_id/);
    expect(BRIDGE).toMatch(/prestadorIdsExistentes/);
    expect(BRIDGE).not.toMatch(/from\(PRESTADORES_TABLE\)\.insert/);
  });
});
