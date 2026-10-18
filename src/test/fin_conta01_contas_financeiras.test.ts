import { describe, it, expect } from "vitest";
import { salvarContasBancariasConfig, isUuidValido, type ContaBancariaFinanceira } from "@/services/financeiro/configFinanceiraService";

function conta(over: Partial<ContaBancariaFinanceira> = {}): ContaBancariaFinanceira {
  return {
    id: "c-1790283538967", nome: "Conta Teste", banco: "Cora", codigoBanco: "", agencia: "0001",
    conta: "123", digito: "4", pix: "pix@teste", titular: "Fulano", titularCnpj: "000",
    tipo: "corrente", ativa: true, principal: false, ...over,
  };
}

function makeClient() {
  const updates: any[] = [];
  const inserts: any[] = [];
  const from = () => ({
    update: (payload: any) => {
      const rec: any = { payload, eqs: [], neqs: [] };
      const api: any = {
        eq: (c: string, v: any) => { rec.eqs.push([c, v]); return api; },
        neq: (c: string, v: any) => { rec.neqs.push([c, v]); return api; },
        then: (res: any) => { updates.push(rec); res({ error: null }); },
      };
      return api;
    },
    insert: (payload: any) => { inserts.push(payload); return { then: (res: any) => res({ error: null }) }; },
  });
  return { client: { from } as any, updates, inserts };
}

const hasTempId = (rows: any[]) => rows.some((r) => typeof r.id === "string" && r.id.startsWith("c-"));

describe("TMS-FIN-CONTA-01 — Contas Financeiras persistencia", () => {
  it("A/B/J) conta nova com id temporario 'c-...' -> INSERT sem id (nunca envia c-...)", async () => {
    const { client, inserts } = makeClient();
    const res = await salvarContasBancariasConfig([conta({ id: "c-1790283538967" })], client);
    expect(res.success).toBe(true);
    expect(inserts.length).toBe(1);
    expect(inserts[0].length).toBe(1);
    expect("id" in inserts[0][0]).toBe(false);
    expect(hasTempId(inserts[0])).toBe(false);
  });

  it("D/E) conta existente (UUID real) -> UPDATE pela PK, sem INSERT (nao duplica)", async () => {
    const { client, inserts, updates } = makeClient();
    const id = "9741ad36-1a2b-4c3d-8e4f-000000000001";
    const res = await salvarContasBancariasConfig([conta({ id })], client);
    expect(res.success).toBe(true);
    expect(inserts.length).toBe(0);
    expect(updates.some((u) => u.eqs.some(([c, v]: any) => c === "id" && v === id))).toBe(true);
  });

  it("F) duas contas novas -> INSERT com 2 linhas, sem IDs", async () => {
    const { client, inserts } = makeClient();
    await salvarContasBancariasConfig([conta({ id: "c-1" }), conta({ id: "c-2", nome: "Conta 2" })], client);
    expect(inserts[0].length).toBe(2);
    expect(hasTempId(inserts[0])).toBe(false);
  });

  it("G) payload nao contem id (tenant/seguranca definidos pelo banco)", async () => {
    const { client, inserts } = makeClient();
    await salvarContasBancariasConfig([conta({ id: "c-3" })], client);
    expect(Object.keys(inserts[0][0])).not.toContain("id");
  });

  it("principal: mais de uma principal -> erro claro (regra unica existente)", async () => {
    const { client } = makeClient();
    const res = await salvarContasBancariasConfig([conta({ id: "c-1", principal: true }), conta({ id: "c-2", principal: true })], client);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/principal/i);
  });

  it("principal: uma principal -> libera a vaga (unset nas demais) antes de gravar", async () => {
    const { client, updates } = makeClient();
    await salvarContasBancariasConfig([conta({ id: "c-9", principal: true })], client);
    const unset = updates.find((u) => u.payload?.principal === false && u.eqs.some(([c, v]: any) => c === "principal" && v === true));
    expect(!!unset).toBe(true);
    // exclusao da propria nova principal (ainda sem uuid) via dummy uuid
    expect(unset.neqs.some(([c]: any) => c === "id")).toBe(true);
  });

  it("isUuidValido distingue UUID de id temporario", () => {
    expect(isUuidValido("9741ad36-1a2b-4c3d-8e4f-000000000001")).toBe(true);
    expect(isUuidValido("c-1790283538967")).toBe(false);
    expect(isUuidValido("")).toBe(false);
    expect(isUuidValido(null)).toBe(false);
  });
});
