import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "u@x" } } })) },
  },
}));

import { supabase } from "@/lib/supabase";
import {
  criarRecebivel,
  criarRecebiveisEmLote,
  gerarChaveIdempotencia,
} from "@/services/financeiro/receberService";

const SERVICE_SRC = fs.readFileSync(
  path.resolve(process.cwd(), "src/services/financeiro/receberService.ts"),
  "utf8"
);
const UI_SRC = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/financeiro/ContasReceberEnterprise.tsx"),
  "utf8"
);

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

const payloadBase = {
  cliente_id: "3d2d079d-708b-4d4d-9c0b-1ed9b894e37e",
  cliente_nome: "CLIENTE TESTE",
  valor_bruto: 1000,
  valor_liquido: 1000,
  data_vencimento: "2026-12-01",
  status: "pendente",
};

describe("TMS-FIN-SEC-02-A6 — Nova Receita via RPC oficial (zero DML direto)", () => {
  beforeEach(() => rpc.mockReset());

  it("G/A) ZERO INSERT direto em financeiro_receber no service", () => {
    expect(/from\("financeiro_receber"\)\s*\.insert\(/.test(SERVICE_SRC)).toBe(false);
  });

  it("G/A) UI não possui INSERT direto em financeiro_receber", () => {
    expect(/from\("financeiro_receber"\)\s*\.(insert|update|delete)\(/.test(UI_SRC)).toBe(false);
  });

  it("B) criarRecebivel chama SOMENTE a RPC oficial (nunca from().insert)", async () => {
    rpc.mockResolvedValueOnce({ data: [{ recebivel_id: "rid-1", criado: true }], error: null });
    const res = await criarRecebivel(payloadBase);
    expect(rpc).toHaveBeenCalledWith(
      "f_criar_recebivel_manual",
      expect.objectContaining({
        p_payload: expect.objectContaining({ cliente_id: payloadBase.cliente_id, valor: 1000 }),
        p_idempotency_key: expect.any(String),
      })
    );
    expect(res.recebivel_id).toBe("rid-1");
    expect(res.criado).toBe(true);
  });

  it("C/D) idempotência: chave informada é repassada integralmente (retry)", async () => {
    rpc.mockResolvedValue({ data: [{ recebivel_id: "rid-x", criado: false }], error: null });
    const r1 = await criarRecebivel({ ...payloadBase, idempotency_key: "A6-KEY-FIXA" });
    const r2 = await criarRecebivel({ ...payloadBase, idempotency_key: "A6-KEY-FIXA" });
    const calls = rpc.mock.calls.filter((c: unknown[]) => c[0] === "f_criar_recebivel_manual");
    expect(calls.length).toBe(2);
    expect(calls[0][1].p_idempotency_key).toBe("A6-KEY-FIXA");
    expect(calls[1][1].p_idempotency_key).toBe("A6-KEY-FIXA");
    expect(r1.criado).toBe(false);
    expect(r2.criado).toBe(false);
  });

  it("H) fail-safe: RPC sem ID não retorna falso sucesso", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(criarRecebivel(payloadBase)).rejects.toThrow(/não retornou ID|nao retornou ID/);
  });

  it("H) fail-safe: erro da RPC é propagado (sem falso sucesso)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "SEM_PERMISSAO_FINANCEIRO" } });
    await expect(criarRecebivel(payloadBase)).rejects.toThrow(/SEM_PERMISSAO_FINANCEIRO/);
  });

  it("E) validações locais continuam (cliente/vencimento/valor)", async () => {
    await expect(criarRecebivel({ ...payloadBase, cliente_id: undefined, cliente: undefined } as never)).rejects.toThrow(/Cliente/);
    await expect(criarRecebivel({ ...payloadBase, data_vencimento: "" } as never)).rejects.toThrow(/Vencimento/);
    await expect(criarRecebivel({ ...payloadBase, valor_bruto: -5, valor_liquido: -5 })).rejects.toThrow();
  });

  it("F) parcelamento em lote: N chamadas RPC com chaves de lote distintas", async () => {
    rpc.mockResolvedValue({ data: [{ recebivel_id: "rid", criado: true }], error: null });
    const n = await criarRecebiveisEmLote([
      { ...payloadBase, parcela_atual: 1 },
      { ...payloadBase, parcela_atual: 2 },
      { ...payloadBase, parcela_atual: 3 },
    ]);
    const calls = rpc.mock.calls.filter((c: unknown[]) => c[0] === "f_criar_recebivel_manual");
    expect(calls.length).toBe(3);
    expect(n).toBe(3);
    const keys = calls.map((c: unknown[]) => (c[1] as { p_idempotency_key: string }).p_idempotency_key);
    expect(new Set(keys).size).toBe(3);
    keys.forEach((k) => expect(/^lote-/.test(k)).toBe(true));
  });

  it("F) UI passa idempotency_key no fluxo único e por parcela do lote", () => {
    expect(UI_SRC.includes("idempotency_key: novaReceitaKeyRef.current")).toBe(true);
    expect(UI_SRC.includes("${novaReceitaKeyRef.current}-p${i + 1}")).toBe(true);
    expect(UI_SRC.includes("gerarChaveIdempotencia")).toBe(true);
  });

  it("A) helper de chave gera valores únicos", () => {
    const a = gerarChaveIdempotencia("nr");
    const b = gerarChaveIdempotencia("nr");
    expect(a).not.toBe(b);
    expect(/^nr-/.test(a)).toBe(true);
  });

  it("A/L) migration A6 existe com SECURITY DEFINER, search_path e grants restritos", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20260924000020_fin_sec02_a6_criar_recebivel_manual.sql"),
      "utf8"
    );
    expect(sql.includes("SECURITY DEFINER")).toBe(true);
    expect(sql.includes("SET search_path = public, pg_temp")).toBe(true);
    expect(sql.includes("auth.uid()")).toBe(true);
    expect(sql.includes("uq_fr_idempotency_key")).toBe(true);
    expect(/REVOKE ALL ON FUNCTION[\s\S]*FROM anon/.test(sql)).toBe(true);
  });
});
