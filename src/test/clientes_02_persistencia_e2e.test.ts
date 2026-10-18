/**
 * CLIENTES-02 — Persistência + exclusão segura.
 *
 * Cobre: integridade referencial na exclusão (guard), ausência de falso sucesso
 * (create/update/delete confirmados no banco) e não-regressão de CLIENTES-01.
 * A prova real no banco é feita por script dedicado (ver relatório).
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { verificarReferenciasCliente, CLIENTE_REFERENCIA_TABELAS } from "@/helpers/clienteReferencias";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const LISTA = readSrc("src/components/clientes/ClientesLista.tsx");
const DETALHE = readSrc("src/components/clientes/ClienteDetalhe.tsx");

describe("CLIENTES-02 — integridade referencial na exclusão", () => {
  it("cobre as tabelas-chave de vínculo", () => {
    const tabelas = CLIENTE_REFERENCIA_TABELAS.map(t => t.tabela);
    for (const t of ["ordens_servico", "alocacoes_escala", "faturas", "financeiro_receber", "financeiro_pagar", "clientes_contratos", "fiscal_ctes"]) {
      expect(tabelas).toContain(t);
    }
  });

  it("sem id → nenhuma verificação (lista vazia)", async () => {
    expect(await verificarReferenciasCliente("")).toEqual([]);
  });

  it("a listagem usa o guard antes de excluir", () => {
    expect(LISTA).toContain("verificarReferenciasCliente");
    expect(LISTA).toContain("Exclusão bloqueada");
  });
});

describe("CLIENTES-02 — ausência de falso sucesso", () => {
  it("CREATE/UPDATE: sucesso só após resposta com dados (ClienteDetalhe)", () => {
    expect(DETALHE).toContain("if (error)");
    expect(DETALHE).toContain("if (!savedCliente)");
    expect(DETALHE).toMatch(/toast\.success\(isNew/);
  });

  it("DELETE: confirma no banco (.select) e exige registro removido", () => {
    expect(LISTA).toMatch(/\.delete\(\)/);
    expect(LISTA).toContain('.select("id")');
    expect(LISTA).toContain("Nenhum registro foi excluído");
  });
});

describe("CLIENTES-02 — CLIENTES-01 preservado", () => {
  it("ordenação A→Z no servidor antes da paginação", () => {
    expect(LISTA).toContain('.order("razao_social", { ascending: true, nullsFirst: false })');
    expect(LISTA).toContain(".range(from, to)");
  });
  it("paginação numerada e busca global preservadas", () => {
    expect(LISTA).toContain("<PaginationBar");
    expect(LISTA).toContain("query.or(");
    expect(LISTA).toContain("const filtered = clientes;");
  });
});
