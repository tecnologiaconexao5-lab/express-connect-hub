/**
 * ESCALA-E2E-08H — Remoção do campo legado `numero_pedido` da criação de OS.
 *
 * Causa raiz: criarOrdemServico enviava `numero_pedido` (inexistente em ordens_servico).
 * Cobre A–F via asserções de fonte + lógica canônica.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const ORDEM_SERVICO = readSrc("src/services/ordemServicoService.ts");
const ESCALA_SERVICE = readSrc("src/services/escala/escalaService.ts");
const ESCALA_LISTA = readSrc("src/components/operacao/EscalaLista.tsx");
const CONTRATO = readSrc("src/services/contratos/contratoOperacaoService.ts");
const CENTRAL = readSrc("src/services/financeiro/centralFinanceiroService.ts");

describe("ESCALA-E2E-08H — A: criarOrdemServico não envia numero_pedido", () => {
  it("nenhuma ocorrência de numero_pedido no serviço de OS", () => {
    expect(ORDEM_SERVICO).not.toMatch(/numero_pedido/);
  });
});

describe("ESCALA-E2E-08H — B: payload sem campo inválido", () => {
  it("payload de INSERT não referencia numero_pedido; usa apenas colunas do contrato", () => {
    const inicio = ORDEM_SERVICO.indexOf("export async function criarOrdemServico");
    const fim = ORDEM_SERVICO.indexOf(".insert([payload])", inicio);
    const bloco = ORDEM_SERVICO.slice(inicio, fim);
    expect(bloco.length).toBeGreaterThan(0);
    expect(bloco).not.toMatch(/numero_pedido/);
    // colunas do contrato real de ordens_servico (amostra canônica)
    for (const col of ["numero", "cliente_id", "cliente", "origem", "destino", "valor_cliente", "custo_prestador"]) {
      expect(new RegExp("\\b" + col + "\\s*[,:]").test(bloco)).toBe(true);
    }
  });
});

describe("ESCALA-E2E-08H — C: numeração interna da OS preservada", () => {
  it("numero = OS-{ano}{mes}-{seq} (interno Conexão)", () => {
    expect(ORDEM_SERVICO).toMatch(/const numero = `OS-\$\{ano\}\$\{mes\}-\$\{seq\}`;/);
  });
});

describe("ESCALA-E2E-08H — D: ausência de OS manual continua permitida", () => {
  it("escalaService cria OS quando ordem_servico_id ausente", () => {
    expect(ESCALA_SERVICE).toMatch(/if \(!dados\.ordem_servico_id\) \{/);
    expect(ESCALA_SERVICE).toMatch(/criarOrdemServico\(\{/);
  });
});

describe("ESCALA-E2E-08H — E: callers continuam compatíveis", () => {
  it("Contratos e Central Financeiro não passam numero_pedido", () => {
    expect(CONTRATO).not.toMatch(/numero_pedido/);
    expect(CENTRAL).not.toMatch(/numero_pedido/);
  });
});

describe("ESCALA-E2E-08H — F: fluxo de romaneio/OC preservado", () => {
  it("Escala persiste numeroOC (romaneio/OC do cliente) no metadata", () => {
    expect(ESCALA_LISTA).toMatch(/numeroOC,/);
    expect(ESCALA_LISTA).toMatch(/metadata:\s*\{[^}]*numeroOC/s);
  });

  it("criarOrdemServico NÃO mexe em romaneio (não mapeia numero_pedido)", () => {
    expect(ORDEM_SERVICO).not.toMatch(/romaneio/);
  });
});
