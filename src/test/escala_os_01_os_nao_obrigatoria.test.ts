/**
 * ESCALA-OS-01 — OS interna NÃO é mais obrigatória na Escala.
 *
 * Ao salvar uma alocação sem OS selecionada, criarAlocacao() gera/vincula
 * automaticamente a OS interna (uma única OS por alocação). O Romaneio/OC do
 * cliente permanece referência EXTERNA (metadata), separado da OS interna.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const ESCALA = read("src/components/operacao/EscalaLista.tsx");
const SERVICE = read("src/services/escala/escalaService.ts");

describe("ESCALA-OS-01 — obrigatoriedade removida", () => {
  it("EscalaLista não bloqueia mais salvar sem OS", () => {
    expect(ESCALA).not.toContain("Selecione uma Ordem de Serviço antes de salvar a alocação.");
  });

  it("payload normaliza OS vazia para null", () => {
    expect(ESCALA).toContain("ordem_servico_id: novaOSId || null");
  });

  it("Romaneio/OC do cliente permanece referência externa (metadata)", () => {
    expect(ESCALA).toContain("numeroOC");
    expect(ESCALA).toContain("metadata");
  });
});

describe("ESCALA-OS-01 — auto-OS canônica no service", () => {
  it("criarAlocacao gera/vincula a OS quando não informada", () => {
    expect(SERVICE).toContain("Auto-associate or create Ordem de Serviço");
    expect(SERVICE).toContain("criarOrdemServico");
    expect(SERVICE).toMatch(/if \(!dados\.ordem_servico_id\)/);
  });

  it("cria a OS ANTES de inserir a alocação (uma única OS)", () => {
    const idxAuto = SERVICE.indexOf("Auto-associate or create");
    const idxInsert = SERVICE.indexOf(".from('alocacoes_escala')", idxAuto);
    expect(idxAuto).toBeGreaterThan(-1);
    expect(idxInsert).toBeGreaterThan(idxAuto);
  });
});
