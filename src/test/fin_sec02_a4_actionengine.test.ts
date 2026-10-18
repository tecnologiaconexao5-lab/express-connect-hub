import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(process.cwd(), "src/services/ia/actionEngineService.ts"),
  "utf8"
);

describe("TMS-FIN-SEC-02-A4 — actionEngineService financeiro_receber (sem DML direto)", () => {
  it("A/E) ZERO INSERT/UPDATE/DELETE direto em financeiro_receber", () => {
    expect(/from\("financeiro_receber"\)\s*\.(insert|update|delete)\(/.test(SRC)).toBe(false);
  });

  it("C) COM_REGISTRAR_PAGAMENTO nao cria titulo (fail-safe BLOQUEADA)", () => {
    const idx = SRC.indexOf('case "COM_REGISTRAR_PAGAMENTO"');
    expect(idx).toBeGreaterThan(0);
    const bloco = SRC.slice(idx, idx + 900);
    expect(bloco.includes('status: "BLOQUEADA"')).toBe(true);
    expect(bloco.includes("SEM_RPC_OFICIAL")).toBe(true);
    // nao deve conter o INSERT antigo
    expect(bloco.includes('.insert(')).toBe(false);
    expect(bloco.includes('status: "pago"')).toBe(false);
  });

  it("D) SELECT de consulta permanece permitido", () => {
    expect(/from\("financeiro_receber"\)\s*\.select\(/.test(SRC)).toBe(true);
  });

  it("F) caminho retorna motivo (sem throw / sem falso sucesso)", () => {
    const idx = SRC.indexOf('case "COM_REGISTRAR_PAGAMENTO"');
    const bloco = SRC.slice(idx, idx + 900);
    expect(bloco.includes("motivo:")).toBe(true);
    expect(bloco.includes("registros: 0")).toBe(true);
    expect(bloco.includes('acao: "pagamento_bloqueado"')).toBe(true);
  });

  it("G) log de bloqueio registrado (auditoria)", () => {
    const idx = SRC.indexOf('case "COM_REGISTRAR_PAGAMENTO"');
    const bloco = SRC.slice(idx, idx + 900);
    expect(bloco.includes("acao_real_pagamento_bloqueado")).toBe(true);
  });

  it("I) nao usa service_role", () => {
    expect(SRC.includes("service_role")).toBe(false);
  });
});
