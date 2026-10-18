// ═══════════════════════════════════════════════════════════════════════════════
// TMS-FAT-URG-07 — Cancelamento oficial de fatura (verificação estrutural)
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const SQL_FWD = "supabase/migrations/20260925000006_fin_fat_urg_07_cancelamento_fatura_oficial.sql";
const SQL_ROLLBACK = "supabase/migrations/20260925000007_fin_fat_urg_07_rollback.sql";

describe("TMS-FAT-URG-07 — guard de itens autoriza somente cancelamento oficial", () => {
  const sql = read(SQL_FWD);
  it("guard é SECURITY INVOKER e autoriza ativo->cancelado por postgres/service_role", () => {
    const iGuard = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_bloqueio_emissao()");
    const iCancel = sql.indexOf("CREATE OR REPLACE FUNCTION public.f_cancelar_fatura(");
    const trecho = sql.slice(iGuard, iCancel);
    expect(trecho).not.toMatch(/LANGUAGE plpgsql\s+SECURITY DEFINER/i); // guard é INVOKER
    expect(trecho).toMatch(/NEW\.status = 'cancelado'/);
    expect(trecho).toMatch(/OLD\.status = 'ativo'/);
    expect(trecho).toMatch(/current_user IN \('postgres', 'service_role'\)/);
    expect(trecho).toContain("FATURA_BLOQUEADA"); // proteção de fatura emitida permanece
  });
  it("NÃO desabilita trigger nem remove proteção; sem DELETE", () => {
    expect(sql).not.toMatch(/DISABLE\s+TRIGGER/i);
    expect(sql).not.toMatch(/DROP\s+TRIGGER/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});

describe("TMS-FAT-URG-07 — f_cancelar_fatura ordem correta + guards", () => {
  const sql = read(SQL_FWD);
  it("cancela ITENS antes de marcar a fatura como cancelada", () => {
    const iItens = sql.indexOf("SET status = 'cancelado', atualizado_em = now()");
    const iFatura = sql.search(/SET status = 'cancelada',\s*\n\s*cancelado_em = now\(\)/);
    expect(iItens).toBeGreaterThan(-1);
    expect(iFatura).toBeGreaterThan(-1);
    expect(iItens).toBeLessThan(iFatura);
  });
  it("guards: auth, perfil, tenant, AR com efeito financeiro, idempotência", () => {
    expect(sql).toContain("USUARIO_NAO_AUTENTICADO");
    expect(sql).toContain("SEM_PERMISSAO_PERFIL");
    expect(sql).toContain("SEM_PERMISSAO_TENANT");
    expect(sql).toContain("FATURA_NAO_ENCONTRADA");
    expect(sql).toContain("FATURA_JA_CANCELADA");
    expect(sql).toContain("FATURA_AR_COM_EFEITO_FINANCEIRO");
  });
  it("mantém SECURITY DEFINER + search_path + grants sem anon", () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path TO 'public'/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.f_cancelar_fatura\(uuid, text\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.f_cancelar_fatura\(uuid, text\) TO authenticated, service_role/);
  });
  it("rollback restaura guard original (DEFINER) e f_cancelar original", () => {
    const rb = read(SQL_ROLLBACK);
    expect(rb).toContain("SECURITY DEFINER");
    expect(rb).toMatch(/SELECT status INTO v_status FROM public\.faturas WHERE id = NEW\.fatura_id/);
    expect(rb).toContain("FATURA_JA_CANCELADA");
  });
});
