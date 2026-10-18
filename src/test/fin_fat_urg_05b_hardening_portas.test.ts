// ═══════════════════════════════════════════════════════════════════════════════
// TMS-FAT-URG-05B — HARDENING DAS PORTAS DE EMISSÃO (verificação estrutural)
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const SQL_FWD = "supabase/migrations/20260925000004_fin_fat_urg_05b_hardening_portas.sql";
const SQL_ROLLBACK = "supabase/migrations/20260925000005_fin_fat_urg_05b_rollback.sql";
const SRC_FATURA_SERVICE = "src/services/financeiro/faturaService.ts";

describe("TMS-FAT-URG-05B — f_regularizar_fatura_legada (legado) endurecida", () => {
  const sql = read(SQL_FWD);
  it("D/E) só aceita fatura JÁ emitida; bloqueia rascunho/aguardando/aprovada", () => {
    expect(sql).toContain("REGULARIZAR_SO_FATURA_EMITIDA");
    expect(sql).toMatch(/v_fatura\.status <> 'emitida'/);
  });
  it("grants: sem PUBLIC/anon/authenticated; apenas service_role", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.f_regularizar_fatura_legada\(uuid, uuid\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.f_regularizar_fatura_legada\(uuid, uuid\) TO service_role/);
  });
  it("rollback re-concede authenticated e remove o guard", () => {
    const rb = read(SQL_ROLLBACK);
    expect(rb).toMatch(/GRANT EXECUTE ON FUNCTION public\.f_regularizar_fatura_legada\(uuid, uuid\) TO authenticated, service_role/);
    expect(rb).toContain("DROP TRIGGER IF EXISTS trg_faturas_protege_status");
    expect(rb).toContain("DROP FUNCTION IF EXISTS public.f_trg_faturas_protege_status()");
  });
});

describe("TMS-FAT-URG-05B — guard de UPDATE direto de status em faturas", () => {
  const sql = read(SQL_FWD);
  it("F) trigger BEFORE INSERT OR UPDATE OF status com mensagens oficiais", () => {
    expect(sql).toContain("FATURA_STATUS_SOMENTE_VIA_RPC");
    expect(sql).toContain("FATURA_STATUS_INSERT_INVALIDO");
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF status ON public\.faturas/);
    expect(sql).toMatch(/IF NEW\.status IS DISTINCT FROM OLD\.status/);
  });
  it("guard function é SECURITY INVOKER (permite RPC definer, barra cliente)", () => {
    // o bloco da função guard NÃO deve conter SECURITY DEFINER
    const idx = sql.indexOf("f_trg_faturas_protege_status()");
    const trecho = sql.slice(idx, idx + 700);
    expect(trecho).not.toContain("SECURITY DEFINER");
    expect(trecho).toMatch(/current_user NOT IN \('postgres', 'service_role'\)/);
  });
  it("G) edições legítimas (não-status) não disparam o guard (UPDATE OF status)", () => {
    expect(sql).toMatch(/BEFORE UPDATE OF status/); // só quando status está no SET
  });
});

describe("TMS-FAT-URG-05B — emissão oficial continua exigindo aprovada", () => {
  it("faturaService.atualizarFatura não envia status (edição preserva)", () => {
    const src = read(SRC_FATURA_SERVICE);
    expect(src).toMatch(/"status" REMOVIDO de propósito/);
  });
});

describe("TMS-FAT-URG-05B — matriz das portas (documentação viva)", () => {
  it("as RPCs oficiais estão nomeadas no guard/erro", () => {
    const sql = read(SQL_FWD);
    expect(sql).toContain("f_mover_fatura_status");
    expect(sql).toContain("f_emitir_fatura");
    expect(sql).toContain("f_cancelar_fatura");
  });
});
